class SupplierRating < ApplicationRecord
  # Associations
  belongs_to :contact  # The supplier being rated
  belongs_to :rated_by_user, class_name: 'User'
  belongs_to :construction, optional: true
  belongs_to :purchase_order, optional: true

  # Validations
  validates :contact_id, presence: true
  validates :rated_by_user_id, presence: true
  validates :quality_rating, numericality: { greater_than_or_equal_to: 1, less_than_or_equal_to: 5 }, allow_nil: true
  validates :timeliness_rating, numericality: { greater_than_or_equal_to: 1, less_than_or_equal_to: 5 }, allow_nil: true
  validates :communication_rating, numericality: { greater_than_or_equal_to: 1, less_than_or_equal_to: 5 }, allow_nil: true
  validates :professionalism_rating, numericality: { greater_than_or_equal_to: 1, less_than_or_equal_to: 5 }, allow_nil: true
  validates :value_rating, numericality: { greater_than_or_equal_to: 1, less_than_or_equal_to: 5 }, allow_nil: true

  # Callbacks
  before_save :calculate_overall_rating
  after_save :update_contact_rating
  after_destroy :update_contact_rating

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_supplier, ->(contact_id) { where(contact_id: contact_id) }
  scope :by_construction, ->(construction_id) { where(construction_id: construction_id) }
  scope :by_purchase_order, ->(po_id) { where(purchase_order_id: po_id) }
  scope :with_ratings, -> { where.not(overall_rating: nil) }

  # Instance methods
  def rating_categories
    {
      quality: quality_rating,
      timeliness: timeliness_rating,
      communication: communication_rating,
      professionalism: professionalism_rating,
      value: value_rating
    }
  end

  def rating_categories_present
    rating_categories.compact
  end

  def has_all_ratings?
    [quality_rating, timeliness_rating, communication_rating,
     professionalism_rating, value_rating].all?(&:present?)
  end

  def rating_summary
    {
      overall: overall_rating&.round(2),
      quality: quality_rating,
      timeliness: timeliness_rating,
      communication: communication_rating,
      professionalism: professionalism_rating,
      value: value_rating,
      total_categories: 5,
      rated_categories: rating_categories_present.size
    }
  end

  private

  def calculate_overall_rating
    ratings = rating_categories_present.values
    if ratings.any?
      self.overall_rating = (ratings.sum.to_f / ratings.size).round(2)
    else
      self.overall_rating = nil
    end
  end

  def update_contact_rating
    return unless contact

    # Calculate average of all ratings for this supplier
    all_ratings = contact.supplier_ratings.with_ratings

    if all_ratings.any?
      average = all_ratings.average(:overall_rating)
      count = all_ratings.count

      contact.update_columns(
        teeem_rating: average&.round(2),
        total_ratings_count: count
      )
    else
      contact.update_columns(
        teeem_rating: nil,
        total_ratings_count: 0
      )
    end
  end
end
