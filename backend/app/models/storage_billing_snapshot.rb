# frozen_string_literal: true

# StorageBillingSnapshot - Monthly storage billing records for Wasabi/Backblaze
#
# Stores a snapshot of storage usage each month so we can show billing history.
# Neither Wasabi nor Backblaze has a billing history API, so we track it ourselves.
#
class StorageBillingSnapshot < ApplicationRecord
  # Constants
  PROVIDERS = %w[wasabi backblaze].freeze

  validates :provider, presence: true, inclusion: { in: PROVIDERS }
  validates :period, presence: true, format: { with: /\A\d{4}-\d{2}\z/ }
  validates :provider, uniqueness: { scope: :period }

  scope :for_provider, ->(p) { where(provider: p) }
  scope :recent, -> { order(period: :desc) }

  # Upsert a snapshot for the current month
  def self.record_snapshot(provider:, total_size_gb:, total_objects:, estimated_cost:, details: {})
    period = Time.current.strftime("%Y-%m")

    snapshot = find_or_initialize_by(provider: provider, period: period)
    snapshot.update!(
      total_size_gb: total_size_gb,
      total_objects: total_objects,
      estimated_cost: estimated_cost,
      details: details
    )
    snapshot
  end

  # Get billing history for a provider (most recent first)
  def self.history_for(provider, limit: 12)
    for_provider(provider).recent.limit(limit).map do |s|
      {
        period: s.period,
        totalSizeGB: s.total_size_gb,
        totalObjects: s.total_objects,
        estimatedCost: s.estimated_cost,
        recordedAt: s.updated_at.iso8601
      }
    end
  end
end
