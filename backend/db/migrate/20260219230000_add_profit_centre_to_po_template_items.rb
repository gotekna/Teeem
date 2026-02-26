# frozen_string_literal: true

class AddProfitCentreToPoTemplateItems < ActiveRecord::Migration[8.0]
  def change
    add_reference :po_template_items, :profit_centre, null: true, foreign_key: { on_delete: :nullify }
  end
end
