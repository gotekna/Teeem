class FixInternalTeamToUsers < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Remove existing foreign keys to contacts
    remove_foreign_key :jobs, column: :supervisor_id
    remove_foreign_key :jobs, column: :site_coordinator_id
    remove_foreign_key :jobs, column: :estimator_id
    remove_foreign_key :jobs, column: :internal_sales_id
    remove_foreign_key :jobs, column: :client_coordinator_id

    # Step 2: Clear the data (contact IDs won't match user IDs)
    execute "UPDATE jobs SET supervisor_id = NULL, site_coordinator_id = NULL, estimator_id = NULL, internal_sales_id = NULL, client_coordinator_id = NULL"

    # Step 3: Add new foreign keys to users
    add_foreign_key :jobs, :users, column: :supervisor_id, on_delete: :nullify
    add_foreign_key :jobs, :users, column: :site_coordinator_id, on_delete: :nullify
    add_foreign_key :jobs, :users, column: :estimator_id, on_delete: :nullify
    add_foreign_key :jobs, :users, column: :internal_sales_id, on_delete: :nullify
    add_foreign_key :jobs, :users, column: :client_coordinator_id, on_delete: :nullify

    # Step 4: Update Foundation columns to lookup user-management
    jobs_foundation = Foundation.find_by(slug: 'jobs')
    users_foundation = Foundation.find_by(slug: 'user-management')

    return unless jobs_foundation && users_foundation

    %w[supervisor_id site_coordinator_id estimator_id internal_sales_id client_coordinator_id].each do |column_name|
      column = Column.find_by(foundation_id: jobs_foundation.id, column_name: column_name)
      next unless column

      column.update!(
        lookup_foundation_id: users_foundation.id,
        lookup_foundation_slug: 'user-management',
        lookup_display_column: 'name'
      )
    end
  end

  def down
    # Reverse: change back to contacts
    remove_foreign_key :jobs, column: :supervisor_id
    remove_foreign_key :jobs, column: :site_coordinator_id
    remove_foreign_key :jobs, column: :estimator_id
    remove_foreign_key :jobs, column: :internal_sales_id
    remove_foreign_key :jobs, column: :client_coordinator_id

    execute "UPDATE jobs SET supervisor_id = NULL, site_coordinator_id = NULL, estimator_id = NULL, internal_sales_id = NULL, client_coordinator_id = NULL"

    add_foreign_key :jobs, :contacts, column: :supervisor_id, on_delete: :nullify
    add_foreign_key :jobs, :contacts, column: :site_coordinator_id, on_delete: :nullify
    add_foreign_key :jobs, :contacts, column: :estimator_id, on_delete: :nullify
    add_foreign_key :jobs, :contacts, column: :internal_sales_id, on_delete: :nullify
    add_foreign_key :jobs, :contacts, column: :client_coordinator_id, on_delete: :nullify

    # Revert Foundation columns to contacts
    jobs_foundation = Foundation.find_by(slug: 'jobs')
    contacts_foundation = Foundation.find_by(slug: 'contacts')

    return unless jobs_foundation && contacts_foundation

    %w[supervisor_id site_coordinator_id estimator_id internal_sales_id client_coordinator_id].each do |column_name|
      column = Column.find_by(foundation_id: jobs_foundation.id, column_name: column_name)
      next unless column

      column.update!(
        lookup_foundation_id: contacts_foundation.id,
        lookup_foundation_slug: 'contacts',
        lookup_display_column: 'display_name'
      )
    end
  end
end
