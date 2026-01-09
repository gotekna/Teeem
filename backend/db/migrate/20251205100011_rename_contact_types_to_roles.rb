class RenameContactTypesToRoles < ActiveRecord::Migration[8.0]
  def up
    # 1. Rename column (it's a PostgreSQL array type: string[])
    rename_column :contacts, :contact_types, :roles

    # 2. Clean data - clear from non-persons (column is PostgreSQL array)
    execute <<-SQL
      UPDATE contacts
      SET roles = '{}'
      WHERE entity_type IN ('company', 'trust', 'price_only')
        AND roles IS NOT NULL
        AND cardinality(roles) > 0;
    SQL

    # 3. Convert old values to new values (for persons only)
    Contact.reset_column_information
    Contact.unscoped.where(entity_type: 'person').find_each do |contact|
      next if contact.roles.blank?

      # Roles is a PostgreSQL array, Rails returns it as Ruby array
      current_roles = contact.roles || []

      # Map old → new
      new_roles = current_roles.map do |role|
        case role
        when 'customer', 'supplier', 'corporate', 'default_supplier', 'price_only'
          'Employee'
        when 'sales', 'land_agent'
          role # Keep as-is
        else
          nil # Remove invalid roles
        end
      end.compact.uniq

      # Update if changed
      contact.update_column(:roles, new_roles) if new_roles != current_roles
    end

    # 4. Update index name to match new column
    # Note: The GIN index on contact_types will automatically apply to the renamed column
    # Index: index_contacts_on_contact_types using: :gin
  end

  def down
    # Convert back
    Contact.reset_column_information
    Contact.unscoped.where(entity_type: 'person').find_each do |contact|
      next if contact.roles.blank?

      current_roles = contact.roles || []

      old_roles = current_roles.map do |role|
        case role
        when 'Employee'
          'customer' # Default back to customer
        else
          role
        end
      end.compact.uniq

      contact.update_column(:roles, old_roles)
    end

    rename_column :contacts, :roles, :contact_types
  end
end
