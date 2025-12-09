class CreateContactEmployments < ActiveRecord::Migration[8.0]
  def change
    create_table :contact_employments do |t|
      # The employee (person)
      t.references :employee, null: false, foreign_key: { to_table: :contacts }

      # The employer (company/trust)
      t.references :employer, null: false, foreign_key: { to_table: :contacts }

      # Employment details
      t.string :role              # e.g., "Accounts Manager", "Director", "Sales Rep"
      t.string :department        # e.g., "Accounts", "Sales", "Operations"
      t.boolean :is_primary, default: false  # Is this their main/primary employer?
      t.boolean :is_active, default: true    # Are they currently employed here?

      # Contact details specific to this employment
      t.string :work_email        # Their email at this company (if different from personal)
      t.string :work_phone        # Their work phone at this company
      t.string :extension         # Phone extension

      # Dates
      t.date :start_date
      t.date :end_date

      t.timestamps
    end

    # Ensure one employee can't have duplicate records for the same employer
    add_index :contact_employments, [ :employee_id, :employer_id ], unique: true, name: 'idx_employee_employer_unique', if_not_exists: true

    # Index for finding all employees of a company
    add_index :contact_employments, :employer_id, if_not_exists: true

    # Index for active employments
    add_index :contact_employments, [ :employee_id, :is_active ], if_not_exists: true
  end
end
