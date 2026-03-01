class CreatePoStatusesAndConvertStatus < ActiveRecord::Migration[7.2]
  # Disable DDL transaction so partial progress is preserved if Foundation setup fails
  # (po_statuses table + backfill are the critical parts)
  disable_ddl_transaction!

  def up
    # =========================================================================
    # Step 1: Create po_statuses table (if not already created by partial run)
    # =========================================================================
    unless table_exists?(:po_statuses)
      create_table :po_statuses do |t|
        t.string :name, null: false
        t.string :slug, null: false
        t.string :color
        t.integer :position, default: 0
        t.boolean :is_active, default: true
        t.boolean :system_locked, default: false
        t.references :tenant, null: false, foreign_key: true
        t.string :sync_key

        t.timestamps
      end

      add_index :po_statuses, [:tenant_id, :slug], unique: true
      add_index :po_statuses, [:tenant_id, :position]
    end

    # =========================================================================
    # Step 2: Add po_status_id FK to purchase_orders (idempotent)
    # =========================================================================
    unless column_exists?(:purchase_orders, :po_status_id)
      add_reference :purchase_orders, :po_status, foreign_key: { to_table: :po_statuses }, null: true
    end

    # =========================================================================
    # Step 3: Seed system statuses per tenant & backfill
    # =========================================================================
    system_statuses = [
      { slug: "draft",         name: "Draft",         color: "bg-muted text-foreground",                                                         position: 0 },
      { slug: "pending",       name: "Pending",       color: "bg-status-warning text-status-warning-foreground",                                  position: 1 },
      { slug: "pending_quote", name: "Pending Quote", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300",             position: 2 },
      { slug: "approved",      name: "Approved",      color: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",                 position: 3 },
      { slug: "sent",          name: "Sent",          color: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",         position: 4 },
      { slug: "received",      name: "Received",      color: "bg-status-success text-status-success-foreground",                                  position: 5 },
      { slug: "invoiced",      name: "Invoiced",      color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300",         position: 6 },
      { slug: "paid",          name: "Paid",          color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300",     position: 7 },
      { slug: "cancelled",     name: "Cancelled",     color: "bg-status-error text-status-error-foreground",                                      position: 8 },
    ]

    now = Time.current
    tenant_ids = exec_query("SELECT id FROM tenants").rows.flatten

    tenant_ids.each do |tenant_id|
      system_statuses.each do |status|
        # Idempotent: skip if already exists
        existing = exec_query(
          "SELECT id FROM po_statuses WHERE slug = #{q(status[:slug])} AND tenant_id = #{tenant_id} LIMIT 1"
        ).rows.flatten.first
        next if existing

        exec_query <<~SQL
          INSERT INTO po_statuses (name, slug, color, position, is_active, system_locked, tenant_id, sync_key, created_at, updated_at)
          VALUES (
            #{q(status[:name])},
            #{q(status[:slug])},
            #{q(status[:color])},
            #{status[:position]},
            true,
            true,
            #{tenant_id},
            #{q(status[:slug])},
            #{q(now)},
            #{q(now)}
          )
        SQL
      end

      # Backfill: Set po_status_id on existing purchase_orders for this tenant
      exec_query <<~SQL
        UPDATE purchase_orders
        SET po_status_id = po_statuses.id
        FROM po_statuses
        WHERE purchase_orders.status = po_statuses.slug
          AND purchase_orders.tenant_id = #{tenant_id}
          AND po_statuses.tenant_id = #{tenant_id}
          AND purchase_orders.po_status_id IS NULL
      SQL
    end

    # =========================================================================
    # Step 4: Foundation setup — Create po-statuses Foundation (GLOBAL, not per-tenant)
    # =========================================================================
    # Foundations are global (unique slug). Columns belong to foundation (no tenant_id).

    existing_foundation = exec_query(
      "SELECT id FROM foundations WHERE slug = 'po-statuses' LIMIT 1"
    ).rows.flatten.first

    unless existing_foundation
      exec_query <<~SQL
        INSERT INTO foundations (name, slug, database_table_name, model_class, table_type, created_at, updated_at)
        VALUES (
          'PO Statuses',
          'po-statuses',
          'po_statuses',
          'PoStatus',
          'system',
          #{q(now)},
          #{q(now)}
        )
      SQL
    end

    foundation_id = exec_query(
      "SELECT id FROM foundations WHERE slug = 'po-statuses' LIMIT 1"
    ).rows.flatten.first

    # Create columns for the Foundation (idempotent)
    columns_def = [
      { column_name: "name",          column_type: "text",    name: "Name",          position: 0 },
      { column_name: "slug",          column_type: "text",    name: "Slug",          position: 1 },
      { column_name: "color",         column_type: "text",    name: "Color Classes", position: 2 },
      { column_name: "position",      column_type: "integer", name: "Position",      position: 3 },
      { column_name: "is_active",     column_type: "boolean", name: "Active",        position: 4 },
      { column_name: "system_locked", column_type: "boolean", name: "System Locked", position: 5 },
    ]

    columns_def.each do |col|
      existing_col = exec_query(
        "SELECT id FROM columns WHERE foundation_id = #{foundation_id} AND column_name = #{q(col[:column_name])} LIMIT 1"
      ).rows.flatten.first
      next if existing_col

      exec_query <<~SQL
        INSERT INTO columns (foundation_id, column_name, column_type, name, position, created_at, updated_at)
        VALUES (
          #{foundation_id},
          #{q(col[:column_name])},
          #{q(col[:column_type])},
          #{q(col[:name])},
          #{col[:position]},
          #{q(now)},
          #{q(now)}
        )
      SQL
    end

    # =========================================================================
    # Step 5: Convert purchase-orders Foundation status column to lookup
    # =========================================================================
    po_foundation_id = exec_query(
      "SELECT id FROM foundations WHERE slug = 'purchase-orders' LIMIT 1"
    ).rows.flatten.first

    if po_foundation_id
      # Check if status column still exists (not yet converted)
      status_col = exec_query(
        "SELECT id FROM columns WHERE foundation_id = #{po_foundation_id} AND column_name = 'status' LIMIT 1"
      ).rows.flatten.first

      if status_col
        exec_query <<~SQL
          UPDATE columns
          SET column_name = 'po_status_id',
              column_type = 'lookup',
              name = 'Status',
              lookup_foundation_id = #{foundation_id},
              lookup_display_column = 'name',
              available_choices = NULL,
              settings = '{}'::jsonb
          WHERE id = #{status_col}
        SQL
      end

      # Update FoundationView filters that reference "status" → "po_status_id"
      views = exec_query(
        "SELECT id, filters FROM foundation_views WHERE foundation_id = #{po_foundation_id}"
      )

      views.each do |view|
        filters_json = view["filters"]
        next if filters_json.blank?

        begin
          filters = JSON.parse(filters_json)
          changed = false

          filters.each do |filter|
            next unless filter["column"] == "status"
            filter["column"] = "po_status_id"

            # Determine tenant_id from the view to look up correct po_status IDs
            view_tenant_id = exec_query(
              "SELECT tenant_id FROM foundation_views WHERE id = #{view["id"]} LIMIT 1"
            ).rows.flatten.first

            if filter["value"].is_a?(String) && view_tenant_id
              status_id = exec_query(
                "SELECT id FROM po_statuses WHERE slug = #{q(filter["value"])} AND tenant_id = #{view_tenant_id} LIMIT 1"
              ).rows.flatten.first
              filter["value"] = status_id.to_s if status_id
            elsif filter["value"].is_a?(Array) && view_tenant_id
              filter["value"] = filter["value"].map do |v|
                if v.is_a?(String) && !v.match?(/\A\d+\z/)
                  sid = exec_query(
                    "SELECT id FROM po_statuses WHERE slug = #{q(v)} AND tenant_id = #{view_tenant_id} LIMIT 1"
                  ).rows.flatten.first
                  sid ? sid.to_s : v
                else
                  v
                end
              end
            end
            changed = true
          end

          if changed
            exec_query(
              "UPDATE foundation_views SET filters = #{q(filters.to_json)} WHERE id = #{view["id"]}"
            )
          end
        rescue JSON::ParserError
          # Skip views with invalid JSON filters
        end
      end
    end
  end

  def down
    # Remove FK from purchase_orders
    remove_reference :purchase_orders, :po_status if column_exists?(:purchase_orders, :po_status_id)

    # Remove Foundation records (po-statuses)
    exec_query "DELETE FROM columns WHERE foundation_id IN (SELECT id FROM foundations WHERE slug = 'po-statuses')"
    exec_query "DELETE FROM foundation_views WHERE foundation_id IN (SELECT id FROM foundations WHERE slug = 'po-statuses')"
    exec_query "DELETE FROM foundations WHERE slug = 'po-statuses'"

    # Revert purchase-orders status column back to choice type
    exec_query <<~SQL
      UPDATE columns
      SET column_name = 'status',
          column_type = 'choice',
          lookup_foundation_id = NULL,
          lookup_display_column = NULL,
          available_choices = '["draft","pending","pending_quote","approved","sent","received","invoiced","paid","cancelled"]'
      WHERE column_name = 'po_status_id'
        AND foundation_id IN (SELECT id FROM foundations WHERE slug = 'purchase-orders')
    SQL

    # Drop po_statuses table
    drop_table :po_statuses if table_exists?(:po_statuses)
  end

  private

  def q(value)
    ActiveRecord::Base.connection.quote(value)
  end

  def exec_query(sql)
    ActiveRecord::Base.connection.exec_query(sql)
  end
end
