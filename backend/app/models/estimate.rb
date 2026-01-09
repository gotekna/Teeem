class Estimate < ApplicationRecord
  # Associations
  belongs_to :construction, optional: true
  has_many :estimate_line_items, dependent: :destroy
  has_many :purchase_orders, dependent: :nullify
  has_many :estimate_reviews, dependent: :destroy

  # Enums
  enum :status, {
    pending: "pending",
    matched: "matched",
    imported: "imported",
    rejected: "rejected"
  }, prefix: true, default: :pending

  # Validations
  validates :job_name_from_source, presence: true
  validates :source, presence: true
  validates :status, presence: true
  validates :total_items, numericality: { greater_than_or_equal_to: 0 }
  validates :match_confidence_score, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true

  # Scopes
  scope :unmatched, -> { where(status: "pending") }
  scope :matched, -> { where(status: "matched") }
  scope :from_unreal, -> { where(source: "unreal_engine") }

  # Callbacks
  after_create :set_imported_at

  # Methods
  def auto_matched?
    matched_automatically == true
  end

  def match_to_construction!(construction, confidence_score = nil)
    update!(
      construction: construction,
      status: :matched,
      match_confidence_score: confidence_score,
      matched_automatically: confidence_score.present?
    )
  end

  def import_to_purchase_orders!
    service = EstimateToPurchaseOrderService.new(self)
    result = service.execute

    raise StandardError, result[:error] unless result[:success]

    result
  end

  private

  def set_imported_at
    update_column(:imported_at, Time.current) if imported_at.nil?
  end
end
