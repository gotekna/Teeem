# frozen_string_literal: true

# EmailSubscription - Client email hosting subscription
#
# Tracks a client's PolarisMail subscription including:
# - Stripe subscription for recurring billing
# - Pricing and margin calculations
# - Linked mailboxes
#
# Usage:
#   subscription = EmailSubscription.create!(
#     contact: contact,
#     organization: organization,
#     domain: "example.com",
#     retail_price: 30.00,
#     wholesale_cost: 15.00
#   )
#
# SSoT (Feb 2026): Uses Tenant for isolation, Organization deprecated.
#
class EmailSubscription < ApplicationRecord
  belongs_to :contact
  # SSoT (Feb 2026): Tenant is THE ONE for multi-tenancy isolation
  belongs_to :tenant
  # DEPRECATED: Organization - kept for backwards compatibility
  belongs_to :organization, optional: true

  has_many :email_mailboxes, dependent: :destroy
  has_many :email_migrations, dependent: :destroy
  has_many :email_subscription_invoices, dependent: :destroy
  has_many :email_migration_invites, dependent: :destroy
  has_many :email_aliases, dependent: :destroy
  has_many :email_dns_records, dependent: :destroy

  # Constants
  STATUSES = %w[pending active suspended cancelled].freeze
  BILLING_INTERVALS = %w[monthly annual].freeze

  # Validations
  validates :domain, presence: true
  # SSoT (Feb 2026): Uniqueness now scoped to tenant
  validates :contact_id, uniqueness: { scope: :tenant_id }
  validates :status, inclusion: { in: STATUSES }
  validates :billing_interval, inclusion: { in: BILLING_INTERVALS }

  # Scopes
  scope :active, -> { where(status: "active") }
  scope :pending, -> { where(status: "pending") }
  scope :billable, -> { active.where("next_billing_date <= ?", Date.current) }
  scope :for_contact, ->(contact) { where(contact: contact) }
  # SSoT (Feb 2026): Tenant-scoped lookup
  scope :for_tenant, ->(tenant) { where(tenant: tenant) }
  # DEPRECATED: Use for_tenant instead
  scope :for_organization, ->(org) { where(tenant_id: org.respond_to?(:tenant_id) ? org.tenant_id : org.id) }

  # Callbacks
  before_validation :set_defaults, on: :create

  # Calculate monthly cost based on current mailboxes
  def calculate_monthly_cost
    EmailPricingService.calculate(
      mailbox_count: email_mailboxes.active.users.count,
      shared_mailbox_count: email_mailboxes.active.shared.count,
      storage_gb: total_storage_gb
    )
  end

  # Profit margin calculations
  def margin_amount
    return 0 unless retail_price && wholesale_cost
    retail_price - wholesale_cost
  end

  def margin_percentage
    return 0 if retail_price.blank? || retail_price.zero?
    (margin_amount / retail_price * 100).round(2)
  end

  # Status helpers
  def active?
    status == "active"
  end

  def cancelled?
    status == "cancelled"
  end

  def has_stripe_subscription?
    stripe_subscription_id.present?
  end

  # Sync mailbox count from actual records
  def sync_mailbox_count!
    update!(
      mailbox_count: email_mailboxes.active.count,
      total_storage_gb: email_mailboxes.active.sum(:storage_quota_gb)
    )
  end

  private

  def set_defaults
    self.status ||= "pending"
    self.billing_interval ||= "monthly"
    self.mailbox_count ||= 0
    self.total_storage_gb ||= 0
  end
end
