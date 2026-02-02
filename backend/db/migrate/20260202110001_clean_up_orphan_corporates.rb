# frozen_string_literal: true

# Clean up orphan Corporate records without company_group_id
#
# Problem: 397 Corporate records have no company_group_id. These fall into:
# 1. Legitimate ASIC history - RH- code prefix companies (struck-off)
# 2. Garbage data - External suppliers incorrectly promoted via enable_corporate_management!
#
# Root cause: enable_corporate_management! creates Corporates without requiring company_group_id
# This migration cleans up the data; the method is fixed separately in contact.rb
class CleanUpOrphanCorporates < ActiveRecord::Migration[7.1]
  def up
    # Step 1: Create "ASIC Struck Off" company group for historical companies
    asic_group = execute_and_fetch(<<~SQL)
      INSERT INTO company_groups (name, code, description, tenant_id, active, created_at, updated_at)
      SELECT
        'ASIC Struck Off',
        'ASO',
        'Historical companies from ASIC extract - struck off or no longer managed',
        (SELECT id FROM tenants WHERE name = 'Tekna' OR slug = 'tekna' LIMIT 1),
        true,
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM company_groups WHERE name = 'ASIC Struck Off'
      )
      RETURNING id
    SQL

    # Get the group id (either newly created or existing)
    group_id = asic_group.first&.dig('id') || execute_and_fetch(<<~SQL).first&.dig('id')
      SELECT id FROM company_groups WHERE name = 'ASIC Struck Off' LIMIT 1
    SQL

    return unless group_id

    # Step 2: Assign RH- struck-off companies to the "ASIC Struck Off" group
    execute(<<~SQL)
      UPDATE corporates
      SET company_group_id = #{group_id}, updated_at = NOW()
      WHERE code LIKE 'RH-%'
        AND status = 'struck_off'
        AND company_group_id IS NULL
    SQL

    rh_updated = connection.select_value("SELECT COUNT(*) FROM corporates WHERE company_group_id = #{group_id}")
    say "Assigned #{rh_updated} RH- struck-off companies to 'ASIC Struck Off' group"

    # Step 3: Clear Contact links for garbage Corporates (will be deleted)
    # These are Corporates without company_group_id that are NOT RH- companies
    execute(<<~SQL)
      UPDATE contacts
      SET link_to_cg = false, linked_company_id = NULL, updated_at = NOW()
      WHERE id IN (
        SELECT contact_id FROM corporates
        WHERE company_group_id IS NULL
          AND (code IS NULL OR code NOT LIKE 'RH-%')
      )
    SQL

    # Step 4: Delete garbage Corporate records and associated data
    # Keep RH- companies (assigned to group above) and any with company_group_id
    garbage_count = connection.select_value(<<~SQL)
      SELECT COUNT(*) FROM corporates
      WHERE company_group_id IS NULL
        AND (code IS NULL OR code NOT LIKE 'RH-%')
    SQL

    # Delete associated records first (foreign key constraints)
    execute(<<~SQL)
      DELETE FROM corporate_directors
      WHERE company_id IN (
        SELECT id FROM corporates
        WHERE company_group_id IS NULL
          AND (code IS NULL OR code NOT LIKE 'RH-%')
      )
    SQL

    execute(<<~SQL)
      DELETE FROM corporate_shareholdings
      WHERE company_id IN (
        SELECT id FROM corporates
        WHERE company_group_id IS NULL
          AND (code IS NULL OR code NOT LIKE 'RH-%')
      )
    SQL

    execute(<<~SQL)
      DELETE FROM corporate_compliance_items
      WHERE company_id IN (
        SELECT id FROM corporates
        WHERE company_group_id IS NULL
          AND (code IS NULL OR code NOT LIKE 'RH-%')
      )
    SQL

    execute(<<~SQL)
      DELETE FROM corporate_activities
      WHERE company_id IN (
        SELECT id FROM corporates
        WHERE company_group_id IS NULL
          AND (code IS NULL OR code NOT LIKE 'RH-%')
      )
    SQL

    # Now delete the garbage Corporate records
    execute(<<~SQL)
      DELETE FROM corporates
      WHERE company_group_id IS NULL
        AND (code IS NULL OR code NOT LIKE 'RH-%')
    SQL

    say "Deleted #{garbage_count} garbage Corporate records"

    # Step 5: Report remaining orphans (should be 0 or only active RH- companies)
    remaining = connection.select_value("SELECT COUNT(*) FROM corporates WHERE company_group_id IS NULL")
    if remaining.to_i > 0
      say "WARNING: #{remaining} Corporate records still have no company_group_id"
      # These would be active RH- companies that weren't struck off
      # Assign them to the ASIC group too
      execute(<<~SQL)
        UPDATE corporates
        SET company_group_id = #{group_id}, updated_at = NOW()
        WHERE code LIKE 'RH-%'
          AND company_group_id IS NULL
      SQL
    end

    final_orphans = connection.select_value("SELECT COUNT(*) FROM corporates WHERE company_group_id IS NULL")
    say "Final count of orphan Corporates: #{final_orphans}"
  end

  def down
    # This is a data cleanup migration - can't easily undo deleted records
    # But we can remove the "ASIC Struck Off" group (will nullify company_group_id on corporates)
    execute(<<~SQL)
      DELETE FROM company_groups WHERE name = 'ASIC Struck Off' AND code = 'ASO'
    SQL
  end

  private

  def execute_and_fetch(sql)
    connection.execute(sql).to_a
  end
end
