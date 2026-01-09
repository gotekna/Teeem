# frozen_string_literal: true

# Gold Standard Search Infrastructure - Phase 1: Columns + Indexes
#
# Adds tsvector 'searchable' columns and GIN indexes for fast full-text search.
# Triggers are created in a separate migration.
#
# Tables affected:
# - email_warehouse: Add missing GIN index (column exists)
# - corporate_company_documents: Add column + index
# - jobs: Add column + index
# - contacts: Add column + index (includes suppliers)
# - sm_tasks: Add column + index
# - purchase_orders: Add column + index
#
class AddSearchInfrastructure < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!  # Required for CONCURRENTLY index creation

  def up
    # 1. email_warehouse - Already has tsvector column, just needs GIN index
    unless index_exists?(:email_warehouse, :searchable, using: :gin)
      add_index :email_warehouse, :searchable,
                using: :gin,
                name: "idx_email_warehouse_searchable_gin",
                algorithm: :concurrently
    end

    # 2. corporate_company_documents
    unless column_exists?(:corporate_company_documents, :searchable)
      add_column :corporate_company_documents, :searchable, :tsvector
    end
    unless index_exists?(:corporate_company_documents, :searchable, using: :gin)
      add_index :corporate_company_documents, :searchable,
                using: :gin,
                name: "idx_documents_searchable_gin",
                algorithm: :concurrently
    end

    # 3. jobs
    unless column_exists?(:jobs, :searchable)
      add_column :jobs, :searchable, :tsvector
    end
    unless index_exists?(:jobs, :searchable, using: :gin)
      add_index :jobs, :searchable,
                using: :gin,
                name: "idx_jobs_searchable_gin",
                algorithm: :concurrently
    end

    # 4. contacts (includes suppliers)
    unless column_exists?(:contacts, :searchable)
      add_column :contacts, :searchable, :tsvector
    end
    unless index_exists?(:contacts, :searchable, using: :gin)
      add_index :contacts, :searchable,
                using: :gin,
                name: "idx_contacts_searchable_gin",
                algorithm: :concurrently
    end

    # 5. sm_tasks
    unless column_exists?(:sm_tasks, :searchable)
      add_column :sm_tasks, :searchable, :tsvector
    end
    unless index_exists?(:sm_tasks, :searchable, using: :gin)
      add_index :sm_tasks, :searchable,
                using: :gin,
                name: "idx_sm_tasks_searchable_gin",
                algorithm: :concurrently
    end

    # 6. purchase_orders
    unless column_exists?(:purchase_orders, :searchable)
      add_column :purchase_orders, :searchable, :tsvector
    end
    unless index_exists?(:purchase_orders, :searchable, using: :gin)
      add_index :purchase_orders, :searchable,
                using: :gin,
                name: "idx_purchase_orders_searchable_gin",
                algorithm: :concurrently
    end
  end

  def down
    # Remove indexes first, then columns
    remove_index :email_warehouse, name: "idx_email_warehouse_searchable_gin", if_exists: true

    remove_index :corporate_company_documents, name: "idx_documents_searchable_gin", if_exists: true
    remove_column :corporate_company_documents, :searchable, if_exists: true

    remove_index :jobs, name: "idx_jobs_searchable_gin", if_exists: true
    remove_column :jobs, :searchable, if_exists: true

    remove_index :contacts, name: "idx_contacts_searchable_gin", if_exists: true
    remove_column :contacts, :searchable, if_exists: true

    remove_index :sm_tasks, name: "idx_sm_tasks_searchable_gin", if_exists: true
    remove_column :sm_tasks, :searchable, if_exists: true

    remove_index :purchase_orders, name: "idx_purchase_orders_searchable_gin", if_exists: true
    remove_column :purchase_orders, :searchable, if_exists: true
  end
end
