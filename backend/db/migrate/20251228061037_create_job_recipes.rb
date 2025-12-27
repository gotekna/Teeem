class CreateJobRecipes < ActiveRecord::Migration[8.0]
  def change
    create_table :job_recipes do |t|
      t.references :job, null: false, foreign_key: true
      t.references :recipe, null: false, foreign_key: true
      t.decimal :quantity_multiplier
      t.decimal :applied_total
      t.text :notes
      t.datetime :applied_at
      t.references :applied_by, null: false, foreign_key: true

      t.timestamps
    end
  end
end
