# frozen_string_literal: true

module Gl
  # Record of a report execution
  class ReportRun < ApplicationRecord
    self.table_name = "gl_report_runs"

    STATUSES = %w[pending running completed failed].freeze
    EXPORT_FORMATS = %w[pdf excel csv].freeze

    belongs_to :custom_report, class_name: "Gl::CustomReport"
    belongs_to :run_by, class_name: "User", optional: true

    validates :status, presence: true, inclusion: { in: STATUSES }
    validates :export_format, inclusion: { in: EXPORT_FORMATS }, allow_blank: true

    scope :completed, -> { where(status: "completed") }
    scope :failed, -> { where(status: "failed") }
    scope :recent, -> { order(created_at: :desc) }
    scope :with_exports, -> { where.not(export_format: nil) }

    # Check if still running
    def running?
      status == "running"
    end

    def completed?
      status == "completed"
    end

    def failed?
      status == "failed"
    end

    # Duration in human-readable format
    def duration_text
      return nil unless execution_time

      if execution_time < 1
        "#{(execution_time * 1000).round}ms"
      else
        "#{execution_time.round(1)}s"
      end
    end
  end
end
