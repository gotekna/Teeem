class AddTenantIdToFoundationViews < ActiveRecord::Migration[8.0]
  def up
    # 1. Add column (nullable first for backfill)
    add_column :foundation_views, :tenant_id, :integer

    # 2. Backfill personal views from user.tenant_id
    execute <<-SQL
      UPDATE foundation_views
      SET tenant_id = users.tenant_id
      FROM users
      WHERE foundation_views.user_id = users.id
        AND foundation_views.tenant_id IS NULL
    SQL

    # 3. Backfill global views (user_id IS NULL)
    # Use the FIRST tenant as owner (single-tenant system currently)
    first_tenant_id = Tenant.first&.id
    if first_tenant_id
      execute <<-SQL
        UPDATE foundation_views
        SET tenant_id = #{first_tenant_id}
        WHERE tenant_id IS NULL
      SQL
    end

    # 4. Add NOT NULL constraint after backfill
    change_column_null :foundation_views, :tenant_id, false

    # 5. Add indexes for tenant scoping
    add_index :foundation_views, :tenant_id
    add_index :foundation_views, [:tenant_id, :foundation_id, :user_id],
              name: "idx_fv_tenant_foundation_user"

    # 6. Replace slug uniqueness: foundation_id alone -> tenant_id + foundation_id
    remove_index :foundation_views, name: "index_foundation_views_on_foundation_and_slug"
    add_index :foundation_views, [:tenant_id, :foundation_id, :slug],
              unique: true, name: "index_foundation_views_on_tenant_foundation_slug"
  end

  def down
    remove_index :foundation_views, name: "index_foundation_views_on_tenant_foundation_slug"
    add_index :foundation_views, [:foundation_id, :slug],
              unique: true, name: "index_foundation_views_on_foundation_and_slug"
    remove_index :foundation_views, name: "idx_fv_tenant_foundation_user"
    remove_index :foundation_views, :tenant_id
    remove_column :foundation_views, :tenant_id
  end
end
