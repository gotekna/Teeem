# frozen_string_literal: true

module Gl
  class SyncLog < ApplicationRecord
    self.table_name = 'gl_sync_logs'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :corporate_company
    belongs_to :gl_provider_credential, class_name: 'Gl::ProviderCredential', optional: true
    belongs_to :triggered_by, class_name: 'User', optional: true

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    SYNC_TYPES = %w[
      full incremental
      accounts invoices bills payments
      bank_transactions credit_notes
      contacts tax_rates
      manual_journals
    ].freeze
    STATUSES = %w[started in_progress completed failed cancelled].freeze
    TRIGGERS = %w[manual scheduled webhook initial].freeze
    PROVIDERS = %w[xero quickbooks myob].freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :external_provider, presence: true, inclusion: { in: PROVIDERS }
    validates :external_tenant_id, presence: true
    validates :sync_type, presence: true, inclusion: { in: SYNC_TYPES }
    validates :status, presence: true, inclusion: { in: STATUSES }
    validates :trigger, inclusion: { in: TRIGGERS }, allow_blank: true

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :started, -> { where(status: 'started') }
    scope :in_progress, -> { where(status: 'in_progress') }
    scope :completed, -> { where(status: 'completed') }
    scope :failed, -> { where(status: 'failed') }
    scope :cancelled, -> { where(status: 'cancelled') }
    scope :active, -> { where(status: %w[started in_progress]) }
    scope :finished, -> { where(status: %w[completed failed cancelled]) }
    scope :successful, -> { completed }
    scope :for_provider, ->(provider, tenant_id) {
      where(external_provider: provider, external_tenant_id: tenant_id)
    }
    scope :for_type, ->(sync_type) { where(sync_type: sync_type) }
    scope :recent, -> { order(created_at: :desc) }
    scope :today, -> { where('created_at >= ?', Time.current.beginning_of_day) }
    scope :last_24_hours, -> { where('created_at >= ?', 24.hours.ago) }
    scope :manual, -> { where(trigger: 'manual') }
    scope :scheduled, -> { where(trigger: 'scheduled') }
    scope :webhook, -> { where(trigger: 'webhook') }

    # ═══════════════════════════════════════════════════════════════
    # CLASS METHODS
    # ═══════════════════════════════════════════════════════════════
    class << self
      # Start a new sync
      def start!(corporate_company:, provider:, tenant_id:, sync_type:, trigger: 'manual', user: nil, credential: nil)
        create!(
          corporate_company: corporate_company,
          gl_provider_credential: credential,
          external_provider: provider,
          external_tenant_id: tenant_id,
          sync_type: sync_type,
          status: 'started',
          started_at: Time.current,
          trigger: trigger,
          triggered_by: user
        )
      end

      # Get last successful sync for a type
      def last_successful(provider, tenant_id, sync_type)
        for_provider(provider, tenant_id)
          .for_type(sync_type)
          .completed
          .recent
          .first
      end

      # Check if sync is currently running
      def sync_running?(provider, tenant_id, sync_type)
        for_provider(provider, tenant_id)
          .for_type(sync_type)
          .active
          .exists?
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS
    # ═══════════════════════════════════════════════════════════════

    # Status checks
    def started?
      status == 'started'
    end

    def in_progress?
      status == 'in_progress'
    end

    def completed?
      status == 'completed'
    end

    def failed?
      status == 'failed'
    end

    def cancelled?
      status == 'cancelled'
    end

    def active?
      status.in?(%w[started in_progress])
    end

    def finished?
      status.in?(%w[completed failed cancelled])
    end

    # Progress tracking
    def begin_processing!(total: nil)
      update!(
        status: 'in_progress',
        total_records: total
      )
    end

    def record_processed!(created: false, updated: false, skipped: false, failed: false)
      increment!(:records_processed)
      increment!(:records_created) if created
      increment!(:records_updated) if updated
      increment!(:records_skipped) if skipped
      increment!(:records_failed) if failed
    end

    def complete!
      update!(
        status: 'completed',
        completed_at: Time.current
      )
      gl_provider_credential&.record_sync!(status: 'success', sync_type: sync_type)
    end

    def fail!(message, details: nil)
      update!(
        status: 'failed',
        completed_at: Time.current,
        error_message: message,
        error_details: details || {}
      )
      gl_provider_credential&.record_sync!(status: 'failed', sync_type: sync_type)
    end

    def cancel!
      update!(
        status: 'cancelled',
        completed_at: Time.current
      )
    end

    # Progress percentage
    def progress_percentage
      return nil unless total_records&.positive?

      (records_processed.to_f / total_records * 100).round(1)
    end

    # Duration in seconds
    def duration
      return nil unless started_at

      end_time = completed_at || Time.current
      (end_time - started_at).round(1)
    end

    # Formatted duration
    def formatted_duration
      d = duration
      return nil unless d

      if d < 60
        "#{d.round}s"
      elsif d < 3600
        "#{(d / 60).round}m #{(d % 60).round}s"
      else
        "#{(d / 3600).round}h #{((d % 3600) / 60).round}m"
      end
    end

    # Summary stats
    def stats_summary
      {
        processed: records_processed,
        created: records_created,
        updated: records_updated,
        skipped: records_skipped,
        failed: records_failed,
        total: total_records
      }
    end

    # Add to details
    def add_detail(key, value)
      self.details = details.merge(key.to_s => value)
      save!
    end

    # Add error detail
    def add_error_detail(key, value)
      self.error_details = error_details.merge(key.to_s => value)
      save!
    end

    # Status badge for UI
    def status_badge
      case status
      when 'started' then { text: 'Starting', color: 'blue' }
      when 'in_progress' then { text: 'Running', color: 'blue' }
      when 'completed' then { text: 'Completed', color: 'green' }
      when 'failed' then { text: 'Failed', color: 'red' }
      when 'cancelled' then { text: 'Cancelled', color: 'gray' }
      else { text: status.titleize, color: 'gray' }
      end
    end

    # Display helpers
    def display_type
      sync_type.titleize
    end

    def display_provider
      external_provider.titleize
    end
  end
end
