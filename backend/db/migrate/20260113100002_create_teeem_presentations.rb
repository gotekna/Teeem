class CreateTeeemPresentations < ActiveRecord::Migration[8.0]
  def change
    create_table :teeem_presentations do |t|
      t.string :name, null: false, default: "Untitled Presentation"
      t.jsonb :data, null: false, default: {}
      t.references :user, null: false, foreign_key: true
      t.references :job, null: true, foreign_key: true
      t.boolean :is_template, null: false, default: false
      t.text :description

      t.timestamps
    end

    add_index :teeem_presentations, :name
    add_index :teeem_presentations, :is_template
    add_index :teeem_presentations, [ :user_id, :updated_at ]
    add_index :teeem_presentations, [ :job_id, :updated_at ]
  end
end
