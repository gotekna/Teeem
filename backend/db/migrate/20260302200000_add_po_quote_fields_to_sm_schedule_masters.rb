# frozen_string_literal: true

# SSoT: SmScheduleMaster is THE source for PO/quote task data.
# Previously tender_description, po_description, rfq_instructions, budget_amount
# lived only on CustomQuoteTemplateLine and PoTemplateItem (duplicated).
# Now SM owns them; templates delegate via effective_* methods.
class AddPoQuoteFieldsToSmScheduleMasters < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_schedule_masters, :tender_description, :text
    add_column :sm_schedule_masters, :po_description, :text
    add_column :sm_schedule_masters, :rfq_instructions, :text
    add_column :sm_schedule_masters, :budget_amount, :decimal, precision: 12, scale: 2
  end
end
