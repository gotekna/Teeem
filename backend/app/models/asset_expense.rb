# World-Class Asset Register - Asset Expense (cost tracking per asset)
class AssetExpense < ApplicationRecord
  belongs_to :asset
  belongs_to :user, optional: true
  belongs_to :financial_transaction, optional: true

  # SSoT: Link to deduplicated file storage (Jan 2026)
  belongs_to :storage_blob, optional: true

  # ActiveStorage has_one_attached :receipt was REMOVED (Jan 2026) - it violated SSoT.

  # Expense types
  EXPENSE_TYPES = %w[fuel repair registration toll parking insurance service parts cleaning other].freeze

  # Validations
  validates :expense_date, presence: true
  validates :expense_type, inclusion: { in: EXPENSE_TYPES }
  validates :amount, presence: true, numericality: { greater_than: 0 }

  # Scopes
  scope :chronological, -> { order(expense_date: :asc) }
  scope :reverse_chronological, -> { order(expense_date: :desc) }
  scope :by_type, ->(type) { where(expense_type: type) }
  scope :for_date_range, ->(start_date, end_date) { where(expense_date: start_date..end_date) }
  scope :synced_to_xero, -> { where.not(synced_to_xero_at: nil) }
  scope :not_synced_to_xero, -> { where(synced_to_xero_at: nil) }
  scope :fuel, -> { where(expense_type: "fuel") }
  scope :repairs, -> { where(expense_type: "repair") }
  scope :services, -> { where(expense_type: "service") }

  # Callbacks
  after_create :create_activity

  # Display-friendly expense type
  def expense_type_display
    expense_type.humanize
  end

  # Format amount as currency
  def formatted_amount
    "$#{sprintf('%.2f', amount)}"
  end

  # For financial year filtering
  scope :in_financial_year, ->(fy) {
    dates = AssetDepreciationSchedule.parse_financial_year(fy)
    where(expense_date: dates[:start]..dates[:end])
  }

  # Total expenses by type for an asset
  def self.totals_by_type
    group(:expense_type).sum(:amount)
  end

  # Total cost of ownership (all expenses)
  def self.total_cost
    sum(:amount)
  end

  # Mark as synced to Xero
  def mark_synced!(invoice_id)
    update!(xero_invoice_id: invoice_id, synced_to_xero_at: Time.current)
  end

  # ========================================
  # StorageBlob Receipt Access (SSoT)
  # ========================================

  def has_receipt?
    storage_blob_id.present?
  end

  def receipt_url(expires_in: 3600)
    return nil unless storage_blob

    storage_blob.presigned_url(expires_in: expires_in)
  end

  def attach_receipt(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    storage_blob&.decrement_reference! if storage_blob_id.present?
    self.storage_blob = blob
    blob.increment_reference!
  end

  private

  def create_activity
    return unless asset.corporate_company.present?

    user_record = user || User.first
    asset.corporate_company.corporate_company_activities.create!(
      activity_type: "asset_expense_recorded",
      description: "#{expense_type_display} expense recorded for #{asset.display_name}: #{formatted_amount}",
      change_details: {
        asset_id: asset.id,
        expense_type: expense_type,
        amount: amount,
        vendor: vendor
      },
      user: user_record
    )
  rescue => e
    Rails.logger.error "Failed to create expense activity: #{e.message}"
  end
end
