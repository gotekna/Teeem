class CreateMeetingAgendaItems < ActiveRecord::Migration[8.0]
  def change
    create_table :meeting_agenda_items do |t|
      t.references :meeting, null: false, foreign_key: true
      t.string :title, null: false
      t.text :description
      t.integer :sequence_order, null: false
      t.integer :duration_minutes
      t.references :presenter, foreign_key: { to_table: :users }
      t.boolean :completed, default: false
      t.text :notes
      t.references :created_task, foreign_key: { to_table: :project_tasks }  # Action item created from this agenda item

      t.timestamps
    end

    add_index :meeting_agenda_items, [ :meeting_id, :sequence_order ]
    add_index :meeting_agenda_items, :completed
  end
end
