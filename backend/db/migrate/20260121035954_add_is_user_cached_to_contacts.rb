# frozen_string_literal: true

# Phase 3: Contact Consolidation - Add is_user_cached flag to Contacts
#
# SSoT: This flag indicates whether a Contact has a linked User account
# - true = Contact has a User (can login)
# - false = Contact does not have a User (cannot login)
#
# This flag is CACHED/DENORMALIZED for performance.
# SSoT for whether a user exists is still the User.contact_id relationship.
# This flag is updated via callbacks in User model.
#
class AddIsUserCachedToContacts < ActiveRecord::Migration[8.0]
  def up
    # Add the column
    add_column :contacts, :is_user_cached, :boolean, default: false, null: false

    # Add index for efficient filtering of "users" vs "non-users"
    add_index :contacts, :is_user_cached, name: 'index_contacts_on_is_user_cached'

    # Backfill: Set is_user_cached = true for all Contacts that have a linked User
    execute <<-SQL.squish
      UPDATE contacts
      SET is_user_cached = true
      WHERE id IN (SELECT contact_id FROM users WHERE contact_id IS NOT NULL)
    SQL

    count = Contact.where(is_user_cached: true).count
    say "Updated #{count} Contacts with is_user_cached=true"
  end

  def down
    remove_index :contacts, :is_user_cached, if_exists: true
    remove_column :contacts, :is_user_cached
  end
end
