class CreateBankStatementTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :bank_statement_templates do |t|
      t.string :bank_code
      t.string :bank_name
      t.string :primary_color
      t.string :secondary_color
      t.string :text_on_primary
      t.string :account_type
      t.string :date_format
      t.jsonb :detection_patterns
      t.string :layout_style
      t.boolean :is_active

      t.timestamps
    end
    add_index :bank_statement_templates, :bank_code
  end
end
