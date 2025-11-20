class WhsInspection < ApplicationRecord
  # Associations
  belongs_to :construction, optional: true
  belongs_to :whs_inspection_template, optional: true
  belongs_to :inspector_user, class_name: 'User', optional: true
  belongs_to :created_by, class_name: 'User'
  belongs_to :meeting, optional: true

  has_many :whs_inspection_items, dependent: :destroy
  has_many :whs_action_items, as: :actionable, dependent: :destroy

  # Constants
  STATUSES = %w[scheduled in_progress completed requires_action cancelled].freeze
  INSPECTION_TYPES = %w[daily weekly monthly pre_start equipment toolbox_talk ad_hoc].freeze

  # Validations
  validates :inspection_number, presence: true, uniqueness: true
  validates :inspection_type, presence: true, inclusion: { in: INSPECTION_TYPES }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :scheduled_date, presence: true

  # Callbacks
  before_validation :generate_inspection_number, on: :create
  before_save :calculate_compliance_score
  after_create :create_items_from_template

  # Scopes
  scope :scheduled, -> { where(status: 'scheduled') }
  scope :in_progress, -> { where(status: 'in_progress') }
  scope :completed, -> { where(status: 'completed') }
  scope :requires_action, -> { where(status: 'requires_action') }
  scope :for_construction, ->(construction_id) { where(construction_id: construction_id) }
  scope :by_type, ->(type) { where(inspection_type: type) }
  scope :overdue, -> { where('scheduled_date < ? AND status NOT IN (?)', CompanySetting.today, ['completed', 'cancelled']) }
  scope :upcoming, -> { where('scheduled_date >= ?', CompanySetting.today).order(:scheduled_date) }
  scope :with_critical_issues, -> { where(critical_issues_found: true) }

  # State machine methods
  def can_start?
    status == 'scheduled'
  end

  def can_complete?
    status == 'in_progress'
  end

  def start!
    return false unless can_start?

    update!(
      status: 'in_progress',
      started_at: Time.current,
      inspector_user: inspector_user || created_by
    )
  end

  def complete!
    return false unless can_complete?

    calculate_and_update_results

    final_status = critical_issues_found? || !overall_pass? ? 'requires_action' : 'completed'

    update!(
      status: final_status,
      completed_at: Time.current
    )
  end

  # Helper methods
  def overdue?
    scheduled_date < CompanySetting.today && !completed? && status != 'cancelled'
  end

  def completed?
    status == 'completed'
  end

  def passing?
    overall_pass?
  end

  def failed_items
    whs_inspection_items.where(result: 'fail')
  end

  def action_items_count
    whs_action_items.count
  end

  def open_action_items_count
    whs_action_items.where.not(status: ['completed', 'cancelled']).count
  end

  private

  def generate_inspection_number
    return if inspection_number.present?

    date_str = CompanySetting.today.strftime('%Y%m%d')
    last_inspection = WhsInspection.where('inspection_number LIKE ?', "INSP-#{date_str}-%")
                                    .order(:inspection_number).last

    sequence = last_inspection ? last_inspection.inspection_number.split('-').last.to_i + 1 : 1
    self.inspection_number = "INSP-#{date_str}-#{sequence.to_s.rjust(3, '0')}"
  end

  def create_items_from_template
    return unless whs_inspection_template.present?
    return if whs_inspection_items.any?

    template_items = whs_inspection_template.checklist_items || []

    template_items.each_with_index do |item, index|
      whs_inspection_items.create!(
        item_description: item['description'],
        category: item['category'],
        photo_required: item['photo_required'] || false,
        notes_required: item['notes_required'] || false,
        weight: item['weight'] || 1,
        position: index,
        result: 'not_checked'
      )
    end
  end

  def calculate_compliance_score
    return unless whs_inspection_items.any?

    items = whs_inspection_items
    self.total_items = items.count
    self.pass_count = items.where(result: 'pass').count
    self.fail_count = items.where(result: 'fail').count
    self.na_count = items.where(result: 'na').count

    # Calculate score (excluding NA items)
    scoreable_items = total_items - na_count
    return if scoreable_items.zero?

    self.compliance_score = (pass_count.to_f / scoreable_items * 100).round(2)

    # Determine overall pass based on template threshold or default 80%
    threshold = whs_inspection_template&.pass_threshold_percentage || 80
    self.overall_pass = compliance_score >= threshold

    # Check for critical issues
    self.critical_issues_found = whs_inspection_items.where(action_required: true).any?
  end

  def calculate_and_update_results
    calculate_compliance_score
    save if changed?
  end
end
