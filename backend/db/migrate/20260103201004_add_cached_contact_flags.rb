class AddCachedContactFlags < ActiveRecord::Migration[8.0]
  # Cached boolean columns to avoid expensive EXISTS queries
  # Previously is_customer?, is_supplier?, is_director? caused ~1,130 queries per index request
  # These cached columns are updated via callbacks on related models

  def up
    # Add cached columns with default false (if_not_exists for idempotency)
    add_column :contacts, :is_customer_cached, :boolean, default: false, null: false unless column_exists?(:contacts, :is_customer_cached)
    add_column :contacts, :is_supplier_cached, :boolean, default: false, null: false unless column_exists?(:contacts, :is_supplier_cached)
    add_column :contacts, :is_director_cached, :boolean, default: false, null: false unless column_exists?(:contacts, :is_director_cached)

    # Add indexes for filtering (if_not_exists for idempotency)
    add_index :contacts, :is_customer_cached, if_not_exists: true
    add_index :contacts, :is_supplier_cached, if_not_exists: true
    add_index :contacts, :is_director_cached, if_not_exists: true

    # Backfill is_customer_cached (contacts with jobs or job_contacts)
    execute <<-SQL
      UPDATE contacts SET is_customer_cached = true
      WHERE id IN (
        SELECT DISTINCT contact_id FROM job_contacts WHERE contact_id IS NOT NULL
      );
    SQL

    # Backfill is_supplier_cached (contacts with POs, pricebooks, price histories, or bills)
    execute <<-SQL
      UPDATE contacts SET is_supplier_cached = true
      WHERE id IN (
        SELECT supplier_id FROM purchase_orders WHERE supplier_id IS NOT NULL
        UNION
        SELECT supplier_id FROM pricebooks WHERE supplier_id IS NOT NULL
        UNION
        SELECT supplier_id FROM price_histories WHERE supplier_id IS NOT NULL
        UNION
        SELECT contact_id FROM external_invoices WHERE contact_id IS NOT NULL AND invoice_type = 'ACCPAY'
      );
    SQL

    # Backfill is_director_cached (contacts who are current directors)
    execute <<-SQL
      UPDATE contacts SET is_director_cached = true
      WHERE id IN (
        SELECT DISTINCT contact_id FROM corporate_company_directors
        WHERE is_current = true AND contact_id IS NOT NULL
      );
    SQL
  end

  def down
    remove_column :contacts, :is_customer_cached
    remove_column :contacts, :is_supplier_cached
    remove_column :contacts, :is_director_cached
  end
end
