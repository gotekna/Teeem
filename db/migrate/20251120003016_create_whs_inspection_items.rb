class CreateWhsInspectionItems < ActiveRecord::Migration[8.0]
  def change
    create_table :whs_inspection_items do |t|
      t.references :whs_inspection, null: false, foreign_key: true

      # Item details
      t.string :item_description, null: false
      t.string :category # site_safety, equipment, housekeeping, traffic_management, etc.
      t.string :result # pass, fail, na, not_checked
      t.boolean :photo_required, default: false
      t.boolean :notes_required, default: false
      t.integer :weight, default: 1 # For scoring
      t.integer :position, default: 0 # For ordering

      # Response
      t.text :notes
      t.jsonb :photo_urls, default: [] # Array of photo URLs
      t.boolean :action_required, default: false

      t.timestamps
    end

    add_index :whs_inspection_items, :result
    add_index :whs_inspection_items, :action_required
  end
end
