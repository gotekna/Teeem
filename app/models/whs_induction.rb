class WhsInduction < ApplicationRecord
  # Associations
  belongs_to :whs_induction_template, foreign_key: :whs_induction_template_id
  belongs_to :construction, optional: true
  belongs_to :user, optional: true
  belongs_to :conducted_by_user, class_name: 'User'

  # Constants
  STATUSES = %w[valid expired superseded].freeze
  INDUCTION_TYPES = %w[company_wide site_specific project_specific visitor].freeze

  # Validations
  validates :certificate_number, presence: true, uniqueness: true
  validates :induction_type, presence: true, inclusion: { in: INDUCTION_TYPES }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :worker_name, presence: true
  validates :completion_date, presence: true
  validate :quiz_score_must_pass, if: :has_quiz?

  # Callbacks
  before_validation :generate_certificate_number, on: :create
  before_validation :calculate_expiry_date, on: :create
  before_save :check_expiry_status

  # Scopes
  scope :valid, -> { where(status: 'valid') }
  scope :expired, -> { where(status: 'expired') }
  scope :expiring_soon, ->(days = 30) {
    where(status: 'valid')
      .where('expiry_date IS NOT NULL AND expiry_date <= ?', CompanySetting.today + days.days)
  }
  scope :for_construction, ->(construction_id) { where(construction_id: construction_id) }
  scope :by_type, ->(type) { where(induction_type: type) }
  scope :by_worker, ->(name) { where('worker_name ILIKE ?', "%#{name}%") }
  scope :recent, -> { order(completion_date: :desc) }

  # Helper methods
  def expired?
    status == 'expired' || (expiry_date.present? && expiry_date < CompanySetting.today)
  end

  def expiring_soon?(days = 30)
    return false unless expiry_date.present?
    return false if expired?

    expiry_date <= CompanySetting.today + days.days
  end

  def days_until_expiry
    return nil unless expiry_date.present?
    return 0 if expired?

    (expiry_date - CompanySetting.today).to_i
  end

  def has_quiz?
    whs_induction_template.has_quiz?
  end

  def quiz_passing_score
    whs_induction_template.min_passing_score || 80
  end

  def quiz_passed?
    return true unless has_quiz?
    return false unless quiz_score.present?

    quiz_score >= quiz_passing_score
  end

  def worker_display_name
    worker_company.present? ? "#{worker_name} (#{worker_company})" : worker_name
  end

  def supersede!(new_induction)
    transaction do
      update!(status: 'superseded')
      new_induction.save! if new_induction.new_record?
    end
  end

  private

  def generate_certificate_number
    return if certificate_number.present?

    date_str = CompanySetting.today.strftime('%Y%m%d')
    last_induction = WhsInduction.where('certificate_number LIKE ?', "IND-#{date_str}-%")
                                  .order(:certificate_number).last

    sequence = last_induction ? last_induction.certificate_number.split('-').last.to_i + 1 : 1
    self.certificate_number = "IND-#{date_str}-#{sequence.to_s.rjust(3, '0')}"
  end

  def calculate_expiry_date
    return if expiry_date.present?
    return unless whs_induction_template.expiry_months.present?

    self.expiry_date = (completion_date || Time.current).to_date + whs_induction_template.expiry_months.months
  end

  def check_expiry_status
    if expiry_date.present? && expiry_date < CompanySetting.today && status == 'valid'
      self.status = 'expired'
    end
  end

  def quiz_score_must_pass
    unless quiz_passed?
      errors.add(:quiz_score, "must be at least #{quiz_passing_score}%")
    end
  end
end
