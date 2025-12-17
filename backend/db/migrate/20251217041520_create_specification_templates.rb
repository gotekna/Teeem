class CreateSpecificationTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :specification_templates do |t|
      t.string :name, null: false
      t.references :job_type, foreign_key: true
      t.jsonb :sections, default: []
      t.boolean :is_default, default: false
      t.boolean :is_active, default: true

      t.timestamps
    end
  end
end
