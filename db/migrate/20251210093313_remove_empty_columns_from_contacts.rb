class RemoveEmptyColumnsFromContacts < ActiveRecord::Migration[7.1]
  def up
    # Remove only truly unused empty columns (KEEP Xero-related fields)
    columns_to_remove = [
      # ABN verification fields (empty - not used for Xero)
      :abn_entity_name,
      :abn_entity_type,
      :abn_gst_registered,
      :abn_valid,
      :abn_verified_at,

      # Accounting summary fields (empty - not used for Xero)
      :accounts_payable_outstanding,
      :accounts_payable_overdue,
      :accounts_receivable_outstanding,
      :accounts_receivable_overdue,

      # Contact details (empty)
      :branch,
      :company_number,
      :contact_region,
      :contact_region_id,
      :date_of_birth,
      :drivers_licence,
      :passport_number,
      :photo_url,

      # Status fields (empty)
      :deleted,
      :employment_start_date,
      :employment_status,
      :primary_role,

      # Communication (empty)
      :avg_response_time,
      :fax_phone,
      :response_rate,

      # File system (empty)
      :drive_id,
      :folder_id,

      # Sync fields (empty)
      :last_synced_at,
      :notes,

      # Legacy relationship fields (empty or bad data)
      :director_id,        # Has legacy data (44 records with old IDs)
      :parent,
      :parent_id,

      # Rating/feedback (empty)
      :rating,
      :teeem_rating,
      :total_ratings_count,

      # Supplier (empty)
      :supplier_code,

      # System (empty)
      :sys_type_id,

      # TFN (empty - stored in CorporateCompany for companies)
      :tfn,

      # Xero sync error tracking (empty - but keep xero_contact_number for mapping)
      :xero_sync_error
    ]

    # NOTE: KEEPING these empty fields because they're used for Xero sync:
    # - bank_account_name, bank_account_number, bank_bsb
    # - default_purchase_account, default_sales_account
    # - bill_due_day, bill_due_type
    # - sales_due_day, sales_due_type
    # - xero_contact_number, xero_account_number
    # - default_discount

    puts "=" * 80
    puts "REMOVING EMPTY UNUSED COLUMNS FROM CONTACTS TABLE"
    puts "=" * 80
    puts "Columns to remove: #{columns_to_remove.count}"
    puts ""
    puts "SSoT Established:"
    puts "  ✅ KEEP: tax_number (ABN - syncs with CorporateCompany)"
    puts "  ✅ KEEP: primary_company_id (syncs from employee_of relationships)"
    puts "  ✅ KEEP: bank_* fields (empty but used for Xero sync)"
    puts "  ✅ KEEP: default_* fields (empty but used for Xero sync)"
    puts "  ✅ KEEP: bill_due_*, sales_due_* (empty but used for Xero sync)"
    puts "  ✅ KEEP: xero_contact_number, xero_account_number (used for Xero mapping)"
    puts "  ❌ REMOVE: tfn (empty - use CorporateCompany.tfn instead)"
    puts "  ❌ REMOVE: director_id (legacy data)"
    puts "  ❌ REMOVE: ABN verification fields (not used)"
    puts "  ❌ REMOVE: File system fields (not used)"
    puts ""

    # Get list of columns that actually exist
    existing_columns = ActiveRecord::Base.connection.columns(:contacts).map(&:name).map(&:to_sym)

    removed_count = 0
    columns_to_remove.each do |column|
      if existing_columns.include?(column)
        remove_column :contacts, column
        removed_count += 1
      else
        puts "  ⏭️  Skipping #{column} (already removed)"
      end
    end

    puts "✅ Removed #{removed_count} empty columns (#{columns_to_remove.count - removed_count} already removed)"
    puts "=" * 80
  end

  def down
    # Cannot restore - data was empty anyway
    puts "Cannot restore columns - they were empty"
  end
end
