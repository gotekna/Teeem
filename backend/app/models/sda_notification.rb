# frozen_string_literal: true

class SdaNotification < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property, optional: true
  belongs_to :notifiable, polymorphic: true, optional: true
  belongs_to :recipient_user, class_name: "User", optional: true
  belongs_to :recipient_contact, class_name: "Contact", optional: true

  NOTIFICATION_TYPES = %w[
    vacancy_5day incident_24hr incident_5day restrictive_practice
    plan_expiry agreement_expiry compliance_overdue price_guide_expiry
    claim_rejected arrears_escalation policy_review_due coi_review_due
  ].freeze
  CHANNELS = %w[email sms in_app ndis_portal sda_finder].freeze
  STATUSES = %w[pending sent delivered failed acknowledged].freeze
  PRIORITIES = %w[low normal high urgent].freeze

  validates :notification_type, presence: true, inclusion: { in: NOTIFICATION_TYPES }
  validates :channel, presence: true, inclusion: { in: CHANNELS }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :priority, inclusion: { in: PRIORITIES }, allow_nil: true

  scope :pending, -> { where(status: "pending") }
  scope :failed, -> { where(status: "failed") }
  scope :overdue, -> { where(overdue: true) }
  scope :by_type, ->(type) { where(notification_type: type) }
  scope :urgent, -> { where(priority: "urgent") }

  def mark_sent!
    update!(status: "sent", sent_at: Time.current)
  end

  def mark_delivered!
    update!(status: "delivered", delivered_at: Time.current)
  end

  def mark_failed!(error_message)
    update!(
      status: "failed",
      delivery_error: error_message,
      retry_count: (retry_count || 0) + 1
    )
  end

  def check_overdue!
    return unless due_at && status == "pending"
    update!(overdue: true) if Time.current > due_at
  end
end
