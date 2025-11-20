class WhsSwms < ApplicationRecord
  # Associations (belongs_to first, then has_many)
  belongs_to :construction, optional: true  # Nullable for company-wide SWMS
  belongs_to :created_by, class_name: 'User'
  belongs_to :approved_by, class_name: 'User', optional: true
  belongs_to :superseded_by, class_name: 'WhsSwms', optional: true

  has_many :whs_swms_hazards, dependent: :destroy
  has_many :whs_swms_controls, through: :whs_swms_hazards
  has_many :whs_swms_acknowledgments, dependent: :destroy
  has_many :whs_swms_that_supersede_this, class_name: 'WhsSwms', foreign_key: 'superseded_by_id'

  # Constants (define BEFORE validations)
  STATUSES = %w[draft pending_approval approved rejected superseded].freeze
  HIGH_RISK_TYPES = %w[
    excavation confined_spaces work_at_heights demolition asbestos_removal
    hot_works electrical_work plant_equipment_operation traffic_management
    structural_work custom
  ].freeze

  # Validations
  validates :swms_number, presence: true, uniqueness: true
  validates :title, presence: true
  validates :version, presence: true, numericality: { greater_than: 0 }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :high_risk_type, inclusion: { in: HIGH_RISK_TYPES }, allow_nil: true
  validates :company_wide, inclusion: { in: [true, false] }

  # Custom validations
  validate :must_have_construction_or_be_company_wide
  validate :cannot_approve_own_swms, on: :update

  # Callbacks
  before_validation :generate_swms_number, on: :create
  before_save :update_approval_timestamp
  before_save :update_superseded_timestamp
  after_create :create_approval_task_if_needed

  # Scopes
  scope :draft, -> { where(status: 'draft') }
  scope :pending_approval, -> { where(status: 'pending_approval') }
  scope :approved, -> { where(status: 'approved') }
  scope :rejected, -> { where(status: 'rejected') }
  scope :superseded, -> { where(status: 'superseded') }
  scope :company_wide, -> { where(company_wide: true) }
  scope :job_specific, -> { where(company_wide: false) }
  scope :for_construction, ->(construction_id) { where(construction_id: construction_id) }
  scope :by_high_risk_type, ->(type) { where(high_risk_type: type) }
  scope :active, -> { where.not(status: ['superseded', 'rejected']) }

  # State machine methods
  def can_approve?
    status == 'pending_approval'
  end

  def can_reject?
    status == 'pending_approval'
  end

  def can_supersede?
    status == 'approved'
  end

  def approve!(approving_user)
    return false unless can_approve?

    update!(
      status: 'approved',
      approved_by: approving_user,
      approved_at: Time.current
    )
  end

  def reject!(reason)
    return false unless can_reject?

    update!(
      status: 'rejected',
      rejection_reason: reason
    )
  end

  def submit_for_approval!
    return false if status != 'draft'

    update!(status: 'pending_approval')
  end

  def supersede!(new_swms)
    return false unless can_supersede?

    transaction do
      update!(
        status: 'superseded',
        superseded_by: new_swms,
        superseded_at: Time.current
      )

      # Copy hazards and controls to new SWMS if requested
      new_swms.copy_hazards_from(self) if new_swms.persisted?
    end
  end

  def copy_hazards_from(source_swms)
    source_swms.whs_swms_hazards.each do |hazard|
      new_hazard = whs_swms_hazards.create!(
        hazard_description: hazard.hazard_description,
        likelihood: hazard.likelihood,
        consequence: hazard.consequence,
        risk_score: hazard.risk_score,
        risk_level: hazard.risk_level,
        affected_persons: hazard.affected_persons,
        position: hazard.position
      )

      # Copy controls for this hazard
      hazard.whs_swms_controls.each do |control|
        new_hazard.whs_swms_controls.create!(
          control_description: control.control_description,
          control_type: control.control_type,
          responsibility: control.responsibility,
          residual_likelihood: control.residual_likelihood,
          residual_consequence: control.residual_consequence,
          residual_risk_score: control.residual_risk_score,
          residual_risk_level: control.residual_risk_level,
          position: control.position
        )
      end
    end
  end

  # Helper methods
  def pending_approval?
    status == 'pending_approval'
  end

  def approved?
    status == 'approved'
  end

  def draft?
    status == 'draft'
  end

  def requires_approval?
    !created_by.wphs_appointee?
  end

  def high_risk?
    high_risk_type.present?
  end

  def worker_acknowledgment_count
    whs_swms_acknowledgments.count
  end

  def acknowledged_by?(user_or_worker_name)
    if user_or_worker_name.is_a?(User)
      whs_swms_acknowledgments.exists?(user: user_or_worker_name)
    else
      whs_swms_acknowledgments.exists?(worker_name: user_or_worker_name)
    end
  end

  private

  def generate_swms_number
    return if swms_number.present?

    date_str = CompanySetting.today.strftime('%Y%m%d')
    last_swms = WhsSwms.where('swms_number LIKE ?', "SWMS-#{date_str}-%")
                        .order(:swms_number).last

    sequence = last_swms ? last_swms.swms_number.split('-').last.to_i + 1 : 1
    self.swms_number = "SWMS-#{date_str}-#{sequence.to_s.rjust(3, '0')}"
  end

  def update_approval_timestamp
    if status_changed? && status == 'approved'
      self.approved_at = Time.current
    end
  end

  def update_superseded_timestamp
    if status_changed? && status == 'superseded'
      self.superseded_at = Time.current
    end
  end

  def create_approval_task_if_needed
    # If created by WPHS Appointee, auto-approve
    if created_by.wphs_appointee?
      update_columns(status: 'approved', approved_by_id: created_by.id, approved_at: Time.current)
      return
    end

    # Otherwise, set to pending and create approval task
    update_column(:status, 'pending_approval') if status == 'draft'

    # Create approval task for WPHS Appointees
    create_swms_approval_task
  end

  def create_swms_approval_task
    return unless construction.present?

    # Find WPHS Appointees
    wphs_appointee = User.where(wphs_appointee: true).first
    return unless wphs_appointee.present?

    construction.project_tasks.create!(
      name: "Approve SWMS: #{title}",
      description: "Review and approve SWMS #{swms_number}",
      task_type: 'whs_approval',
      category: 'safety',
      status: 'not_started',
      assigned_to: wphs_appointee,
      planned_end_date: CompanySetting.today + 2.days,
      duration_days: 1,
      tags: ['whs', 'swms', 'approval']
    )
  rescue => e
    Rails.logger.error("Failed to create approval task for SWMS #{id}: #{e.message}")
    # Don't fail SWMS creation if task creation fails
  end

  def must_have_construction_or_be_company_wide
    if construction_id.blank? && !company_wide
      errors.add(:base, 'SWMS must be either linked to a job or marked as company-wide')
    end
  end

  def cannot_approve_own_swms
    if status_changed? && status == 'approved' && approved_by_id == created_by_id
      errors.add(:base, 'Cannot approve your own SWMS unless you are a WPHS Appointee')
    end
  end
end
