# frozen_string_literal: true

# Health Check Cache Model
#
# Stores cached results from health checks to improve performance.
# - Foundation-specific caches (foundation_id present, check_type='foundation')
# - System-wide cache (foundation_id nil, check_type='system')
#
# Refreshed daily at 6 AM Brisbane time via DailyHealthCheckJob
class HealthCheckCache < ApplicationRecord
  # Scopes
  scope :for_foundation, ->(id) { where(foundation_id: id, check_type: "foundation") }
  scope :system_wide, -> { where(check_type: "system", foundation_id: nil) }
  scope :stale, ->(hours = 24) { where("last_run_at < ?", hours.hours.ago) }

  # Validations
  validates :check_type, presence: true, inclusion: { in: %w[foundation system] }
  validates :results, presence: true
  validates :foundation_id, uniqueness: { scope: :check_type }, allow_nil: true

  # Class methods
  def self.get_or_create(foundation_id:, check_type:)
    find_or_create_by(foundation_id: foundation_id, check_type: check_type)
  end

  def self.cache_foundation_health(foundation_id, results)
    cache = get_or_create(foundation_id: foundation_id, check_type: "foundation")
    # Note: overall_health and total_issues are stored in results jsonb
    # Separate columns were removed as they caused schema mismatch in production
    cache.update!(
      results: results,
      last_run_at: Time.current
    )
    cache
  end

  def self.cache_system_health(results)
    cache = get_or_create(foundation_id: nil, check_type: "system")
    # Note: overall_health and total_issues are stored in results jsonb
    cache.update!(
      results: results,
      last_run_at: Time.current
    )
    cache
  end

  # Instance methods
  def fresh?(max_age_hours = 24)
    last_run_at.present? && last_run_at > max_age_hours.hours.ago
  end

  def stale?
    !fresh?
  end

  def age_in_hours
    return nil unless last_run_at.present?
    ((Time.current - last_run_at) / 3600).round(1)
  end
end
