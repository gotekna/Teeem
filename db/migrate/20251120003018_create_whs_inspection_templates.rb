class CreateWhsInspectionTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :whs_inspection_templates do |t|
      # Template details
      t.string :name, null: false
      t.string :inspection_type # daily, weekly, monthly, ad_hoc
      t.string :category # site_safety, equipment, housekeeping, etc.
      t.text :description
      t.integer :pass_threshold_percentage, default: 80 # Overall pass score required
      t.boolean :active, default: true

      # Checklist items (JSONB array of objects)
      t.jsonb :checklist_items, default: []
      # Each item: { description, category, photo_required, notes_required, weight }

      # Metadata
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :whs_inspection_templates, :name
    add_index :whs_inspection_templates, :inspection_type
    add_index :whs_inspection_templates, :active
  end
end
