# frozen_string_literal: true

# Migration: Ensure all CorporateCompanies have Contact records
# Part of Contact SSoT Consolidation - Phase 1
#
# Purpose:
# All corporate companies must link to a Contact record for SSoT compliance.
# This migration:
# 1. Creates Contact records for CorporateCompanies that don't have one
# 2. Sets is_corporate_managed = true for linked contacts
# 3. Makes contact_id NOT NULL on corporate_companies (after backfill)
#
# Note: This is a data migration that should be run once
#
class EnsureCorporateCompaniesHaveContacts < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Create Contact records for CorporateCompanies without one
    say_with_time "Creating Contact records for unlinked CorporateCompanies" do
      unlinked_count = 0

      # Use raw SQL to avoid model callbacks during migration
      # NOTE: contact_code is NOT NULL, so we generate a unique code using nextval
      # The code format matches the model's convention: "C" + id
      execute <<-SQL.squish
        INSERT INTO contacts (
          tenant_id,
          entity_type,
          display_name,
          company_name_or_trust,
          abn,
          acn,
          is_corporate_managed,
          is_active,
          contact_code,
          created_at,
          updated_at
        )
        SELECT
          cc.tenant_id,
          CASE WHEN cc.trust_name IS NOT NULL AND cc.trust_name != '' THEN 'trust' ELSE 'company' END,
          cc.name,
          cc.name,
          cc.abn,
          cc.acn,
          true,
          CASE WHEN cc.status = 'active' THEN true ELSE false END,
          'CC-' || cc.id::text,
          NOW(),
          NOW()
        FROM corporate_companies cc
        WHERE cc.contact_id IS NULL
        ON CONFLICT DO NOTHING
      SQL

      # Step 2: Link CorporateCompanies to their newly created Contacts
      execute <<-SQL.squish
        UPDATE corporate_companies cc
        SET contact_id = c.id
        FROM contacts c
        WHERE cc.contact_id IS NULL
          AND c.display_name = cc.name
          AND c.is_corporate_managed = true
          AND c.tenant_id = cc.tenant_id
      SQL

      # Count how many we linked
      unlinked_count = ActiveRecord::Base.connection.select_value(
        "SELECT COUNT(*) FROM corporate_companies WHERE contact_id IS NULL"
      ).to_i

      say "Remaining unlinked: #{unlinked_count}"
      unlinked_count
    end

    # Step 3: Set is_corporate_managed = true for all linked contacts
    say_with_time "Setting is_corporate_managed flag on linked contacts" do
      execute <<-SQL.squish
        UPDATE contacts
        SET is_corporate_managed = true
        WHERE id IN (
          SELECT DISTINCT contact_id
          FROM corporate_companies
          WHERE contact_id IS NOT NULL
        )
      SQL
    end

    # Step 4: Sync parent_company_contact_id from CorporateCompany hierarchy
    say_with_time "Syncing parent company hierarchy to contacts" do
      execute <<-SQL.squish
        UPDATE contacts c
        SET parent_company_contact_id = parent_contact.id
        FROM corporate_companies cc
        JOIN corporate_companies parent_cc ON cc.parent_company_id = parent_cc.id
        JOIN contacts parent_contact ON parent_cc.contact_id = parent_contact.id
        WHERE cc.contact_id = c.id
          AND cc.parent_company_id IS NOT NULL
          AND c.parent_company_contact_id IS NULL
      SQL
    end

    # Step 5: Make contact_id NOT NULL (now that all are backfilled)
    # Only do this if ALL corporate_companies have contact_id
    unlinked_count = ActiveRecord::Base.connection.select_value(
      "SELECT COUNT(*) FROM corporate_companies WHERE contact_id IS NULL"
    ).to_i

    if unlinked_count == 0
      say_with_time "Making contact_id NOT NULL on corporate_companies" do
        change_column_null :corporate_companies, :contact_id, false
      end
    else
      say "WARNING: #{unlinked_count} CorporateCompanies still without Contact - skipping NOT NULL constraint"
    end
  end

  def down
    # Revert NOT NULL constraint if applied
    change_column_null :corporate_companies, :contact_id, true

    # Clear is_corporate_managed flags (we don't delete the contacts)
    execute <<-SQL.squish
      UPDATE contacts
      SET is_corporate_managed = false
      WHERE is_corporate_managed = true
    SQL

    # Clear parent_company_contact_id
    execute <<-SQL.squish
      UPDATE contacts
      SET parent_company_contact_id = NULL
      WHERE parent_company_contact_id IS NOT NULL
    SQL
  end
end
