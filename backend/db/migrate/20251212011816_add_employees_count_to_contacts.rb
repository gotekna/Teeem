class AddEmployeesCountToContacts < ActiveRecord::Migration[8.0]
  def up
    # Add the column with default value
    add_column :contacts, :employees_count, :integer, default: 0, null: false

    # Backfill existing employee counts
    # For each company contact, count how many employees they have (contacts with primary_company_id = this contact's id)
    reversible do |dir|
      dir.up do
        execute <<-SQL.squish
          UPDATE contacts
          SET employees_count = (
            SELECT COUNT(*)
            FROM contacts AS employees
            WHERE employees.primary_company_id = contacts.id
          )
        SQL
      end
    end
  end

  def down
    remove_column :contacts, :employees_count
  end
end
