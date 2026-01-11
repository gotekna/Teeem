class AddInternalTeamColumnsToJobs < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Add new lookup columns
    add_column :jobs, :supervisor_id, :bigint
    add_column :jobs, :site_coordinator_id, :bigint
    add_column :jobs, :estimator_id, :bigint
    add_column :jobs, :internal_sales_id, :bigint
    add_column :jobs, :client_coordinator_id, :bigint

    # Add indexes for faster lookups
    add_index :jobs, :supervisor_id
    add_index :jobs, :site_coordinator_id
    add_index :jobs, :estimator_id
    add_index :jobs, :internal_sales_id
    add_index :jobs, :client_coordinator_id

    # Add foreign keys to contacts
    add_foreign_key :jobs, :contacts, column: :supervisor_id, on_delete: :nullify
    add_foreign_key :jobs, :contacts, column: :site_coordinator_id, on_delete: :nullify
    add_foreign_key :jobs, :contacts, column: :estimator_id, on_delete: :nullify
    add_foreign_key :jobs, :contacts, column: :internal_sales_id, on_delete: :nullify
    add_foreign_key :jobs, :contacts, column: :client_coordinator_id, on_delete: :nullify

    # Step 2: Migrate data from job_contacts to new columns
    execute <<-SQL
      UPDATE jobs SET supervisor_id = (
        SELECT contact_id FROM job_contacts
        WHERE job_contacts.job_id = jobs.id
        AND job_contacts.role = 'supervisor'
        AND job_contacts.contact_id IS NOT NULL
        LIMIT 1
      );
    SQL

    execute <<-SQL
      UPDATE jobs SET site_coordinator_id = (
        SELECT contact_id FROM job_contacts
        WHERE job_contacts.job_id = jobs.id
        AND job_contacts.role = 'site_coordinator'
        AND job_contacts.contact_id IS NOT NULL
        LIMIT 1
      );
    SQL

    execute <<-SQL
      UPDATE jobs SET estimator_id = (
        SELECT contact_id FROM job_contacts
        WHERE job_contacts.job_id = jobs.id
        AND job_contacts.role = 'estimator'
        AND job_contacts.contact_id IS NOT NULL
        LIMIT 1
      );
    SQL

    execute <<-SQL
      UPDATE jobs SET internal_sales_id = (
        SELECT contact_id FROM job_contacts
        WHERE job_contacts.job_id = jobs.id
        AND job_contacts.role = 'internal_sales'
        AND job_contacts.contact_id IS NOT NULL
        LIMIT 1
      );
    SQL

    # Note: 'coordinator' role in job_contacts maps to client_coordinator
    execute <<-SQL
      UPDATE jobs SET client_coordinator_id = (
        SELECT contact_id FROM job_contacts
        WHERE job_contacts.job_id = jobs.id
        AND job_contacts.role = 'coordinator'
        AND job_contacts.contact_id IS NOT NULL
        LIMIT 1
      );
    SQL

    # Step 3: Remove legacy text columns
    remove_column :jobs, :site_supervisor_name
    remove_column :jobs, :site_supervisor_phone
  end

  def down
    # Re-add legacy columns
    add_column :jobs, :site_supervisor_name, :string, default: "Andrew Clement"
    add_column :jobs, :site_supervisor_phone, :string, default: "0407 150 081"

    # Remove foreign keys
    remove_foreign_key :jobs, column: :supervisor_id
    remove_foreign_key :jobs, column: :site_coordinator_id
    remove_foreign_key :jobs, column: :estimator_id
    remove_foreign_key :jobs, column: :internal_sales_id
    remove_foreign_key :jobs, column: :client_coordinator_id

    # Remove indexes
    remove_index :jobs, :supervisor_id
    remove_index :jobs, :site_coordinator_id
    remove_index :jobs, :estimator_id
    remove_index :jobs, :internal_sales_id
    remove_index :jobs, :client_coordinator_id

    # Remove columns
    remove_column :jobs, :supervisor_id
    remove_column :jobs, :site_coordinator_id
    remove_column :jobs, :estimator_id
    remove_column :jobs, :internal_sales_id
    remove_column :jobs, :client_coordinator_id
  end
end
