# frozen_string_literal: true

# Fix invalid lookup_display_column for columns pointing to Contacts
# 'full_name' doesn't exist in Contacts - should be 'display_name'
#
# Affected columns:
# - contacts.primary_company_id (lookup → contacts, self-reference)
# - sm_resources.contact_id (lookup → contacts)
class FixContactsLookupDisplayColumns < ActiveRecord::Migration[8.0]
  def up
    # Fix #11: Contacts.primary_company_id
    contacts_foundation = Foundation.find_by(slug: 'contacts')
    if contacts_foundation
      col = contacts_foundation.columns.find_by(column_name: 'primary_company_id')
      if col && col.lookup_display_column == 'full_name'
        col.update!(lookup_display_column: 'display_name')
        puts "  ✅ Fixed Contacts.primary_company_id: full_name → display_name"
      end
    end

    # Fix #12: SM Resources.contact_id
    sm_resources_foundation = Foundation.find_by(slug: 'sm-resources')
    if sm_resources_foundation
      col = sm_resources_foundation.columns.find_by(column_name: 'contact_id')
      if col && col.lookup_display_column == 'full_name'
        col.update!(lookup_display_column: 'display_name')
        puts "  ✅ Fixed SM Resources.contact_id: full_name → display_name"
      end
    end
  end

  def down
    # Revert to full_name
    contacts_foundation = Foundation.find_by(slug: 'contacts')
    if contacts_foundation
      col = contacts_foundation.columns.find_by(column_name: 'primary_company_id')
      col&.update!(lookup_display_column: 'full_name')
    end

    sm_resources_foundation = Foundation.find_by(slug: 'sm-resources')
    if sm_resources_foundation
      col = sm_resources_foundation.columns.find_by(column_name: 'contact_id')
      col&.update!(lookup_display_column: 'full_name')
    end
  end
end
