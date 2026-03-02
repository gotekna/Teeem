# frozen_string_literal: true

# FRC (Mar 2026): ClaimStageTemplateLine was created without sync_key.
# Two-way push requires sync_key to match/push records to master.
# Without it, local-only claim lines can never be pushed.
#
class AddSyncKeyToClaimStageTemplateLines < ActiveRecord::Migration[7.2]
  def up
    add_column :claim_stage_template_lines, :sync_key, :string, if_not_exists: true
    add_index :claim_stage_template_lines, [:tenant_id, :sync_key],
              name: "idx_claim_stage_template_lines_on_tenant_sync_key",
              unique: true,
              where: "(sync_key IS NOT NULL)",
              if_not_exists: true

    # Backfill sync_key from name + claim_stage_template_id (composite key for uniqueness)
    execute <<-SQL
      UPDATE claim_stage_template_lines
      SET sync_key = REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(LOWER(TRIM(name)), '[_\\s.]+', '-', 'g'),
          '[^a-z0-9\\-]', '', 'g'),
        '-{2,}', '-', 'g')
        || '--' ||
        COALESCE(
          (SELECT REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(LOWER(TRIM(cst.name)), '[_\\s.]+', '-', 'g'),
              '[^a-z0-9\\-]', '', 'g'),
            '-{2,}', '-', 'g')
           FROM claim_stage_templates cst
           WHERE cst.id = claim_stage_template_lines.claim_stage_template_id),
          'unknown')
      WHERE sync_key IS NULL AND name IS NOT NULL;
    SQL
  end

  def down
    remove_index :claim_stage_template_lines, name: "idx_claim_stage_template_lines_on_tenant_sync_key", if_exists: true
    remove_column :claim_stage_template_lines, :sync_key, if_exists: true
  end
end
