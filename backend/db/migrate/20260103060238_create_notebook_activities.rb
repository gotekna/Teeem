# frozen_string_literal: true

class CreateNotebookActivities < ActiveRecord::Migration[8.0]
  def change
    create_table :notebook_activities do |t|
      t.references :notebook, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.references :page, foreign_key: { to_table: :notebook_pages }
      t.references :section, foreign_key: { to_table: :notebook_sections }
      t.string :activity_type, null: false
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :notebook_activities, :activity_type
    add_index :notebook_activities, :created_at
  end
end
