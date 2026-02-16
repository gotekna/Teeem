# frozen_string_literal: true

# Join table linking Jobs to multiple Xero tracking options.
# A job can have several tracking option variants (e.g., "106HAR" for quoting,
# "P-106HAR" for production) that all reference the same job.
#
# SSoT: This table is THE ONE source for Xero tracking option → Job mappings.
# Bill/claim imports query this table to resolve tracking options to jobs.
class XeroJobTrackingLink < ApplicationRecord
  acts_as_tenant :tenant
  belongs_to :job

  validates :tracking_option_id, presence: true, uniqueness: true
  validates :job_id, presence: true

  scope :primary, -> { where(is_primary: true) }

  # Find job for a given Xero tracking option ID
  def self.job_for(tracking_option_id)
    find_by(tracking_option_id: tracking_option_id)&.job
  end

  # Sync primary flag back to job columns for backward compatibility
  after_save :sync_primary_to_job, if: :is_primary?

  private

  def sync_primary_to_job
    return unless job.present?
    return if job.xero_tracking_option_id == tracking_option_id

    job.update_columns(
      xero_tracking_option_id: tracking_option_id,
      xero_tracking_option_name: tracking_option_name
    )
  end
end
