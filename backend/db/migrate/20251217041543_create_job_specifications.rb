class CreateJobSpecifications < ActiveRecord::Migration[8.0]
  def change
    create_table :job_specifications do |t|
      t.references :job, null: false, foreign_key: { to_table: :jobs }
      t.string :section_key, null: false
      t.string :item_key, null: false
      t.references :pricebook_item, foreign_key: { to_table: :pricebook }
      t.string :custom_value
      t.text :notes
      t.integer :position, default: 0

      t.timestamps
    end

    add_index :job_specifications, [:job_id, :section_key, :item_key], unique: true, name: 'idx_job_specs_unique'
  end
end
