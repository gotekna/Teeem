# frozen_string_literal: true

# Promote shared FoundationViews to truly global (tenant_id = NULL).
#
# SSoT violation: 0 global foundation_views exist. Tekna (55) and Pilgrim (55)
# each have tenant-scoped copies of what should be ONE global set. New customer
# tenants would get zero views.
#
# This migration:
# 1. Picks the canonical set from the first internal tenant found (Tekna)
# 2. Sets their tenant_id = NULL (making them truly global)
# 3. Deletes duplicate shared views from other internal tenants (Pilgrim)
# 4. Deletes ALL personal views (users can re-create their own)
class PromoteFoundationViewsToGlobal < ActiveRecord::Migration[8.0]
  def up
    # Find internal tenant slugs
    internal_slugs = %w[teeem tekna pilgrim]
    internal_tenant_ids = execute(<<~SQL).map { |r| r["id"] }
      SELECT id FROM tenants WHERE slug IN (#{internal_slugs.map { |s| "'#{s}'" }.join(",")})
    SQL

    if internal_tenant_ids.empty?
      say "No internal tenants found — skipping"
      return
    end

    # Pick first internal tenant as canonical (usually Tekna, id=2)
    canonical_tenant_id = internal_tenant_ids.first
    other_internal_ids = internal_tenant_ids - [canonical_tenant_id]

    say "Canonical tenant: #{canonical_tenant_id}, others: #{other_internal_ids.inspect}"

    # Count before
    canonical_count = execute(<<~SQL).first["count"]
      SELECT COUNT(*) FROM foundation_views
      WHERE tenant_id = #{canonical_tenant_id} AND is_global = true AND user_id IS NULL
    SQL
    say "Canonical tenant shared views: #{canonical_count}"

    # Step 1: Clear sync_key on canonical views to avoid unique index conflicts
    # (tenant_id, sync_key) unique index — changing tenant_id from N to NULL
    # could clash if another global view already exists with that sync_key.
    execute(<<~SQL)
      UPDATE foundation_views
      SET sync_key = NULL
      WHERE tenant_id = #{canonical_tenant_id}
        AND is_global = true
        AND user_id IS NULL
        AND sync_key IS NOT NULL
    SQL

    # Step 2: Promote canonical tenant's shared views to global (tenant_id = NULL)
    promoted = execute(<<~SQL).cmd_tuples
      UPDATE foundation_views
      SET tenant_id = NULL
      WHERE tenant_id = #{canonical_tenant_id}
        AND is_global = true
        AND user_id IS NULL
    SQL
    say "Promoted #{promoted} views to global (tenant_id = NULL)"

    # Step 3: Delete duplicate shared views from other internal tenants
    if other_internal_ids.any?
      deleted = execute(<<~SQL).cmd_tuples
        DELETE FROM foundation_views
        WHERE tenant_id IN (#{other_internal_ids.join(",")})
          AND is_global = true
          AND user_id IS NULL
      SQL
      say "Deleted #{deleted} duplicate shared views from other internal tenants"
    end

    # Step 4: Delete all non-global views (personal + stray orphans)
    # Users can re-create their own personal views.
    non_global_deleted = execute(<<~SQL).cmd_tuples
      DELETE FROM foundation_views
      WHERE tenant_id IS NOT NULL
    SQL
    say "Deleted #{non_global_deleted} non-global views (users can re-save their own)"

    # Step 5: Verify
    global_count = execute(<<~SQL).first["count"]
      SELECT COUNT(*) FROM foundation_views WHERE tenant_id IS NULL
    SQL
    remaining = execute(<<~SQL).first["count"]
      SELECT COUNT(*) FROM foundation_views
    SQL
    say "Final: #{global_count} global views, #{remaining} total views"
  end

  def down
    say "Cannot reverse — would need to know which tenant each view came from"
    say "Global views will remain global; re-run data setup if needed"
  end
end
