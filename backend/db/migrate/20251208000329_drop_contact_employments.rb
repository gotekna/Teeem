# SSoT cleanup: Remove the deprecated contact_employments table
# Employment relationships are now managed via ContactRelationship with relationship_type="employee_of"
class DropContactEmployments < ActiveRecord::Migration[8.0]
  def up
    drop_table :contact_employments, if_exists: true
  end

  def down
    # Recreate the table if we need to rollback
    create_table :contact_employments do |t|
      t.references :employee, null: false, foreign_key: { to_table: :contacts }
      t.references :employer, null: false, foreign_key: { to_table: :contacts }
      t.string :role
      t.string :job_title
      t.string :department
      t.string :work_email
      t.string :work_phone
      t.string :employment_type
      t.date :start_date
      t.date :end_date
      t.boolean :is_primary, default: false
      t.boolean :is_active, default: true
      t.text :notes
      t.datetime :created_at, null: false
      t.datetime :updated_at, null: false
      t.string :created_by
      t.string :updated_by
      t.datetime :deactivated_at
      t.string :deactivation_reason
      t.integer :previous_employer_id
    end

    add_index :contact_employments, [ :employee_id, :employer_id ], unique: true
    add_index :contact_employments, [ :employer_id, :is_active ]
  end
end
