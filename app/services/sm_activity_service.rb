# frozen_string_literal: true

# SmActivityService - Centralized activity tracking
#
# Use this service to track activities from controllers/models
# to ensure consistent activity logging across the application.
#
class SmActivityService
  class << self
    # Task activities
    def task_created(task, user:)
      SmActivity.track(
        'task_created',
        construction: task.construction,
        user: user,
        task: task,
        trackable: task,
        metadata: {
          task_name: task.name,
          trade: task.trade,
          start_date: task.start_date,
          end_date: task.end_date
        }
      )
    end

    def task_updated(task, user:, changes:)
      return if changes.blank?

      # Determine specific activity type
      activity_type = if changes.key?('status')
                        'task_status_changed'
                      else
                        'task_updated'
                      end

      SmActivity.track(
        activity_type,
        construction: task.construction,
        user: user,
        task: task,
        trackable: task,
        metadata: {
          task_name: task.name,
          changes: changes,
          old_status: changes['status']&.first,
          new_status: changes['status']&.last
        }
      )

      # Check for milestone completion
      if changes['status']&.last == 'completed' && task.is_milestone?
        milestone_reached(task, user: user)
      end
    end

    def task_deleted(task, user:)
      SmActivity.track(
        'task_deleted',
        construction: task.construction,
        user: user,
        task: task,
        metadata: {
          task_name: task.name,
          trade: task.trade
        }
      )
    end

    def task_assigned(task, assignee:, user:)
      SmActivity.track(
        'task_assigned',
        construction: task.construction,
        user: user,
        task: task,
        trackable: task,
        metadata: {
          task_name: task.name,
          assignee_id: assignee.id,
          assignee_name: assignee.respond_to?(:full_name) ? assignee.full_name : assignee.name
        }
      )
    end

    # Resource activities
    def resource_assigned(task, resource:, user:)
      SmActivity.track(
        'resource_assigned',
        construction: task.construction,
        user: user,
        resource: resource,
        task: task,
        trackable: resource,
        metadata: {
          task_name: task.name,
          resource_name: resource.name,
          resource_type: resource.resource_type
        }
      )
    end

    def resource_removed(task, resource:, user:)
      SmActivity.track(
        'resource_removed',
        construction: task.construction,
        user: user,
        resource: resource,
        task: task,
        metadata: {
          task_name: task.name,
          resource_name: resource.name
        }
      )
    end

    # Photo activities
    def photo_uploaded(photo, user:)
      task = photo.task
      SmActivity.track(
        'photo_uploaded',
        construction: task.construction,
        user: user,
        task: task,
        trackable: photo,
        metadata: {
          task_name: task.name,
          photo_type: photo.photo_type,
          photo_url: photo.thumbnail_url || photo.photo_url
        }
      )
    end

    def photo_deleted(photo, user:)
      task = photo.task
      SmActivity.track(
        'photo_deleted',
        construction: task.construction,
        user: user,
        task: task,
        metadata: {
          task_name: task.name,
          photo_type: photo.photo_type
        }
      )
    end

    # Voice note activities
    def voice_note_added(voice_note, user:)
      task = voice_note.task
      SmActivity.track(
        'voice_note_added',
        construction: task.construction,
        user: user,
        task: task,
        trackable: voice_note,
        metadata: {
          task_name: task.name,
          duration: voice_note.formatted_duration
        }
      )
    end

    # Check-in activities
    def checkin(checkin, user:)
      activity_type = checkin.checkin_type == 'arrival' ? 'checkin_arrival' : 'checkin_departure'

      SmActivity.track(
        activity_type,
        construction: checkin.construction,
        user: user,
        resource: checkin.resource,
        task: checkin.task,
        trackable: checkin,
        metadata: {
          construction_name: checkin.construction.name,
          resource_name: checkin.resource&.name,
          on_site: checkin.on_site?,
          distance: checkin.distance_from_site
        }
      )
    end

    # Comment activities (handled by SmComment model callbacks)

    # Schedule activities
    def schedule_updated(construction, user:, changes_summary:)
      SmActivity.track(
        'schedule_updated',
        construction: construction,
        user: user,
        metadata: {
          changes_summary: changes_summary
        }
      )
    end

    # Dependency activities
    def dependency_added(task, predecessor:, user:)
      SmActivity.track(
        'dependency_added',
        construction: task.construction,
        user: user,
        task: task,
        metadata: {
          task_name: task.name,
          predecessor_name: predecessor.name,
          predecessor_id: predecessor.id
        }
      )
    end

    def dependency_removed(task, predecessor:, user:)
      SmActivity.track(
        'dependency_removed',
        construction: task.construction,
        user: user,
        task: task,
        metadata: {
          task_name: task.name,
          predecessor_name: predecessor.name
        }
      )
    end

    # Milestone activities
    def milestone_reached(task, user:)
      SmActivity.track(
        'milestone_reached',
        construction: task.construction,
        user: user,
        task: task,
        trackable: task,
        metadata: {
          task_name: task.name,
          completed_at: Time.current
        }
      )
    end

    # Fetch activities with filters
    def feed(construction_id:, filters: {})
      activities = SmActivity.for_construction(construction_id).recent

      activities = activities.for_task(filters[:task_id]) if filters[:task_id]
      activities = activities.for_user(filters[:user_id]) if filters[:user_id]
      activities = activities.for_resource(filters[:resource_id]) if filters[:resource_id]
      activities = activities.by_type(filters[:type]) if filters[:type]
      activities = activities.this_week if filters[:this_week]
      activities = activities.today if filters[:today]

      activities = activities.where('created_at > ?', filters[:since]) if filters[:since]

      activities.limit(filters[:limit] || 50)
    end
  end
end
