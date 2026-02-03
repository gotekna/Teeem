# World-Class Asset Register - Asset Disposal (sale/scrapping tracking)
class AssetDisposal < ApplicationRecord
  belongs_to :asset
  belongs_to :user
  belongs_to :replacement_asset, class_name: "Asset", optional: true

  # Disposal types
  DISPOSAL_TYPES = %w[sale trade_in scrapped lost stolen donated].freeze

  # Validations
  validates :disposal_date, presence: true
  validates :disposal_type, inclusion: { in: DISPOSAL_TYPES }
  validates :book_wdv_at_disposal, presence: true, numericality: true
  validates :tax_wdv_at_disposal, presence: true, numericality: true
  validates :book_gain_loss, presence: true, numericality: true
  validates :tax_gain_loss, presence: true, numericality: true
  validates :sale_proceeds, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :disposal_costs, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  # Callbacks
  before_validation :calculate_values
  after_create :mark_asset_disposed
  after_create :create_activity

  # Scopes
  scope :sales, -> { where(disposal_type: "sale") }
  scope :trade_ins, -> { where(disposal_type: "trade_in") }
  scope :scrapped, -> { where(disposal_type: "scrapped") }
  scope :in_financial_year, ->(fy) {
    dates = AssetDepreciationSchedule.parse_financial_year(fy)
    where(disposal_date: dates[:start]..dates[:end])
  }
  scope :with_gain, -> { where("book_gain_loss > 0") }
  scope :with_loss, -> { where("book_gain_loss < 0") }

  # Was this a gain or loss?
  def gain?
    book_gain_loss.positive?
  end

  def loss?
    book_gain_loss.negative?
  end

  def break_even?
    book_gain_loss.zero?
  end

  # Display-friendly disposal type
  def disposal_type_display
    disposal_type.humanize
  end

  private

  def calculate_values
    self.net_proceeds = (sale_proceeds || 0) - (disposal_costs || 0)
    self.book_gain_loss = net_proceeds - book_wdv_at_disposal
    self.tax_gain_loss = net_proceeds - tax_wdv_at_disposal

    # Balancing adjustment for tax purposes
    self.balancing_adjustment = tax_gain_loss
  end

  def mark_asset_disposed
    asset.update!(status: "disposed", sale_date: disposal_date)
  end

  def create_activity
    return unless asset.corporate.present?

    user_record = user || User.first
    asset.corporate.corporate_activities.create!(
      activity_type: "asset_disposed",
      description: "Asset disposed: #{asset.display_name} (#{disposal_type_display})",
      change_details: {
        asset_id: asset.id,
        disposal_type: disposal_type,
        sale_proceeds: sale_proceeds,
        book_gain_loss: book_gain_loss,
        tax_gain_loss: tax_gain_loss
      },
      user: user_record
    )
  rescue => e
    Rails.logger.error "Failed to create disposal activity: #{e.message}"
  end
end
