class CreateMinuteTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :minute_templates do |t|
      t.string :name, null: false
      t.string :template_type  # company, trust, general
      t.text :body  # Template content with placeholders
      t.jsonb :required_fields, default: []  # Fields needed to generate
      t.boolean :active, default: true

      t.timestamps
    end
    add_index :minute_templates, :name, unique: true
    add_index :minute_templates, :template_type
    add_index :minute_templates, :active
  end
end
