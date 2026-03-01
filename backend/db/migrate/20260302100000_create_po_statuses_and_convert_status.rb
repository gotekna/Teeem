class CreatePoStatusesAndConvertStatus < ActiveRecord::Migration[7.2]
  def up
    # =========================================================================
    # Step 1: Create po_statuses table
    # =========================================================================
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

    # =========================================================================
    # Step 2: Add po_status_id FK to purchase_orders
    # =========================================================================
    add_reference :purchase_orders, :po_status, foreign_key: { to_table: :po_statuses }, null: true

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

    # For each tenant, create the 9 system statuses
    tenant_ids = execute("SELECT id FROM tenants").map { |r| r["id"] }

    tenant_ids.each do |tenant_id|
      system_statuses.each do |status|
        execute <<~SQL
          INSERT INTO po_statuses (name, slug, color, position, is_active, system_locked, tenant_id, sync_key, created_at, updated_at)
          VALUES (
            #{quote(status[:name])},
            #{quote(status[:slug])},
            #{quote(status[:color])},
            #{status[:position]},
            true,
            true,
            #{tenant_id},
            #{quote(status[:slug])},
            #{quote(now)},
            #{quote(now)}
          )
        SQL
      end

      # Backfill: Set po_status_id on existing purchase_orders for this tenant
      execute <<~SQL
        UPDATE purchase_orders
        SET po_status_id = po_statuses.id
        FROM po_statuses
        WHERE purchase_orders.status = po_statuses.slug
          AND purchase_orders.tenant_id = #{tenant_id}
          AND po_statuses.tenant_id = #{tenant_id}
      SQL
    end

    # =========================================================================
    # Step 4: Foundation setup — Create po-statuses Foundation
    # =========================================================================

    # Find the first tenant to get an owner for Foundation (required field)
    # Foundation records are tenant-scoped, so we create one per tenant
    tenant_ids.each do |tenant_id|
      # Create Foundation record
      execute <<~SQL
        INSERT INTO foundations (name, slug, model_name, table_name, table_type, tenant_id, created_at, updated_at)
        VALUES (
          'PO Statuses',
          'po-statuses',
          'PoStatus',
          'po_statuses',
          'system',
          #{tenant_id},
          #{quote(now)},
          #{quote(now)}
        )
      SQL

      foundation_id = execute("SELECT id FROM foundations WHERE slug = 'po-statuses' AND tenant_id = #{tenant_id} ORDER BY id DESC LIMIT 1").first["id"]

      # Create columns for the Foundation
      columns = [
        { column_name: "name",          column_type: "text",    label: "Name",          position: 0, is_visible: true,  is_editable: true  },
        { column_name: "slug",          column_type: "text",    label: "Slug",          position: 1, is_visible: true,  is_editable: false },
        { column_name: "color",         column_type: "text",    label: "Color Classes",  position: 2, is_visible: true,  is_editable: true  },
        { column_name: "position",      column_type: "integer", label: "Position",      position: 3, is_visible: true,  is_editable: true  },
        { column_name: "is_active",     column_type: "boolean", label: "Active",        position: 4, is_visible: true,  is_editable: true  },
        { column_name: "system_locked", column_type: "boolean", label: "System Locked", position: 5, is_visible: true,  is_editable: false },
      ]

      columns.each do |col|
        execute <<~SQL
          INSERT INTO columns (
            foundation_id, column_name, column_type, label, position,
            is_visible, is_editable, tenant_id, created_at, updated_at
          )
          VALUES (
            #{foundation_id},
            #{quote(col[:column_name])},
            #{quote(col[:column_type])},
            #{quote(col[:label])},
            #{col[:position]},
            #{col[:is_visible]},
            #{col[:is_editable]},
            #{tenant_id},
            #{quote(now)},
            #{quote(now)}
          )
        SQL
      end
    end

    # =========================================================================
    # Step 5: Convert purchase-orders Foundation status column to lookup
    # =========================================================================
    # For each tenant, update the status column on the purchase-orders Foundation
    tenant_ids.each do |tenant_id|
      po_foundation_id = execute(
        "SELECT id FROM foundations WHERE slug = 'purchase-orders' AND tenant_id = #{tenant_id} LIMIT 1"
      ).first&.dig("id")

      next unless po_foundation_id

      po_statuses_foundation_id = execute(
        "SELECT id FROM foundations WHERE slug = 'po-statuses' AND tenant_id = #{tenant_id} LIMIT 1"
      ).first&.dig("id")

      next unless po_statuses_foundation_id

      # Update the status column: change column_name to po_status_id, type to lookup
      execute <<~SQL
        UPDATE columns
        SET column_name = 'po_status_id',
            column_type = 'lookup',
            label = 'Status',
            lookup_foundation_id = #{po_statuses_foundation_id},
            lookup_display_column = 'name',
            available_choices = NULL,
            settings = '{}'::jsonb
        WHERE foundation_id = #{po_foundation_id}
          AND column_name = 'status'
          AND tenant_id = #{tenant_id}
      SQL

      # Update FoundationView filters that reference "status" → "po_status_id"
      # and convert string values to IDs
      views = execute(
        "SELECT id, filters FROM foundation_views WHERE foundation_id = #{po_foundation_id} AND tenant_id = #{tenant_id}"
      )

      views.each do |view|
        filters_json = view["filters"]
        next if filters_json.blank?

        begin
          filters = JSON.parse(filters_json)
          changed = false

          filters.each do |filter|
            if filter["column"] == "status"
              filter["column"] = "po_status_id"
              # Convert string status values to po_status IDs
              if filter["value"].is_a?(String)
                status_id = execute(
                  "SELECT id FROM po_statuses WHERE slug = #{quote(filter["value"])} AND tenant_id = #{tenant_id} LIMIT 1"
                ).first&.dig("id")
                filter["value"] = status_id.to_s if status_id
              elsif filter["value"].is_a?(Array)
                filter["value"] = filter["value"].map do |v|
                  if v.is_a?(String) && !v.match?(/\A\d+\z/)
                    status_id = execute(
                      "SELECT id FROM po_statuses WHERE slug = #{quote(v)} AND tenant_id = #{tenant_id} LIMIT 1"
                    ).first&.dig("id")
                    status_id ? status_id.to_s : v
                  else
                    v
                  end
                end
              end
              changed = true
            end
          end

          if changed
            execute <<~SQL
              UPDATE foundation_views
              SET filters = #{quote(filters.to_json)}
              WHERE id = #{view["id"]}
            SQL
          end
        rescue JSON::ParserError
          # Skip views with invalid JSON filters
        end
      end
    end
  end

  def down
    # Remove FK from purchase_orders
    remove_reference :purchase_orders, :po_status

    # Remove Foundation records (po-statuses)
    execute "DELETE FROM columns WHERE foundation_id IN (SELECT id FROM foundations WHERE slug = 'po-statuses')"
    execute "DELETE FROM foundation_views WHERE foundation_id IN (SELECT id FROM foundations WHERE slug = 'po-statuses')"
    execute "DELETE FROM foundations WHERE slug = 'po-statuses'"

    # Revert purchase-orders status column back to choice type
    execute <<~SQL
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
    drop_table :po_statuses
  end

  private

  def quote(value)
    ActiveRecord::Base.connection.quote(value)
  end
end
