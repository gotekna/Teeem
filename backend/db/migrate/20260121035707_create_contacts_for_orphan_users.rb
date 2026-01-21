# frozen_string_literal: true

# Phase 2: Contact Consolidation - Create Contacts for Users without contact_id
#
# SSoT: Every User MUST have a Contact record (User is auth ONLY, Contact is identity)
#
# What this migration does:
# 1. For each User without contact_id:
#    - Create a Contact with entity_type='person'
#    - Parse User.name into Contact.first_name/last_name
#    - Set Contact.is_active = true
#    - Link User.contact_id to new Contact
# 2. Create contact_email record with label='login' for User.email
#
# Safety: This is a data migration only - no schema changes.
# Reversible: Can be rolled back (deletes created Contacts).
#
class CreateContactsForOrphanUsers < ActiveRecord::Migration[8.0]
  def up
    orphan_users = User.where(contact_id: nil)
    say "Found #{orphan_users.count} Users without contact_id"

    # Get default tenant for multi-tenancy
    default_tenant = Tenant.first
    say "Using default tenant: #{default_tenant&.id || 'NONE'}"

    orphan_users.find_each do |user|
      # Parse name into first_name and last_name
      name_parts = parse_name(user.name)
      tenant_id = user.tenant_id || default_tenant&.id

      # Get next contact ID for contact_code generation
      # Use raw SQL to get next ID from sequence
      next_id_result = execute("SELECT nextval('contacts_id_seq')")
      next_id = next_id_result.first['nextval'].to_i

      # Create Contact using direct SQL to avoid all validations and callbacks
      # This is safer in migrations than using ActiveRecord
      execute <<-SQL.squish
        INSERT INTO contacts (
          id, first_name, last_name, display_name, entity_type, is_active,
          is_team_contact, tenant_id, contact_code, created_at, updated_at
        ) VALUES (
          #{next_id},
          #{quote(name_parts[:first_name])},
          #{quote(name_parts[:last_name])},
          #{quote(user.name)},
          'person',
          true,
          false,
          #{tenant_id || 'NULL'},
          'C#{next_id}',
          NOW(),
          NOW()
        )
      SQL

      contact_id = next_id

      # Link User to Contact
      user.update_column(:contact_id, contact_id)

      # Create login email in contact_emails table using direct SQL
      execute <<-SQL.squish
        INSERT INTO contact_emails (contact_id, email, label, is_primary, position, created_at, updated_at)
        VALUES (#{contact_id}, #{quote(user.email)}, 'login', true, 0, NOW(), NOW())
      SQL

      # If User has mobile_phone, create contact_phone record
      if user.mobile_phone.present?
        execute <<-SQL.squish
          INSERT INTO contact_phones (contact_id, phone_number, phone_type, label, is_primary, position, created_at, updated_at)
          VALUES (#{contact_id}, #{quote(user.mobile_phone)}, 'mobile', 'work', true, 0, NOW(), NOW())
        SQL
      end

      say "Created Contact##{contact_id} (#{user.name}) for User##{user.id}"
    end

    say "Phase 2 Complete: #{orphan_users.count} Contacts created for orphan Users"
  end

  def down
    # Find Contacts that were created for Users and delete them
    # These are identified by: has a User linked and contact_email with label='login'
    User.where.not(contact_id: nil).find_each do |user|
      contact = user.contact
      next unless contact

      # Check if this Contact was created by this migration (has 'login' email matching User.email)
      login_email = contact.contact_emails.find_by(label: 'login')
      next unless login_email && login_email.email == user.email

      # Unlink User from Contact first
      user.update_column(:contact_id, nil)

      # Delete the Contact (cascade deletes contact_emails, contact_phones)
      contact.destroy!

      say "Deleted Contact##{contact.id} and unlinked from User##{user.id}"
    end
  end

  private

  # Parse a full name into first_name and last_name
  # Examples:
  #   "Robert Harder" -> { first_name: "Robert", last_name: "Harder" }
  #   "Robert" -> { first_name: "Robert", last_name: nil }
  #   "Robert John Harder" -> { first_name: "Robert", last_name: "Harder" }
  def parse_name(full_name)
    return { first_name: nil, last_name: nil } if full_name.blank?

    parts = full_name.strip.split(/\s+/)

    if parts.length == 1
      { first_name: parts[0], last_name: nil }
    elsif parts.length == 2
      { first_name: parts[0], last_name: parts[1] }
    else
      # For 3+ parts, first part is first_name, last part is last_name
      # (middle names are discarded - can be added manually later if needed)
      { first_name: parts[0], last_name: parts[-1] }
    end
  end
end
