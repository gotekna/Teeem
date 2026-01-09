class CreateJobRecipes < ActiveRecord::Migration[8.0]
  def change
    create_table :job_recipes do |t|
      t.references :job, null: false, foreign_key: true
      t.references :recipe, null: false, foreign_key: true
      t.decimal :quantity_multiplier, precision: 10, scale: 4, default: 1.0
      t.decimal :applied_total, precision: 12, scale: 2
      t.text :notes
      t.datetime :applied_at
      t.references :applied_by, foreign_key: { to_table: :users }
      t.string :status, default: 'applied' # applied, po_generated, archived

      t.timestamps
    end

    add_index :job_recipes, [:job_id, :recipe_id], unique: true
  end
end
