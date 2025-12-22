# DEPRECATED: Use SmTemplate instead
# This model is being replaced by SmTemplate as part of SSoT consolidation.
# See GANTT_SCHEDULE_MASTER_COMPLETE.md for migration details.
# Data has been migrated to SmTemplate. This model will be removed in a future release.
#
# Migration completed: 2024-12-22
# - 2 templates with 148 rows migrated to SmTemplate
# - Frontend updated to use /api/v1/sm_templates
#
class ScheduleTemplate < ApplicationRecord
  include Deprecatable

  # Log deprecation warning on any access
  after_find { log_deprecation("ScheduleTemplate is deprecated. Use SmTemplate instead.") }

  belongs_to :created_by, class_name: "User"
  has_many :schedule_template_rows, dependent: :destroy

  validates :name, presence: true, uniqueness: true
  validate :only_one_default, if: :is_default?

  scope :default_template, -> { where(is_default: true).first }
  scope :active, -> { order(created_at: :desc) }

  # Ensure only one template can be default
  def only_one_default
    if is_default? && ScheduleTemplate.where(is_default: true).where.not(id: id).exists?
      errors.add(:is_default, "Only one template can be set as default")
    end
  end

  # Clone this template
  def duplicate!(new_name:, created_by:)
    new_template = self.dup
    new_template.name = new_name
    new_template.created_by = created_by
    new_template.is_default = false

    new_template.transaction do
      new_template.save!
      schedule_template_rows.each do |row|
        new_row = row.dup
        new_row.schedule_template = new_template
        new_row.save!
      end
    end

    new_template
  end
end
