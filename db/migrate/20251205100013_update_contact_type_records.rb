class UpdateContactTypeRecords < ActiveRecord::Migration[8.0]
  def up
    # Remove old types
    ContactType.where(name: %w[customer supplier corporate default_supplier]).destroy_all

    # Add new roles (if ContactType table is used for dropdown options)
    new_roles = %w[Employee sales land_agent Director Company_Secretary Public_Officer CEO GM Owner]

    new_roles.each_with_index do |role, index|
      ContactType.find_or_create_by!(name: role) do |ct|
        ct.display_name = role.gsub('_', ' ')
        ct.tab_label = role.gsub('_', ' ')
        ct.position = index + 1  # Position must be > 0
        ct.active = true
      end
    end
  end

  def down
    # Restore old types
    old_types = %w[customer supplier corporate default_supplier]
    old_types.each_with_index do |type, index|
      ContactType.find_or_create_by!(name: type) do |ct|
        ct.display_name = type.capitalize
        ct.position = index + 1  # Position must be > 0
        ct.active = true
      end
    end

    # Remove new roles
    ContactType.where(name: Contact::ROLES).destroy_all
  end
end
