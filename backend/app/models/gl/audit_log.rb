# frozen_string_literal: true

module Gl
  # Complete audit trail for all GL changes
  class AuditLog < ApplicationRecord
    self.table_name = "gl_audit_logs"

    ACTIONS = %w[create update delete approve reject void restore import].freeze
    SOURCES = %w[web api import system webhook].freeze

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :user, optional: true
    belongs_to :auditable, polymorphic: true, optional: true

    validates :auditable_type, presence: true
    validates :auditable_id, presence: true
    validates :action, presence: true, inclusion: { in: ACTIONS }

    scope :for_record, ->(record) { where(auditable: record) }
    scope :for_type, ->(type) { where(auditable_type: type) }
    scope :by_user, ->(user) { where(user: user) }
    scope :recent, -> { order(created_at: :desc) }
    scope :in_period, ->(start_date, end_date) { where(created_at: start_date.beginning_of_day..end_date.end_of_day) }

    # Log a change
    def self.log!(record, action:, user: nil, changes: nil, source: "web", ip: nil, notes: nil)
      create!(
        corporate_company: record.try(:corporate_company) || Corporate.first,
        user: user,
        auditable_type: record.class.name,
        auditable_id: record.id,
        action: action,
        changes_made: changes || extract_changes(record),
        previous_values: action == "update" ? record.saved_changes.transform_values(&:first) : nil,
        new_values: action == "delete" ? nil : record.attributes,
        source: source,
        ip_address: ip,
        notes: notes
      )
    end

    # Get full history for a record
    def self.history_for(record)
      for_record(record).recent
    end

    # Compare two snapshots
    def self.changes_between(record, from_time, to_time)
      logs = for_record(record).where(created_at: from_time..to_time).order(:created_at)
      logs.map { |l| { at: l.created_at, action: l.action, changes: l.changes_made, user: l.user&.name } }
    end

    # Formatted change description
    def change_description
      return "#{action.titleize}d" if changes_made.blank?

      changes_made.map do |field, values|
        if values.is_a?(Array)
          "#{field.humanize}: #{values[0]} → #{values[1]}"
        else
          "#{field.humanize}: #{values}"
        end
      end.join(", ")
    end

    def self.extract_changes(record)
      return {} unless record.respond_to?(:saved_changes)

      record.saved_changes.except("updated_at", "created_at")
    end
  end
end
