# frozen_string_literal: true

module Api
  module V1
    module Portal
      class SmTasksController < BaseController
        before_action :require_subcontractor

        # GET /api/v1/portal/sm_tasks
        # List all SM Gantt tasks assigned to this supplier
        def index
          tasks = SmTask.where(supplier_id: current_contact.id)
                        .includes(:construction, :task_photos, :comments)
                        .order(:start_date)

          # Filter by status
          tasks = tasks.where(status: params[:status]) if params[:status].present?

          # Filter by construction
          tasks = tasks.where(construction_id: params[:construction_id]) if params[:construction_id].present?

          # Categorize
          render json: {
            success: true,
            data: {
              upcoming: tasks.where(status: 'not_started').map { |t| task_json(t) },
              in_progress: tasks.where(status: 'started').map { |t| task_json(t) },
              completed: tasks.where(status: 'completed').map { |t| task_json(t) },
              all_tasks: tasks.map { |t| task_json(t) }
            },
            summary: {
              total: tasks.count,
              not_started: tasks.where(status: 'not_started').count,
              started: tasks.where(status: 'started').count,
              completed: tasks.where(status: 'completed').count
            }
          }
        end

        # GET /api/v1/portal/sm_tasks/:id
        # View task detail
        def show
          task = supplier_tasks.find(params[:id])

          render json: {
            success: true,
            data: task_detail_json(task)
          }
        end

        # PATCH /api/v1/portal/sm_tasks/:id
        # Update task (limited to supplier notes and confirmation)
        def update
          task = supplier_tasks.find(params[:id])

          # Suppliers can only update certain fields
          if params[:confirm_schedule] == true && task.supplier_confirmed_at.nil?
            task.supplier_confirmed_at = Time.current
            SmActivity.track(
              'task_updated',
              construction: task.construction,
              task: task,
              metadata: {
                task_name: task.name,
                changes: { 'supplier_confirmed' => [false, true] },
                supplier_name: current_contact.name
              }
            )
          end

          task.supplier_notes = params[:supplier_notes] if params.key?(:supplier_notes)

          if task.save
            render json: { success: true, data: task_json(task) }
          else
            render json: { success: false, errors: task.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/portal/sm_tasks/:id/comments
        # Add a comment to task
        def add_comment
          task = supplier_tasks.find(params[:id])

          comment = task.comments.new(
            body: params[:body]
          )
          # For portal users, we need to handle author differently
          # Mark as portal user comment via metadata
          comment.author = nil

          if comment.save
            SmActivity.track(
              'comment_added',
              construction: task.construction,
              task: task,
              trackable: comment,
              metadata: {
                task_name: task.name,
                supplier_name: current_contact.name,
                comment_preview: comment.body.truncate(100),
                from_portal: true
              }
            )

            render json: {
              success: true,
              data: comment_json(comment)
            }, status: :created
          else
            render json: { success: false, errors: comment.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # GET /api/v1/portal/sm_tasks/:id/comments
        # List comments for task
        def comments
          task = supplier_tasks.find(params[:id])
          comments = task.comments.not_deleted.oldest_first.includes(:author)

          render json: {
            success: true,
            data: comments.map { |c| comment_json(c) }
          }
        end

        # GET /api/v1/portal/sm_tasks/:id/photos
        # List photos for task
        def photos
          task = supplier_tasks.find(params[:id])
          photos = task.task_photos.recent

          render json: {
            success: true,
            data: photos.map { |p| photo_json(p) }
          }
        end

        # POST /api/v1/portal/sm_tasks/:id/photos
        # Upload photo to task
        def upload_photo
          task = supplier_tasks.find(params[:id])

          photo = task.task_photos.new(
            photo_type: params[:photo_type] || 'progress',
            caption: params[:caption]
          )

          # Handle base64 image
          if params[:image_data].present?
            result = CloudinaryService.upload_base64(params[:image_data], folder: 'sm_task_photos')
            photo.photo_url = result[:url] if result[:success]
          end

          if photo.save
            SmActivityService.photo_uploaded(photo, user: nil)

            render json: {
              success: true,
              data: photo_json(photo)
            }, status: :created
          else
            render json: { success: false, errors: photo.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # GET /api/v1/portal/sm_tasks/activities
        # Activity feed for all supplier tasks
        def activities
          task_ids = supplier_tasks.pluck(:id)

          activities = SmActivity
                       .where(sm_task_id: task_ids)
                       .recent
                       .limit(params[:limit] || 50)

          render json: {
            success: true,
            data: activities.map { |a| activity_json(a) }
          }
        end

        # GET /api/v1/portal/sm_tasks/schedule
        # Schedule view of all tasks
        def schedule
          tasks = supplier_tasks.order(:start_date)

          # Group by week
          by_week = tasks.group_by { |t| t.start_date.beginning_of_week }

          render json: {
            success: true,
            data: {
              tasks: tasks.map { |t| task_json(t) },
              by_week: by_week.transform_values { |week_tasks| week_tasks.map { |t| task_json(t) } }
            }
          }
        end

        private

        def supplier_tasks
          SmTask.where(supplier_id: current_contact.id)
        end

        def task_json(task)
          {
            id: task.id,
            name: task.name,
            trade: task.trade,
            status: task.status,
            start_date: task.start_date,
            end_date: task.end_date,
            duration_days: task.duration_days,
            supplier_notes: task.supplier_notes,
            supplier_confirmed_at: task.supplier_confirmed_at,
            photos_count: task.task_photos.size,
            comments_count: task.comments.not_deleted.size,
            construction: {
              id: task.construction_id,
              name: task.construction.name,
              address: task.construction.street_address
            }
          }
        end

        def task_detail_json(task)
          task_json(task).merge(
            description: task.description,
            notes: task.notes,
            hold_reason: task.hold_reason&.name,
            predecessors: task.predecessors.map { |p| { id: p.id, name: p.name, status: p.status } },
            successors: task.successors.map { |s| { id: s.id, name: s.name, status: s.status } },
            comments: task.comments.not_deleted.oldest_first.limit(20).map { |c| comment_json(c) },
            photos: task.task_photos.recent.limit(10).map { |p| photo_json(p) },
            recent_activity: SmActivity.for_task(task.id).recent.limit(5).map { |a| activity_json(a) }
          )
        end

        def comment_json(comment)
          {
            id: comment.id,
            body: comment.body,
            author_name: comment.author&.full_name || 'Supplier',
            created_at: comment.created_at,
            edited: comment.edited?
          }
        end

        def photo_json(photo)
          {
            id: photo.id,
            url: photo.photo_url,
            thumbnail_url: photo.thumbnail_url,
            photo_type: photo.photo_type,
            caption: photo.caption,
            taken_at: photo.taken_at,
            created_at: photo.created_at
          }
        end

        def activity_json(activity)
          {
            id: activity.id,
            type: activity.activity_type,
            icon: activity.icon,
            color: activity.color,
            message: activity.formatted_message,
            created_at: activity.created_at
          }
        end
      end
    end
  end
end
