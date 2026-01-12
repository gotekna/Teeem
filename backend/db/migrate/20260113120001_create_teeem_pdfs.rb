class CreateTeeemPdfs < ActiveRecord::Migration[8.0]
  def change
    create_table :teeem_pdfs do |t|
      t.string :name, null: false, default: "Untitled PDF"
      t.jsonb :data, null: false, default: {}
      t.references :user, null: false, foreign_key: true
      t.references :job, null: true, foreign_key: true
      t.boolean :is_template, null: false, default: false
      t.text :description
      t.integer :page_count, null: false, default: 1

      t.timestamps
    end

    add_index :teeem_pdfs, :name
    add_index :teeem_pdfs, :is_template
    add_index :teeem_pdfs, [ :user_id, :updated_at ]
    add_index :teeem_pdfs, [ :job_id, :updated_at ]
  end
end
