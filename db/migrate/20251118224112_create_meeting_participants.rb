class CreateMeetingParticipants < ActiveRecord::Migration[8.0]
  def change
    create_table :meeting_participants do |t|
      t.references :meeting, null: false, foreign_key: true
      t.references :user, foreign_key: true
      t.references :contact, foreign_key: true
      t.string :response_status, default: 'pending'  # pending, accepted, declined, tentative
      t.boolean :is_organizer, default: false
      t.boolean :is_required, default: true
      t.text :notes

      t.timestamps
    end

    add_index :meeting_participants, [ :meeting_id, :user_id ], unique: true, where: "user_id IS NOT NULL"
    add_index :meeting_participants, [ :meeting_id, :contact_id ], unique: true, where: "contact_id IS NOT NULL"
    add_index :meeting_participants, :response_status

    # Constraint: must have either user_id or contact_id
    add_check_constraint :meeting_participants,
      "(user_id IS NOT NULL AND contact_id IS NULL) OR (user_id IS NULL AND contact_id IS NOT NULL)",
      name: "meeting_participants_must_have_user_or_contact"
  end
end
