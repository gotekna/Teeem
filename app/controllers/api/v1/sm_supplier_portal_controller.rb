# frozen_string_literal: true

module Api
  module V1
    class SmSupplierPortalController < ApplicationController
      skip_before_action :authenticate_request, only: [:authenticate, :show, :tasks, :task_detail, :activities]
      before_action :authenticate_supplier!, except: [:authenticate, :generate_access, :list_access, :revoke_access]
      before_action :set_access, only: [:show, :tasks, :task_detail, :activities, :update_task, :add_comment]

      # ==========================================
      # SUPPLIER AUTHENTICATION
      # ==========================================

      # POST /api/v1/sm_supplier_portal/authenticate
      # Authenticate with access token
      def authenticate
        token = params[:access_token] || request.headers['X-Supplier-Token']
        access = SmSupplierAccess.find_by_token(token)

        if access.nil?
          return render json: { success: false, error: 'Invalid access token' }, status: :unauthorized
        end

        unless access.active?
          return render json: {
            success: false,
            error: access.revoked? ? 'Access has been revoked' : 'Access token has expired'
          }, status: :unauthorized
        end

        access.record_access!

        render json: {
          success: true,
          supplier: {
            id: access.contact.id,
            name: access.contact.name,
            email: access.contact.email
          },
          construction: {
            id: access.construction.id,
            name: access.construction.name
          },
          expires_at: access.expires_at,
          token: access.access_token
        }
      end

      # ==========================================
      # SUPPLIER PORTAL VIEWS
      # ==========================================

      # GET /api/v1/sm_supplier_portal/show
      # Portal overview
      def show
        tasks = @access.assigned_tasks
                       .includes(:construction)
                       .order(:start_date)

        render json: {
          success: true,
          supplier: supplier_json(@access.contact),
          construction: construction_json(@access.construction),
          summary: {
            total_tasks: tasks.count,
            not_started: tasks.where(status: 'not_started').count,
            in_progress: tasks.where(status: 'started').count,
            completed: tasks.where(status: 'completed').count
          },
          upcoming_tasks: tasks.where(status: %w[not_started started])
                              .limit(5)
                              .map { |t| task_summary_json(t) }
        }
      end

      # GET /api/v1/sm_supplier_portal/tasks
      # List all assigned tasks
      def tasks
        tasks = @access.assigned_tasks
                       .includes(:construction, :task_photos)
                       .order(:start_date)

        # Filters
        tasks = tasks.where(status: params[:status]) if params[:status].present?

        render json: {
          success: true,
          tasks: tasks.map { |t| task_json(t) },
          filters: {
            status: params[:status]
          }
        }
      end

      # GET /api/v1/sm_supplier_portal/tasks/:task_id
      # Task detail view
      def task_detail
        task = @access.assigned_tasks.find(params[:task_id])

        render json: {
          success: true,
          task: task_detail_json(task)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Task not found or not assigned to you' }, status: :not_found
      end

      # GET /api/v1/sm_supplier_portal/activities
      # Activity feed for supplier's tasks
      def activities
        task_ids = @access.assigned_tasks.pluck(:id)

        activities = SmActivity
                     .where(sm_task_id: task_ids)
                     .recent
                     .limit(params[:limit] || 50)

        render json: {
          success: true,
          activities: activities.map { |a| activity_json(a) }
        }
      end

      # ==========================================
      # SUPPLIER ACTIONS
      # ==========================================

      # PATCH /api/v1/sm_supplier_portal/tasks/:task_id
      # Update task status (limited fields)
      def update_task
        task = @access.assigned_tasks.find(params[:task_id])

        # Suppliers can only update certain fields
        allowed_updates = {}
        allowed_updates[:supplier_notes] = params[:supplier_notes] if params.key?(:supplier_notes)

        # Suppliers can confirm they've seen the schedule
        if params[:confirm_receipt] == true
          allowed_updates[:supplier_confirmed_at] = Time.current
        end

        if allowed_updates.any? && task.update(allowed_updates)
          render json: { success: true, task: task_json(task) }
        else
          render json: { success: false, errors: task.errors.full_messages }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Task not found' }, status: :not_found
      end

      # POST /api/v1/sm_supplier_portal/tasks/:task_id/comments
      # Add a comment to task
      def add_comment
        task = @access.assigned_tasks.find(params[:task_id])

        comment = task.comments.new(
          body: params[:body],
          resource_id: params[:resource_id]
        )
        # No user author for supplier comments - track via supplier contact
        comment.author = nil

        if comment.save
          # Track activity
          SmActivity.track(
            'comment_added',
            construction: task.construction,
            task: task,
            trackable: comment,
            metadata: {
              task_name: task.name,
              supplier_name: @access.contact.name,
              comment_preview: comment.body.truncate(100)
            }
          )

          render json: { success: true, comment: comment_json(comment) }, status: :created
        else
          render json: { success: false, errors: comment.errors.full_messages }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Task not found' }, status: :not_found
      end

      # ==========================================
      # ADMIN: ACCESS MANAGEMENT
      # ==========================================

      # POST /api/v1/sm_supplier_portal/access
      # Generate access for supplier
      def generate_access
        contact = Contact.find(params[:contact_id])
        construction = Construction.find(params[:construction_id])

        # Check if access already exists
        existing = SmSupplierAccess.active
                                   .find_by(contact: contact, construction: construction)

        if existing
          return render json: {
            success: true,
            access: access_json(existing),
            message: 'Existing active access found'
          }
        end

        access = SmSupplierAccess.create_for_supplier(
          contact: contact,
          construction: construction,
          created_by: current_user,
          expires_in: (params[:expires_in_days] || 30).to_i.days
        )

        if access.persisted?
          render json: {
            success: true,
            access: access_json(access),
            portal_url: portal_url(access)
          }, status: :created
        else
          render json: { success: false, errors: access.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/sm_supplier_portal/access
      # List all access tokens for a construction
      def list_access
        accesses = SmSupplierAccess.includes(:contact, :construction)

        accesses = accesses.for_construction(params[:construction_id]) if params[:construction_id]
        accesses = accesses.active if params[:active_only] == 'true'

        render json: {
          success: true,
          accesses: accesses.map { |a| access_json(a) }
        }
      end

      # DELETE /api/v1/sm_supplier_portal/access/:id
      # Revoke access
      def revoke_access
        access = SmSupplierAccess.find(params[:id])
        access.revoke!

        render json: { success: true }
      end

      private

      def authenticate_supplier!
        token = params[:access_token] || request.headers['X-Supplier-Token']
        @current_supplier_access = SmSupplierAccess.find_by_token(token)

        return if @current_supplier_access&.active?

        render json: { success: false, error: 'Unauthorized' }, status: :unauthorized
      end

      def set_access
        @access = @current_supplier_access
      end

      def supplier_json(contact)
        {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company_name
        }
      end

      def construction_json(construction)
        {
          id: construction.id,
          name: construction.name,
          address: construction.address,
          status: construction.status
        }
      end

      def task_summary_json(task)
        {
          id: task.id,
          name: task.name,
          trade: task.trade,
          start_date: task.start_date,
          end_date: task.end_date,
          status: task.status
        }
      end

      def task_json(task)
        {
          id: task.id,
          name: task.name,
          trade: task.trade,
          description: task.description,
          start_date: task.start_date,
          end_date: task.end_date,
          duration_days: task.duration_days,
          status: task.status,
          supplier_notes: task.supplier_notes,
          supplier_confirmed_at: task.supplier_confirmed_at,
          photos_count: task.task_photos.count,
          construction: {
            id: task.construction_id,
            name: task.construction.name
          }
        }
      end

      def task_detail_json(task)
        task_json(task).merge(
          comments: task.comments.not_deleted.oldest_first.limit(20).map { |c| comment_json(c) },
          photos: task.task_photos.recent.limit(10).map { |p| photo_json(p) },
          activities: SmActivity.for_task(task.id).recent.limit(10).map { |a| activity_json(a) },
          predecessors: task.predecessors.map { |p| { id: p.id, name: p.name, status: p.status } },
          successors: task.successors.map { |s| { id: s.id, name: s.name, status: s.status } }
        )
      end

      def comment_json(comment)
        {
          id: comment.id,
          body: comment.body,
          author_name: comment.author&.full_name || 'Supplier',
          created_at: comment.created_at
        }
      end

      def photo_json(photo)
        {
          id: photo.id,
          url: photo.photo_url,
          thumbnail_url: photo.thumbnail_url,
          photo_type: photo.photo_type,
          caption: photo.caption,
          created_at: photo.created_at
        }
      end

      def activity_json(activity)
        {
          id: activity.id,
          type: activity.activity_type,
          message: activity.formatted_message,
          created_at: activity.created_at
        }
      end

      def access_json(access)
        {
          id: access.id,
          access_token: access.access_token,
          contact: {
            id: access.contact_id,
            name: access.contact.name,
            email: access.contact.email
          },
          construction: {
            id: access.construction_id,
            name: access.construction.name
          },
          expires_at: access.expires_at,
          active: access.active?,
          access_count: access.access_count,
          last_accessed_at: access.last_accessed_at,
          created_at: access.created_at
        }
      end

      def portal_url(access)
        # Generate portal URL with embedded token
        "#{ENV['FRONTEND_URL'] || 'https://app.trapid.com.au'}/supplier-portal?token=#{access.access_token}"
      end
    end
  end
end
