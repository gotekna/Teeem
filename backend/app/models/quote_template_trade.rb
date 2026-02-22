# frozen_string_literal: true

# QuoteTemplateTrade - A trade (category) within a quote template
#
# Each trade references an SM Trade and has many suppliers assigned to it.
# When the template is applied to a job, each supplier for each trade
# becomes a QuoteTracker row.
#
# Pattern follows: PoTemplateItem (child of PoTemplatePack)
#
class QuoteTemplateTrade < ApplicationRecord
  acts_as_tenant :tenant

  # Associations
  belongs_to :quote_template
  belongs_to :sm_trade
  has_many :quote_template_trade_suppliers, -> { order(:position) }, dependent: :destroy

  accepts_nested_attributes_for :quote_template_trade_suppliers, allow_destroy: true

  # Validations
  validates :sm_trade_id, uniqueness: { scope: :quote_template_id,
    message: "has already been added to this template" }
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # Virtual: trade name for display
  def trade_name
    sm_trade&.name
  end

  def supplier_count
    quote_template_trade_suppliers.size
  end
end
