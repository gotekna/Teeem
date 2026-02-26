# frozen_string_literal: true

# QuoteTemplateTradeSupplier - A supplier assigned to a trade in a quote template
#
# When the template is applied to a job, each supplier becomes a QuoteTracker row
# for the parent trade. Preferred suppliers are highlighted in the UI.
#
class QuoteTemplateTradeSupplier < ApplicationRecord
  acts_as_tenant :tenant

  # Associations
  belongs_to :quote_template_trade
  belongs_to :supplier, class_name: "Contact"
  belongs_to :contact_person, class_name: "ContactPerson", optional: true

  # Validations
  validates :supplier_id, uniqueness: { scope: :quote_template_trade_id,
    message: "has already been added to this trade" }
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # Virtual: supplier name for display
  def supplier_name
    supplier&.display_name
  end

  def contact_person_name
    contact_person&.name
  end
end
