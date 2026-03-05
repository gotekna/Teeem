class ClaimStageTemplate < ApplicationRecord
  acts_as_tenant :tenant, has_global_records: true
  include ConfigSyncable
  include GlobalConfigRecord

  # Associations
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :updated_by, class_name: "User", optional: true
  has_many :lines, class_name: "ClaimStageTemplateLine", dependent: :destroy

  accepts_nested_attributes_for :lines, allow_destroy: true

  # Validations
  validates :name, presence: true, length: { maximum: 100 },
                   uniqueness: { scope: :tenant_id, case_sensitive: false }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:position, :name) }

  def line_count
    lines.size
  end

  def total_percentage
    lines.sum(&:percentage)
  end

  def percentages_valid?
    total_percentage == 100.0
  end
end
