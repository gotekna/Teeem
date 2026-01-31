# frozen_string_literal: true

# ImportAuditLog - Tracks data import history for onboarding and general imports
#
# Records details about each import operation:
# - What was imported (import_type: contacts, jobs, pricebook_items, price_histories)
# - Success/failure counts
# - Error and warning details
# - Options used during import
#
class ImportAuditLog < ApplicationRecord
  # Multi-tenancy: Scope all queries to current tenant
  acts_as_tenant :tenant

  # Associations
  belongs_to :tenant
  belongs_to :user, optional: true

  # Validations
  validates :import_type, presence: true
  validates :status, presence: true

  # Status enum
  enum :status, {
    pending: 'pending',
    processing: 'processing',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'cancelled'
  }, prefix: true, default: :pending

  # Available import types
  IMPORT_TYPES = %w[
    contacts
    jobs
    pricebook_items
    price_histories
    job_types
    job_statuses
    document_types
  ].freeze

  validates :import_type, inclusion: { in: IMPORT_TYPES }

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :successful, -> { where(status: 'completed').where('errors_count = 0') }
  scope :with_errors, -> { where('errors_count > 0') }
  scope :for_type, ->(type) { where(import_type: type) }

  # Start an import (called at beginning)
  def start!
    update!(
      status: 'processing',
      started_at: Time.current
    )
  end

  # Complete an import successfully
  def complete!(counts = {})
    update!(
      status: 'completed',
      completed_at: Time.current,
      rows_processed: counts[:processed] || 0,
      rows_created: counts[:created] || 0,
      rows_updated: counts[:updated] || 0,
      rows_skipped: counts[:skipped] || 0,
      errors_count: counts[:errors] || error_details.size,
      warnings_count: counts[:warnings] || warning_details.size,
      counts: counts
    )
  end

  # Mark import as failed
  def fail!(error_message)
    update!(
      status: 'failed',
      completed_at: Time.current,
      error_details: [{ row: 0, message: error_message, fatal: true }]
    )
  end

  # Add an error to the log
  def add_error(row:, message:, column: nil, value: nil)
    current_errors = error_details || []
    current_errors << {
      row: row,
      column: column,
      value: value,
      message: message
    }.compact
    update!(error_details: current_errors, errors_count: current_errors.size)
  end

  # Add a warning to the log
  def add_warning(row:, message:, column: nil, value: nil)
    current_warnings = warning_details || []
    current_warnings << {
      row: row,
      column: column,
      value: value,
      message: message
    }.compact
    update!(warning_details: current_warnings, warnings_count: current_warnings.size)
  end

  # Duration of the import in seconds
  def duration_seconds
    return nil unless started_at.present? && completed_at.present?

    (completed_at - started_at).to_i
  end

  # Human-readable summary
  def summary
    parts = []
    parts << "#{rows_created} created" if rows_created.positive?
    parts << "#{rows_updated} updated" if rows_updated.positive?
    parts << "#{rows_skipped} skipped" if rows_skipped.positive?
    parts << "#{errors_count} errors" if errors_count.positive?
    parts.join(', ')
  end

  # Check if import was fully successful (no errors)
  def fully_successful?
    status_completed? && errors_count.zero?
  end

  # Check if import had any issues
  def has_issues?
    errors_count.positive? || warnings_count.positive?
  end
end
