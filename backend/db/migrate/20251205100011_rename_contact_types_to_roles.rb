class RenameContactTypesToRoles < ActiveRecord::Migration[8.0]
  def up
    # 1. Rename column
    rename_column :contacts, :contact_types, :roles

    # 2. Clean data - clear from non-persons (column stores JSON strings)
    execute <<-SQL
      UPDATE contacts
      SET roles = '[]'
      WHERE entity_type IN ('company', 'trust', 'default_supplier')
        AND roles IS NOT NULL
        AND roles != '[]';
    SQL

    # 3. Convert old values to new values (for persons only)
    Contact.unscoped.where(entity_type: 'person').find_each do |contact|
      next if contact.roles.blank?

      # Parse current roles (handle both JSON and array formats)
      current_roles = if contact.roles.is_a?(String)
                        JSON.parse(contact.roles) rescue []
      else
                        contact.roles
      end

      # Map old → new
      new_roles = current_roles.map do |role|
        case role
        when 'customer', 'supplier', 'corporate', 'default_supplier'
          'Employee'
        when 'sales', 'land_agent'
          role # Keep as-is
        else
          nil # Remove invalid roles
        end
      end.compact.uniq

      # Update (convert to JSON since column is text type)
      contact.update_column(:roles, new_roles.to_json) if new_roles != current_roles
    end

    # 4. Update index name to match new column
    # Note: The GIN index on contact_types will automatically apply to the renamed column
    # Index: index_contacts_on_contact_types using: :gin
  end

  def down
    # Convert back
    Contact.unscoped.where(entity_type: 'person').find_each do |contact|
      next if contact.roles.blank?

      current_roles = contact.roles.is_a?(String) ? (JSON.parse(contact.roles) rescue []) : contact.roles

      old_roles = current_roles.map do |role|
        case role
        when 'Employee'
          'customer' # Default back to customer
        else
          role
        end
      end.compact.uniq

      contact.update_column(:roles, old_roles.to_json)
    end

    rename_column :contacts, :roles, :contact_types
  end
end
