class CreateUserAbsences < ActiveRecord::Migration[7.2]
  def change
    create_table :user_absences do |t|
      t.references :user, null: false, foreign_key: true
      t.date :start_date, null: false
      t.date :end_date, null: false
      t.string :absence_type, default: 'leave' # leave, sick, holiday, training, other

      # Approval workflow
      t.boolean :approved, default: false
      t.references :approved_by, foreign_key: { to_table: :users }, null: true
      t.datetime :approved_at

      # Notes
      t.text :notes

      t.timestamps
    end

    add_index :user_absences, [:user_id, :start_date, :end_date]
    add_index :user_absences, [:start_date, :end_date]
  end
end
