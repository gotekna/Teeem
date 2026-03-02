# frozen_string_literal: true

# FRC: QuoteTemplate and CustomQuoteTemplate were created after ConfigSync
# was built, so they were never given sync_key columns. Without sync_key,
# cross-tenant matching relies on fragile name matching that breaks on rename.
# This adds sync_key to both tables, matching the pattern used by 50+ other
# config models (PoTemplatePack, SmScheduleMasterTemplate, DocumentType, etc.)
#
class AddSyncKeyToQuoteTemplates < ActiveRecord::Migration[7.2]
  # FRC (Mar 2026): column_exists? uses Rails schema cache which can be stale
  # on Heroku (PgBouncer, concurrent deploys). Use if_not_exists: true for
  # DB-level idempotency that works regardless of cache state.
  def up
    add_column :quote_templates, :sync_key, :string, if_not_exists: true
    unless index_exists?(:quote_templates, [:tenant_id, :sync_key], name: "idx_quote_templates_on_tenant_sync_key")
      add_index :quote_templates, [:tenant_id, :sync_key],
                name: "idx_quote_templates_on_tenant_sync_key",
                unique: true,
                where: "(sync_key IS NOT NULL)"
    end

    add_column :custom_quote_templates, :sync_key, :string, if_not_exists: true
    unless index_exists?(:custom_quote_templates, [:tenant_id, :sync_key], name: "idx_custom_quote_templates_on_tenant_sync_key")
      add_index :custom_quote_templates, [:tenant_id, :sync_key],
                name: "idx_custom_quote_templates_on_tenant_sync_key",
                unique: true,
                where: "(sync_key IS NOT NULL)"
    end

    # Backfill sync_key for existing records from name (idempotent: WHERE sync_key IS NULL)
    execute <<-SQL
      UPDATE quote_templates
      SET sync_key = REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(LOWER(TRIM(name)), '[_\\s.]+', '-', 'g'),
          '[^a-z0-9\\-]', '', 'g'),
        '-{2,}', '-', 'g')
      WHERE sync_key IS NULL AND name IS NOT NULL;
    SQL

    execute <<-SQL
      UPDATE custom_quote_templates
      SET sync_key = REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(LOWER(TRIM(name)), '[_\\s.]+', '-', 'g'),
          '[^a-z0-9\\-]', '', 'g'),
        '-{2,}', '-', 'g')
      WHERE sync_key IS NULL AND name IS NOT NULL;
    SQL
  end

  def down
    remove_index :custom_quote_templates, name: "idx_custom_quote_templates_on_tenant_sync_key", if_exists: true
    remove_column :custom_quote_templates, :sync_key, if_exists: true
    remove_index :quote_templates, name: "idx_quote_templates_on_tenant_sync_key", if_exists: true
    remove_column :quote_templates, :sync_key, if_exists: true
  end
end
