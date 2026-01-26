# frozen_string_literal: true

# Migration to swap CorporateGroup and Organization IDs
#
# Purpose: Make TEEEM the primary tenant (ID 1) instead of Tekna
#
# Before:
#   - Tekna CorporateGroup: ID 1 (87,471 records referencing it)
#   - TEEEM CorporateGroup: ID 73
#   - Tekna Organization: ID 1 (12 tables with credentials)
#
# After:
#   - TEEEM CorporateGroup: ID 1
#   - Tekna CorporateGroup: ID 2
#   - TEEEM Organization: ID 1
#   - Tekna Organization: ID 2
#
# ⚠️ WARNING: This is a complex migration that temporarily disables FK constraints
# Run during low-traffic time and verify thoroughly after completion
#
class SwapCorporateGroupAndOrganizationIds < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  TEMP_ID = 999_999
  TEKNA_OLD_ID = 1
  TEEEM_OLD_ID = 73
  TEKNA_NEW_ID = 2
  TEEEM_NEW_ID = 1

  # All tables with company_group_id FK to corporate_groups
  COMPANY_GROUP_TABLES = %w[
    assets
    cases
    contact_corporate_group_memberships
    contact_types
    contacts
    corporate_companies
    corporate_entity_tabs
    document_templates
    document_types
    email_warehouses
    entity_tabs
    estimates
    job_stages
    job_status_stages
    job_statuses
    job_tabs
    job_type_statuses
    job_types
    jobs
    meeting_types
    meetings
    price_histories
    pricebook_categories
    pricebooks
    public_holidays
    purchase_orders
    reconciliation_reports
    sm_schedule_master_templates
    sm_schedule_masters
    sm_tasks
    sm_trades
    xero_chart_of_accounts
  ].freeze

  # Tables with corporate_group_id FK
  CORPORATE_GROUP_TABLES = %w[
    users
    tenant_settings
  ].freeze

  # Tables with organization_id FK
  ORGANIZATION_TABLES = %w[
    backup_configurations
    cloudflare_credentials
    desktop_clients
    email_drafts
    email_subscriptions
    microsoft_credentials
    performance_requests
    polaris_credentials
    s3_compatible_credentials
    storage_configurations
    stripe_configurations
    sync_exclusion_rules
  ].freeze

  def up
    # Check if swap is already done (TEEEM at ID 1)
    teeem_at_1 = execute("SELECT id, name FROM corporate_groups WHERE id = 1").first
    if teeem_at_1 && teeem_at_1['name'].to_s.downcase.include?('teeem')
      say "Swap already completed - TEEEM is already at ID 1. Skipping migration."
      return
    end

    # Check if Tekna is at ID 2 (swap done)
    tekna_at_2 = execute("SELECT id, name FROM corporate_groups WHERE id = 2").first
    if tekna_at_2 && tekna_at_2['name'].to_s.downcase.include?('tekna')
      say "Swap already completed - Tekna is already at ID 2. Skipping migration."
      return
    end

    # Verify current state before proceeding
    verify_current_state!

    say "Starting ID swap migration..."
    say "Tekna (#{TEKNA_OLD_ID}) -> #{TEKNA_NEW_ID}"
    say "TEEEM (#{TEEEM_OLD_ID}) -> #{TEEEM_NEW_ID}"

    # Disable FK constraint checking (Heroku doesn't allow session_replication_role)
    # Instead, we'll drop and recreate constraints, or use DEFERRABLE
    begin
      execute "SET session_replication_role = 'replica';"
      @use_session_role = true
    rescue ActiveRecord::StatementInvalid => e
      say "session_replication_role not available (Heroku), using deferred constraints"
      @use_session_role = false
      # Set constraints to deferred mode for this transaction
      execute "SET CONSTRAINTS ALL DEFERRED;"
    end

    begin
      # ═══════════════════════════════════════════════════════════════
      # PHASE 1: Swap CorporateGroup IDs
      # ═══════════════════════════════════════════════════════════════

      say_with_time "Phase 1: Moving Tekna CorporateGroup (#{TEKNA_OLD_ID} -> #{TEMP_ID})" do
        # Move the corporate_groups record first
        execute "UPDATE corporate_groups SET id = #{TEMP_ID} WHERE id = #{TEKNA_OLD_ID};"

        # Update all company_group_id references
        COMPANY_GROUP_TABLES.each do |table|
          execute "UPDATE #{table} SET company_group_id = #{TEMP_ID} WHERE company_group_id = #{TEKNA_OLD_ID};"
        end

        # Update corporate_group_id references
        CORPORATE_GROUP_TABLES.each do |table|
          execute "UPDATE #{table} SET corporate_group_id = #{TEMP_ID} WHERE corporate_group_id = #{TEKNA_OLD_ID};"
        end
      end

      say_with_time "Phase 1: Moving TEEEM CorporateGroup (#{TEEEM_OLD_ID} -> #{TEEEM_NEW_ID})" do
        execute "UPDATE corporate_groups SET id = #{TEEEM_NEW_ID} WHERE id = #{TEEEM_OLD_ID};"

        COMPANY_GROUP_TABLES.each do |table|
          execute "UPDATE #{table} SET company_group_id = #{TEEEM_NEW_ID} WHERE company_group_id = #{TEEEM_OLD_ID};"
        end

        CORPORATE_GROUP_TABLES.each do |table|
          execute "UPDATE #{table} SET corporate_group_id = #{TEEEM_NEW_ID} WHERE corporate_group_id = #{TEEEM_OLD_ID};"
        end
      end

      say_with_time "Phase 1: Moving Tekna CorporateGroup (#{TEMP_ID} -> #{TEKNA_NEW_ID})" do
        execute "UPDATE corporate_groups SET id = #{TEKNA_NEW_ID} WHERE id = #{TEMP_ID};"

        COMPANY_GROUP_TABLES.each do |table|
          execute "UPDATE #{table} SET company_group_id = #{TEKNA_NEW_ID} WHERE company_group_id = #{TEMP_ID};"
        end

        CORPORATE_GROUP_TABLES.each do |table|
          execute "UPDATE #{table} SET corporate_group_id = #{TEKNA_NEW_ID} WHERE corporate_group_id = #{TEMP_ID};"
        end
      end

      # Reset corporate_groups sequence
      execute "SELECT setval('corporate_groups_id_seq', GREATEST((SELECT MAX(id) FROM corporate_groups), #{TEEEM_OLD_ID}) + 1);"

      # ═══════════════════════════════════════════════════════════════
      # PHASE 2: Swap Organization IDs
      # ═══════════════════════════════════════════════════════════════

      # First check if TEEEM organization exists and what its ID is
      teeem_org_id = execute("SELECT id FROM organizations WHERE name ILIKE '%teeem%' OR name ILIKE '%teem%' LIMIT 1").first
      tekna_org_id = execute("SELECT id FROM organizations WHERE name ILIKE '%tekna%' LIMIT 1").first

      if tekna_org_id && tekna_org_id['id'].to_i == TEKNA_OLD_ID
        say_with_time "Phase 2: Moving Tekna Organization (#{TEKNA_OLD_ID} -> #{TEMP_ID})" do
          execute "UPDATE organizations SET id = #{TEMP_ID} WHERE id = #{TEKNA_OLD_ID};"

          ORGANIZATION_TABLES.each do |table|
            execute "UPDATE #{table} SET organization_id = #{TEMP_ID} WHERE organization_id = #{TEKNA_OLD_ID};"
          end
        end

        if teeem_org_id
          teeem_id = teeem_org_id['id'].to_i
          say_with_time "Phase 2: Moving TEEEM Organization (#{teeem_id} -> #{TEEEM_NEW_ID})" do
            execute "UPDATE organizations SET id = #{TEEEM_NEW_ID} WHERE id = #{teeem_id};"

            ORGANIZATION_TABLES.each do |table|
              execute "UPDATE #{table} SET organization_id = #{TEEEM_NEW_ID} WHERE organization_id = #{teeem_id};"
            end
          end
        else
          say "No TEEEM organization found - skipping"
        end

        say_with_time "Phase 2: Moving Tekna Organization (#{TEMP_ID} -> #{TEKNA_NEW_ID})" do
          execute "UPDATE organizations SET id = #{TEKNA_NEW_ID} WHERE id = #{TEMP_ID};"

          ORGANIZATION_TABLES.each do |table|
            execute "UPDATE #{table} SET organization_id = #{TEKNA_NEW_ID} WHERE organization_id = #{TEMP_ID};"
          end
        end

        # Reset organizations sequence
        execute "SELECT setval('organizations_id_seq', (SELECT MAX(id) FROM organizations) + 1);"
      else
        say "Tekna organization not at ID 1 - skipping organization swap"
      end

    ensure
      # Re-enable FK constraint checking
      if @use_session_role
        execute "SET session_replication_role = 'origin';"
      else
        execute "SET CONSTRAINTS ALL IMMEDIATE;"
      end
    end

    # Verify final state
    verify_final_state!

    say "Migration completed successfully!"
  end

  def down
    raise ActiveRecord::IrreversibleMigration, <<~MSG
      This migration cannot be automatically reversed.

      To reverse manually, run a new migration that swaps:
      - TEEEM CorporateGroup: 1 -> 73
      - Tekna CorporateGroup: 2 -> 1
      - TEEEM Organization: 1 -> (original ID)
      - Tekna Organization: 2 -> 1
    MSG
  end

  private

  def verify_current_state!
    tekna = execute("SELECT id, name FROM corporate_groups WHERE id = #{TEKNA_OLD_ID}").first
    teeem = execute("SELECT id, name FROM corporate_groups WHERE id = #{TEEEM_OLD_ID}").first

    unless tekna
      raise "Expected Tekna CorporateGroup at ID #{TEKNA_OLD_ID} but not found"
    end

    unless teeem
      raise "Expected TEEEM CorporateGroup at ID #{TEEEM_OLD_ID} but not found"
    end

    say "Current state verified:"
    say "  - Tekna at ID #{tekna['id']}: #{tekna['name']}"
    say "  - TEEEM at ID #{teeem['id']}: #{teeem['name']}"

    # Count records that will be affected
    total_records = 0
    COMPANY_GROUP_TABLES.each do |table|
      count = execute("SELECT COUNT(*) FROM #{table} WHERE company_group_id = #{TEKNA_OLD_ID}").first['count'].to_i
      total_records += count
      say "  - #{table}: #{count} records" if count > 0
    end
    say "  Total records to update: #{total_records}"
  end

  def verify_final_state!
    teeem = execute("SELECT id, name FROM corporate_groups WHERE id = #{TEEEM_NEW_ID}").first
    tekna = execute("SELECT id, name FROM corporate_groups WHERE id = #{TEKNA_NEW_ID}").first

    unless teeem && teeem['name'].to_s.downcase.include?('teeem')
      raise "Final state verification failed: TEEEM not at ID #{TEEEM_NEW_ID}"
    end

    unless tekna && tekna['name'].to_s.downcase.include?('tekna')
      raise "Final state verification failed: Tekna not at ID #{TEKNA_NEW_ID}"
    end

    say "Final state verified:"
    say "  - TEEEM now at ID #{teeem['id']}: #{teeem['name']}"
    say "  - Tekna now at ID #{tekna['id']}: #{tekna['name']}"

    # Verify email_warehouses (largest table) has correct counts
    teeem_emails = execute("SELECT COUNT(*) FROM email_warehouses WHERE company_group_id = #{TEEEM_NEW_ID}").first['count'].to_i
    tekna_emails = execute("SELECT COUNT(*) FROM email_warehouses WHERE company_group_id = #{TEKNA_NEW_ID}").first['count'].to_i
    say "  - TEEEM emails: #{teeem_emails}"
    say "  - Tekna emails: #{tekna_emails}"
  end
end
