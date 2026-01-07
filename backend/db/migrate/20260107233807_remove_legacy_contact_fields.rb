# frozen_string_literal: true

# Migration to remove legacy contact fields after SSoT migration
#
# PREREQUISITE: All contact data must be in SSoT tables:
#   - contact_emails (replaces :email column)
#   - contact_phones (replaces :mobile_phone, :office_phone, :fax_phone columns)
#
# The Contact model now has method overrides that read from SSoT tables:
#   def email → primary_email (from contact_emails)
#   def mobile_phone → primary_mobile (from contact_phones)
#   def office_phone → primary_office_phone (from contact_phones)
#   def fax_phone → primary_fax (from contact_phones)
#
# Run `rails db:migrate` only after verifying:
#   1. All contacts have their data in SSoT tables
#   2. All critical paths tested (search, Xero sync, SMS, etc.)
#
class RemoveLegacyContactFields < ActiveRecord::Migration[8.0]
  def up
    # Safety check: Ensure no contacts have legacy data without SSoT records
    orphaned_emails = execute(<<~SQL).first["count"].to_i
      SELECT COUNT(*) as count FROM contacts c
      WHERE c.email IS NOT NULL
      AND c.email != ''
      AND NOT EXISTS (
        SELECT 1 FROM contact_emails ce
        WHERE ce.contact_id = c.id
      )
    SQL

    orphaned_phones = execute(<<~SQL).first["count"].to_i
      SELECT COUNT(*) as count FROM contacts c
      WHERE (c.mobile_phone IS NOT NULL AND c.mobile_phone != '')
         OR (c.office_phone IS NOT NULL AND c.office_phone != '')
         OR (c.fax_phone IS NOT NULL AND c.fax_phone != '')
      AND NOT EXISTS (
        SELECT 1 FROM contact_phones cp
        WHERE cp.contact_id = c.id
      )
    SQL

    if orphaned_emails > 0 || orphaned_phones > 0
      raise "Migration blocked: #{orphaned_emails} contacts with email only in legacy column, " \
            "#{orphaned_phones} contacts with phone only in legacy columns. " \
            "Run data migration first."
    end

    # Remove legacy columns
    remove_column :contacts, :email, :string
    remove_column :contacts, :mobile_phone, :string
    remove_column :contacts, :office_phone, :string
    remove_column :contacts, :fax_phone, :string

    # Remove any indexes on legacy columns (if they exist)
    remove_index :contacts, :email, if_exists: true
    remove_index :contacts, :mobile_phone, if_exists: true
  end

  def down
    # Re-add legacy columns
    add_column :contacts, :email, :string
    add_column :contacts, :mobile_phone, :string
    add_column :contacts, :office_phone, :string
    add_column :contacts, :fax_phone, :string

    # Optionally re-add indexes
    add_index :contacts, :email

    # Repopulate from SSoT tables
    execute(<<~SQL)
      UPDATE contacts c
      SET email = (
        SELECT ce.email FROM contact_emails ce
        WHERE ce.contact_id = c.id
        ORDER BY ce.is_primary DESC NULLS LAST, ce.position ASC NULLS LAST, ce.id ASC
        LIMIT 1
      )
    SQL

    execute(<<~SQL)
      UPDATE contacts c
      SET mobile_phone = (
        SELECT cp.phone_number FROM contact_phones cp
        WHERE cp.contact_id = c.id AND cp.phone_type = 'mobile'
        ORDER BY cp.is_primary DESC NULLS LAST, cp.position ASC NULLS LAST, cp.id ASC
        LIMIT 1
      )
    SQL

    execute(<<~SQL)
      UPDATE contacts c
      SET office_phone = (
        SELECT cp.phone_number FROM contact_phones cp
        WHERE cp.contact_id = c.id AND cp.phone_type = 'office'
        ORDER BY cp.is_primary DESC NULLS LAST, cp.position ASC NULLS LAST, cp.id ASC
        LIMIT 1
      )
    SQL

    execute(<<~SQL)
      UPDATE contacts c
      SET fax_phone = (
        SELECT cp.phone_number FROM contact_phones cp
        WHERE cp.contact_id = c.id AND cp.phone_type = 'fax'
        ORDER BY cp.is_primary DESC NULLS LAST, cp.position ASC NULLS LAST, cp.id ASC
        LIMIT 1
      )
    SQL
  end
end
