class AddTemplateIdsToCostCentres < ActiveRecord::Migration[8.0]
  def change
    add_column :cost_centres, :sm_schedule_master_template_ids, :jsonb, default: [], null: false
    add_index :cost_centres, :sm_schedule_master_template_ids, using: :gin
  end
end
