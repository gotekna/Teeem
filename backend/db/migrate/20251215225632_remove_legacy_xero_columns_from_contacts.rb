class RemoveLegacyXeroColumnsFromContacts < ActiveRecord::Migration[8.0]
  def up
    # Legacy Xero columns to remove - replaced by contact_external_links SSoT
    legacy_columns = %w[xero_id xero_contact_status xero_synced xero_disconnect]

    # 1. Remove from Foundation column metadata (so they don't appear in views)
    contacts_foundation = ::Foundation.find_by(database_table_name: 'contacts') ||
                         ::Foundation.find_by(slug: 'contacts')

    if contacts_foundation
      legacy_columns.each do |col_name|
        column = contacts_foundation.columns.find_by(column_name: col_name)
        if column
          puts "Removing Foundation column metadata: #{col_name}"
          column.destroy
        end
      end

      # 2. Clean up saved foundation views that reference these columns
      ::FoundationView.where(foundation_id: contacts_foundation.id).find_each do |view|
        updated = false

        # Clean columns (JSON array of column keys)
        if view.columns.is_a?(Array) && (view.columns & legacy_columns).any?
          view.columns = view.columns - legacy_columns
          updated = true
          puts "Cleaned columns in view: #{view.name}"
        end

        # Clean sort_order if it references a legacy column
        if view.sort_order.is_a?(Hash) && legacy_columns.include?(view.sort_order['column'])
          view.sort_order = {}
          updated = true
          puts "Cleaned sort_order in view: #{view.name}"
        end

        # Clean filters (JSON hash)
        if view.filters.is_a?(Hash)
          original_keys = view.filters.keys
          view.filters = view.filters.reject { |k, _| legacy_columns.include?(k) }
          if view.filters.keys != original_keys
            updated = true
            puts "Cleaned filters in view: #{view.name}"
          end
        end

        view.save! if updated
      end
    end

    # 3. Remove the actual database columns
    legacy_columns.each do |col_name|
      if column_exists?(:contacts, col_name)
        puts "Dropping column: contacts.#{col_name}"
        remove_column :contacts, col_name
      else
        puts "Column already removed: contacts.#{col_name}"
      end
    end

    puts "✅ Legacy Xero columns removed successfully"
  end

  def down
    # Restore columns (but data is gone)
    add_column :contacts, :xero_id, :string unless column_exists?(:contacts, :xero_id)
    add_column :contacts, :xero_contact_status, :string unless column_exists?(:contacts, :xero_contact_status)
    add_column :contacts, :xero_synced, :boolean unless column_exists?(:contacts, :xero_synced)
    add_column :contacts, :xero_disconnect, :boolean unless column_exists?(:contacts, :xero_disconnect)

    # Note: Foundation column metadata and view references would need to be manually restored
    puts "⚠️  Columns restored but data is lost. Foundation metadata needs manual restoration."
  end
end
