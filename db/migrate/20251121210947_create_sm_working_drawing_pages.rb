class CreateSmWorkingDrawingPages < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_working_drawing_pages do |t|
      # Foreign Keys
      t.references :task, null: false, foreign_key: { to_table: :sm_tasks, on_delete: :cascade }

      # Page Information
      t.integer :page_number, null: false
      t.text :image_url, null: false

      # AI Categorization
      t.string :category, null: false, limit: 100
      t.decimal :ai_confidence, precision: 5, scale: 4

      # Manual Override
      t.boolean :category_overridden, default: false
      t.string :manual_category, limit: 100

      t.timestamps
    end

    # Indexes
    add_index :sm_working_drawing_pages, :category
    add_index :sm_working_drawing_pages, [:task_id, :page_number], unique: true
  end
end
