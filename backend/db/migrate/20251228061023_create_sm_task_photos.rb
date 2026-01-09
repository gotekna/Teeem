# frozen_string_literal: true

# SmTaskPhoto - Photos attached to SM tasks for field documentation
#
# Creates the base sm_task_photos table that Site Presence extends.
#
class CreateSmTaskPhotos < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_task_photos do |t|
      # Task is optional for site presence check-in photos
      t.references :sm_task, foreign_key: { to_table: :sm_tasks, on_delete: :cascade }
      t.references :job, foreign_key: { to_table: :jobs, on_delete: :cascade }
      t.references :uploaded_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.references :resource, foreign_key: { to_table: :sm_resources, on_delete: :nullify }

      t.string :photo_url, null: false
      t.string :photo_type, limit: 20            # completion, progress, issue, before, after, general
      t.text :description
      t.text :notes

      t.datetime :taken_at

      # GPS from photo EXIF (basic - extended in site_presence migration)
      t.decimal :latitude, precision: 10, scale: 7
      t.decimal :longitude, precision: 10, scale: 7

      t.timestamps
    end

    # Indexes
    add_index :sm_task_photos, :photo_type
    add_index :sm_task_photos, :taken_at
    add_index :sm_task_photos, [:sm_task_id, :photo_type]
  end
end
