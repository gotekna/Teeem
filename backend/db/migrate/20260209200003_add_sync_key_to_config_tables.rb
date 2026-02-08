# frozen_string_literal: true

# Add sync_key column to all config sync tables.
#
# sync_key is an immutable identifier used for matching records across tenants.
# It's generated once (from name/code) when a record is first created or synced,
# then never changes. This allows tenants to rename records freely without
# breaking the sync link.
#
# Example: DocumentType "Xero Bill Attachment" gets sync_key "xero-bill-attachment"
# Tenant can rename to "Xero Bill" but sync still works via sync_key.
class AddSyncKeyToConfigTables < ActiveRecord::Migration[7.2]
  # All tables that participate in config sync (from TenantConfigSyncService::CONFIG_TABLES)
  SYNC_TABLES = %w[
    job_types
    job_statuses
    job_stages
    job_type_statuses
    job_status_stages
    job_tabs
    document_types
    document_templates
    folder_templates
    claim_invoice_templates
    invoice_templates
    specification_templates
    colour_selection_templates
    contact_types
    contacts
    price_histories
    sm_schedule_master_templates
    sm_schedule_masters
    sm_trades
    sm_stages
    sm_hold_reasons
    sm_resources
    sm_schedule_master_document_types
    meeting_types
    pricebook_categories
    pricebooks
    public_holidays
    cost_centres
    supervisor_checklist_templates
    takeoff_templates
    recipe_categories
    recipes
    quantity_variables
    xero_chart_of_accounts
    warehouse_types
    warehouse_folders
    warehouse_folder_document_types
    whs_induction_templates
    whs_inspection_templates
    email_templates
    plan_types
    plan_categories
  ].freeze

  def up
    SYNC_TABLES.each do |table|
      next unless table_exists?(table)
      next if column_exists?(table, :sync_key)

      add_column table, :sync_key, :string
      add_index table, [:tenant_id, :sync_key], name: "idx_#{table}_on_tenant_sync_key",
                where: "sync_key IS NOT NULL", unique: false
    end

    # Backfill sync_keys for existing records
    backfill_sync_keys
  end

  def down
    SYNC_TABLES.each do |table|
      next unless table_exists?(table)
      next unless column_exists?(table, :sync_key)

      remove_column table, :sync_key
    end
  end

  private

  # Generate sync_key from current match fields for existing records.
  # Uses the same slugification as the Syncable concern.
  #
  # For entity tables: slugify the name/code field
  # For join tables: composite key from FK IDs (stable since FKs don't change)
  BACKFILL_RULES = {
    # Entity tables - sync_key from name or code
    "job_types"                     => "name",
    "job_statuses"                  => "name",
    "job_stages"                    => "name",
    "job_tabs"                      => "slug",
    "document_types"                => %w[name scope],
    "document_templates"            => "name",
    "folder_templates"              => "name",
    "claim_invoice_templates"       => "name",
    "invoice_templates"             => "name",
    "specification_templates"       => "name",
    "colour_selection_templates"    => "name",
    "contact_types"                 => "name",
    "contacts"                      => "display_name",
    "sm_schedule_master_templates"  => "name",
    "sm_schedule_masters"           => "task_number",
    "sm_trades"                     => "name",
    "sm_stages"                     => "name",
    "sm_hold_reasons"               => "name",
    "sm_resources"                  => "name",
    "meeting_types"                 => "name",
    "pricebook_categories"          => "name",
    "pricebooks"                    => "item_code",
    "public_holidays"               => %w[name date],
    "cost_centres"                  => "code",
    "supervisor_checklist_templates" => "name",
    "takeoff_templates"             => "name",
    "recipe_categories"             => "code",
    "recipes"                       => "code",
    "quantity_variables"            => "variable_name",
    "xero_chart_of_accounts"        => "account_code",
    "warehouse_types"               => "code",
    "warehouse_folders"             => %w[warehouse_type tab_key],
    "whs_induction_templates"       => "name",
    "whs_inspection_templates"      => "name",
    "email_templates"               => %w[name category],
    "plan_types"                    => "code",
    "plan_categories"               => "code",
    # Join tables - composite key from FKs
    "job_type_statuses"             => %w[job_type_id job_status_id],
    "job_status_stages"             => %w[job_type_id job_status_id job_stage_id],
    "price_histories"               => %w[pricebook_item_id supplier_id],
    "sm_schedule_master_document_types" => %w[sm_schedule_master_id document_type_id],
    "warehouse_folder_document_types"   => %w[warehouse_folder_id document_type_id],
  }.freeze

  def backfill_sync_keys
    BACKFILL_RULES.each do |table, fields|
      next unless table_exists?(table) && column_exists?(table, :sync_key)

      fields = Array(fields)

      if fields.length == 1
        # Single field - simple slugify
        field = fields.first
        next unless column_exists?(table, field)

        execute <<~SQL
          UPDATE #{table}
          SET sync_key = LOWER(TRIM(REPLACE(REPLACE(REPLACE(COALESCE(#{field}::text, ''), ' ', '-'), '_', '-'), '.', '-')))
          WHERE sync_key IS NULL AND #{field} IS NOT NULL
        SQL
      else
        # Multiple fields - join with double-dash separator
        # Check all columns exist
        valid_fields = fields.select { |f| column_exists?(table, f) }
        next if valid_fields.empty?

        parts = valid_fields.map { |f|
          "LOWER(TRIM(REPLACE(REPLACE(REPLACE(COALESCE(#{f}::text, ''), ' ', '-'), '_', '-'), '.', '-')))"
        }
        concat_expr = parts.join(" || '--' || ")

        execute <<~SQL
          UPDATE #{table}
          SET sync_key = #{concat_expr}
          WHERE sync_key IS NULL
        SQL
      end
    end
  end
end
