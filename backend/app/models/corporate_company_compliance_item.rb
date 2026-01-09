class CorporateCompanyComplianceItem < ApplicationRecord
  # Associations
  belongs_to :corporate_company, foreign_key: "company_id"

  # Validations
  validates :title, presence: true
  validates :due_date, presence: true
  validates :item_type, inclusion: {
    in: %w[asic_annual_review tax_return solvency_declaration bas agm insurance_renewal license_renewal registration other]
  }, allow_blank: true

  # Scopes
  scope :pending, -> { where(completed: false) }
  scope :completed_items, -> { where(completed: true) }
  scope :overdue, -> { where("due_date < ? AND completed = ?", Date.today, false) }
  scope :due_soon, ->(days = 30) {
    where("due_date BETWEEN ? AND ? AND completed = ?", Date.today, days.days.from_now, false)
  }
  scope :by_type, ->(type) { where(item_type: type) }
  scope :recurring, -> { where.not(recurrence: nil) }

  # Instance methods
  def days_until_due
    return nil unless due_date.present?
    (due_date - Date.today).to_i
  end

  def overdue?
    due_date.present? && due_date < Date.today && !completed
  end

  def due_soon?(days = 30)
    return false if overdue? || completed?
    due_date.present? && days_until_due <= days && days_until_due >= 0
  end

  def completed?
    completed == true
  end

  def mark_completed!
    update!(
      completed: true,
      completed_at: Time.current
    )

    # If recurring, create next occurrence
    create_next_occurrence if recurrence.present?
  end

  def formatted_item_type
    item_type.to_s.titleize.gsub("_", " ")
  end

  private

  def create_next_occurrence
    return unless recurrence.present?

    next_due_date = case recurrence
    when "annual"
                      due_date + 1.year
    when "quarterly"
                      due_date + 3.months
    when "monthly"
                      due_date + 1.month
    else
                      nil
    end

    return unless next_due_date.present?

    company.company_compliance_items.create!(
      item_type: item_type,
      title: title.gsub(/\d{4}/, next_due_date.year.to_s),
      description: description,
      due_date: next_due_date,
      completed: false,
      asic_related: asic_related,
      ato_related: ato_related,
      recurrence: recurrence
    )
  end
end
