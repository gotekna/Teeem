# frozen_string_literal: true

# QuoteTemplateTrade - A PO Task (SmScheduleMaster) within a quote template
#
# Each entry references a PO Task and has many suppliers assigned to it.
# When the template is applied to a job, each supplier for each PO Task
# becomes a QuoteTracker row linked to the matching SmTask in that job.
#
# Pattern follows: PoTemplateItem (child of PoTemplatePack)
#
class QuoteTemplateTrade < ApplicationRecord
  acts_as_tenant :tenant

  # Associations
  belongs_to :quote_template
  belongs_to :sm_schedule_master
  belongs_to :sm_trade, optional: true # Legacy, kept for backward compat
  has_many :quote_template_trade_suppliers, -> { order(:position) }, dependent: :destroy

  accepts_nested_attributes_for :quote_template_trade_suppliers, allow_destroy: true

  # Validations
  validates :sm_schedule_master_id, uniqueness: { scope: :quote_template_id,
    message: "has already been added to this template" }
  validates :sm_schedule_master_id, presence: true
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # Virtual: task name for display
  def task_name
    sm_schedule_master&.name
  end

  # Legacy compat
  def trade_name
    task_name
  end

  def supplier_count
    quote_template_trade_suppliers.size
  end
end
