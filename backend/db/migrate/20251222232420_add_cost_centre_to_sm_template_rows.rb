class AddCostCentreToSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    # Cost centre groups multiple POs together (e.g., "Structural Works", "Finishing")
    add_column :sm_template_rows, :cost_centre, :string
    add_index :sm_template_rows, :cost_centre
  end
end
