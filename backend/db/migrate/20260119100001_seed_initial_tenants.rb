# frozen_string_literal: true

# Phase 2: Seed Initial Tenants with Clean IDs
#
# Creates initial tenant records with predictable IDs:
#   ID 1: TEEEM (master tenant)
#   ID 2: Tekna (first customer)
#   ID 3: Pilgrim Homes (second customer)
#   ID 4+: Future tenants
#
# This uses explicit IDs to ensure consistency across environments
# and sets the sequence to start from ID 4 for new tenants.
#
class SeedInitialTenants < ActiveRecord::Migration[8.0]
  def up
    execute <<-SQL
      INSERT INTO tenants (id, name, slug, tier, environment, is_master_tenant, active, document_provider, created_at, updated_at)
      VALUES
        (1, 'TEEEM', 'teeem', 'dedicated', 'production', true, true, 'sharepoint', NOW(), NOW()),
        (2, 'Tekna', 'tekna', 'shared', 'production', false, true, 'sharepoint', NOW(), NOW()),
        (3, 'Pilgrim Homes', 'pilgrim', 'shared', 'production', false, true, 'sharepoint', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;

      -- Set sequence to 4 for next tenant (so next INSERT gets ID 4)
      SELECT setval('tenants_id_seq', 4, false);
    SQL
  end

  def down
    execute <<-SQL
      DELETE FROM tenants WHERE id IN (1, 2, 3);
    SQL
  end
end
