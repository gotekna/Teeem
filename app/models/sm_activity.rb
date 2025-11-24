# frozen_string_literal: true

# SmActivity - Activity feed tracking for SM Gantt
#
# Tracks all significant events:
# - Task status changes
# - Resource assignments
# - Photo uploads
# - Voice notes
# - Check-ins
# - Comments
# - Schedule changes
#
class SmActivity < ApplicationRecord
  belongs_to :construction
  belongs_to :user, optional: true
  belongs_to :resource, class_name: 'SmResource', optional: true
  belongs_to :task, class_name: 'SmTask', foreign_key: 'sm_task_id', optional: true

  # Polymorphic reference to the changed object
  belongs_to :trackable, polymorphic: true, optional: true

  # Activity types
  ACTIVITY_TYPES = %w[
    task_created
    task_updated
    task_status_changed
    task_deleted
    task_assigned
    task_unassigned
    resource_assigned
    resource_removed
    photo_uploaded
    photo_deleted
    voice_note_added
    checkin_arrival
    checkin_departure
    comment_added
    comment_edited
    comment_deleted
    schedule_updated
    dependency_added
    dependency_removed
    milestone_reached
  ].freeze

  validates :activity_type, presence: true, inclusion: { in: ACTIVITY_TYPES }

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :for_construction, ->(id) { where(construction_id: id) }
  scope :for_task, ->(id) { where(sm_task_id: id) }
  scope :for_user, ->(id) { where(user_id: id) }
  scope :for_resource, ->(id) { where(resource_id: id) }
  scope :by_type, ->(type) { where(activity_type: type) }
  scope :today, -> { where(created_at: Time.current.beginning_of_day..Time.current.end_of_day) }
  scope :this_week, -> { where(created_at: 1.week.ago..Time.current) }

  # Instance methods
  def icon
    case activity_type
    when /photo/ then 'camera'
    when /voice/ then 'microphone'
    when /checkin/ then 'map-pin'
    when /comment/ then 'chat'
    when /task_created/ then 'plus'
    when /task_deleted/ then 'trash'
    when /task_status/ then 'check-circle'
    when /assigned/, /resource/ then 'user'
    when /schedule/, /dependency/ then 'calendar'
    when /milestone/ then 'flag'
    else 'activity'
    end
  end

  def color
    case activity_type
    when /created/, /added/, /arrival/ then 'green'
    when /deleted/, /removed/, /departure/ then 'red'
    when /updated/, /changed/, /edited/ then 'blue'
    when /milestone/ then 'purple'
    else 'gray'
    end
  end

  def formatted_message
    case activity_type
    when 'task_created'
      "created task \"#{metadata['task_name']}\""
    when 'task_updated'
      changes = metadata['changes']&.keys&.join(', ') || 'details'
      "updated #{changes} on \"#{metadata['task_name']}\""
    when 'task_status_changed'
      "changed status to #{metadata['new_status']} on \"#{metadata['task_name']}\""
    when 'task_deleted'
      "deleted task \"#{metadata['task_name']}\""
    when 'task_assigned'
      "assigned #{metadata['assignee_name']} to \"#{metadata['task_name']}\""
    when 'resource_assigned'
      "assigned resource #{metadata['resource_name']} to \"#{metadata['task_name']}\""
    when 'resource_removed'
      "removed resource #{metadata['resource_name']} from \"#{metadata['task_name']}\""
    when 'photo_uploaded'
      "uploaded a #{metadata['photo_type'] || 'progress'} photo to \"#{metadata['task_name']}\""
    when 'voice_note_added'
      "added a voice note to \"#{metadata['task_name']}\""
    when 'checkin_arrival'
      "checked in at #{metadata['construction_name']}"
    when 'checkin_departure'
      "checked out from #{metadata['construction_name']}"
    when 'comment_added'
      "commented on \"#{metadata['task_name']}\""
    when 'milestone_reached'
      "completed milestone \"#{metadata['task_name']}\""
    else
      activity_type.humanize.downcase
    end
  end

  def actor_name
    if user.present?
      user.full_name || user.email
    elsif resource.present?
      resource.name
    else
      'System'
    end
  end

  # Class methods for creating activities
  class << self
    def track(activity_type, construction:, user: nil, resource: nil, task: nil, trackable: nil, metadata: {})
      create!(
        activity_type: activity_type,
        construction: construction,
        user: user,
        resource: resource,
        task: task,
        trackable: trackable,
        metadata: metadata.to_json
      )
    rescue StandardError => e
      Rails.logger.error("Failed to track activity: #{e.message}")
      nil
    end

    def track_task_change(task, user:, changes:)
      return if changes.blank?

      activity_type = if changes.key?('status')
                        'task_status_changed'
                      else
                        'task_updated'
                      end

      track(
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
    end
  end
end
