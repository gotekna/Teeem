# frozen_string_literal: true

class AddSyncKeyToClaimStageTemplates < ActiveRecord::Migration[7.1]
  def up
    add_column :claim_stage_templates, :sync_key, :string, if_not_exists: true

    unless index_exists?(:claim_stage_templates, [:tenant_id, :sync_key], name: "idx_claim_stage_templates_on_tenant_sync_key")
      add_index :claim_stage_templates, [:tenant_id, :sync_key],
                name: "idx_claim_stage_templates_on_tenant_sync_key",
                unique: true,
                where: "sync_key IS NOT NULL"
    end

    # Backfill existing records with parameterized name (idempotent: WHERE sync_key IS NULL)
    execute <<~SQL
      UPDATE claim_stage_templates
      SET sync_key = LOWER(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(TRIM(name), '[_\\s.]+', '-', 'g'),
            '[^a-z0-9\\-]', '', 'gi'
          ),
          '-{2,}', '-', 'g'
        )
      )
      WHERE sync_key IS NULL AND name IS NOT NULL
    SQL
  end

  def down
    remove_index :claim_stage_templates, name: "idx_claim_stage_templates_on_tenant_sync_key", if_exists: true
    remove_column :claim_stage_templates, :sync_key, if_exists: true
  end
end
