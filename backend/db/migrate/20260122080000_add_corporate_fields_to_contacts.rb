# frozen_string_literal: true

# Migration: Add corporate fields to contacts table
# Part of Contact SSoT Consolidation - Phase 1
#
# Purpose:
# Make Contact THE ONE SSoT for all entities (people, companies, trusts).
# CorporateCompany becomes an extension table for corporate-specific data,
# not a separate identity store.
#
# Fields added:
# - is_corporate_managed: boolean - indicates this contact has corporate management features
# - parent_company_contact_id: FK to contacts - for company hierarchy at Contact level
#
# SSoT Decision:
# - Contact = Identity SSoT (all entities)
# - CorporateCompany = Extension table (corporate-specific data like ASIC, compliance)
#
class AddCorporateFieldsToContacts < ActiveRecord::Migration[8.0]
  def change
    # Add corporate management flag
    # When true, this contact has corporate features enabled (directors, shareholders, compliance)
    # Default false - most contacts are simple people/companies without corporate structure
    add_column :contacts, :is_corporate_managed, :boolean, default: false, null: false

    # Add parent company reference at Contact level
    # This allows hierarchy for contacts that are companies/trusts
    # Mirrors the parent_company_id on CorporateCompany but at the Contact level
    add_reference :contacts, :parent_company_contact,
                  foreign_key: { to_table: :contacts },
                  null: true,
                  index: true

    # Add index for finding corporate-managed contacts
    add_index :contacts, :is_corporate_managed, where: "is_corporate_managed = true"

    # Add index for finding child companies (subsidiaries)
    add_index :contacts, :parent_company_contact_id,
              where: "parent_company_contact_id IS NOT NULL",
              name: "idx_contacts_with_parent_company"
  end
end
