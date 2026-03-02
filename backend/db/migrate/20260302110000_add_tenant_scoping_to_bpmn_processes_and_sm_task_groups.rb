# frozen_string_literal: true

# Add tenant_id + sync_key to bpmn_processes and sm_task_groups
# so they can participate in TenantConfigSyncService cross-tenant sync.
#
# Backfill strategy:
# - For each record, find which tenant(s) reference it via sm_schedule_masters
# - 1 tenant → assign directly
# - 0 tenants → assign to Tekna (tenant_id=2, the source tenant)
# - N tenants → clone per additional tenant, update SM FK references
#
class AddTenantScopingToBpmnProcessesAndSmTaskGroups < ActiveRecord::Migration[7.2]
  def up
    # ========================================================================
    # Step 1: Add columns
    # ========================================================================
    add_column :sm_task_groups, :tenant_id, :bigint, if_not_exists: true
    add_column :sm_task_groups, :sync_key, :string, if_not_exists: true

    add_column :bpmn_processes, :tenant_id, :bigint, if_not_exists: true
    add_column :bpmn_processes, :sync_key, :string, if_not_exists: true

    # ========================================================================
    # Step 2: Backfill sm_task_groups
    # ========================================================================
    backfill_sm_task_groups

    # ========================================================================
    # Step 3: Backfill bpmn_processes
    # ========================================================================
    backfill_bpmn_processes

    # ========================================================================
    # Step 4: Add indexes (after backfill so inserts are fast)
    # ========================================================================
    add_index :sm_task_groups, :tenant_id, if_not_exists: true
    add_index :sm_task_groups, [:tenant_id, :sync_key],
              name: "idx_sm_task_groups_on_tenant_sync_key",
              unique: true,
              where: "sync_key IS NOT NULL",
              if_not_exists: true

    add_index :bpmn_processes, :tenant_id, if_not_exists: true
    add_index :bpmn_processes, [:tenant_id, :sync_key],
              name: "idx_bpmn_processes_on_tenant_sync_key",
              unique: true,
              where: "sync_key IS NOT NULL",
              if_not_exists: true
  end

  def down
    remove_index :bpmn_processes, name: "idx_bpmn_processes_on_tenant_sync_key", if_exists: true
    remove_index :bpmn_processes, :tenant_id, if_exists: true
    remove_column :bpmn_processes, :sync_key, if_exists: true
    remove_column :bpmn_processes, :tenant_id, if_exists: true

    remove_index :sm_task_groups, name: "idx_sm_task_groups_on_tenant_sync_key", if_exists: true
    remove_index :sm_task_groups, :tenant_id, if_exists: true
    remove_column :sm_task_groups, :sync_key, if_exists: true
    remove_column :sm_task_groups, :tenant_id, if_exists: true
  end

  private

  # Backfill sm_task_groups: find tenant from sm_schedule_masters.sm_task_group_id
  def backfill_sm_task_groups
    default_tenant_id = 2 # Tekna

    # Find all sm_task_group_ids and their associated tenant_ids
    group_tenants = execute(<<~SQL).to_a
      SELECT stg.id AS group_id,
             ARRAY_AGG(DISTINCT sm.tenant_id) FILTER (WHERE sm.tenant_id IS NOT NULL) AS tenant_ids
      FROM sm_task_groups stg
      LEFT JOIN sm_schedule_masters sm ON sm.sm_task_group_id = stg.id
      GROUP BY stg.id
    SQL

    group_tenants.each do |row|
      group_id = row["group_id"]
      tenant_ids = row["tenant_ids"]

      # Parse the Postgres array if it's a string
      tenant_ids = parse_pg_array(tenant_ids)

      if tenant_ids.empty?
        # No SM references → assign to Tekna
        assign_tenant_and_sync_key(:sm_task_groups, group_id, default_tenant_id)
      elsif tenant_ids.length == 1
        # Single tenant → assign directly
        assign_tenant_and_sync_key(:sm_task_groups, group_id, tenant_ids.first)
      else
        # Multiple tenants → assign first, clone for the rest
        primary_tenant = tenant_ids.first
        assign_tenant_and_sync_key(:sm_task_groups, group_id, primary_tenant)

        tenant_ids[1..].each do |tid|
          clone_record_for_tenant(:sm_task_groups, group_id, tid,
                                  fk_column: :sm_task_group_id,
                                  fk_table: :sm_schedule_masters)
        end
      end
    end
  end

  # Backfill bpmn_processes: find tenant from sm_schedule_masters.start_workflow_id and complete_workflow_id
  def backfill_bpmn_processes
    default_tenant_id = 2 # Tekna

    process_tenants = execute(<<~SQL).to_a
      SELECT bp.id AS process_id,
             ARRAY_AGG(DISTINCT t.tid) FILTER (WHERE t.tid IS NOT NULL) AS tenant_ids
      FROM bpmn_processes bp
      LEFT JOIN LATERAL (
        SELECT sm.tenant_id AS tid FROM sm_schedule_masters sm
        WHERE sm.start_workflow_id = bp.id OR sm.complete_workflow_id = bp.id
      ) t ON true
      GROUP BY bp.id
    SQL

    process_tenants.each do |row|
      process_id = row["process_id"]
      tenant_ids = row["tenant_ids"]

      tenant_ids = parse_pg_array(tenant_ids)

      if tenant_ids.empty?
        assign_tenant_and_sync_key(:bpmn_processes, process_id, default_tenant_id)
      elsif tenant_ids.length == 1
        assign_tenant_and_sync_key(:bpmn_processes, process_id, tenant_ids.first)
      else
        primary_tenant = tenant_ids.first
        assign_tenant_and_sync_key(:bpmn_processes, process_id, primary_tenant)

        tenant_ids[1..].each do |tid|
          clone_bpmn_process_for_tenant(process_id, tid)
        end
      end
    end
  end

  def assign_tenant_and_sync_key(table, record_id, tenant_id)
    # Get the name for sync_key generation
    name = execute("SELECT name FROM #{table} WHERE id = #{record_id}").first&.dig("name")
    sync_key = slugify(name.to_s)

    # Ensure uniqueness within tenant by appending suffix if needed
    sync_key = ensure_unique_sync_key(table, tenant_id, sync_key)

    execute(<<~SQL)
      UPDATE #{table}
      SET tenant_id = #{tenant_id},
          sync_key = #{quote(sync_key)}
      WHERE id = #{record_id}
    SQL
  end

  def clone_record_for_tenant(table, source_id, tenant_id, fk_column:, fk_table:)
    # Get source record columns (excluding id, created_at, updated_at)
    cols = columns(table).reject { |c| %w[id created_at updated_at].include?(c.name) }.map(&:name)

    source = execute("SELECT #{cols.join(', ')} FROM #{table} WHERE id = #{source_id}").first
    return unless source

    name = source["name"]
    sync_key = slugify(name.to_s)
    sync_key = ensure_unique_sync_key(table, tenant_id, sync_key)

    values = cols.map do |col|
      case col
      when "tenant_id" then tenant_id
      when "sync_key" then quote(sync_key)
      else source[col].nil? ? "NULL" : quote(source[col])
      end
    end

    new_id = execute(<<~SQL).first["id"]
      INSERT INTO #{table} (#{cols.join(', ')}, created_at, updated_at)
      VALUES (#{values.join(', ')}, NOW(), NOW())
      RETURNING id
    SQL

    # Update FK references in sm_schedule_masters for this tenant
    execute(<<~SQL)
      UPDATE #{fk_table}
      SET #{fk_column} = #{new_id}
      WHERE #{fk_column} = #{source_id}
        AND tenant_id = #{tenant_id}
    SQL
  end

  def clone_bpmn_process_for_tenant(source_id, tenant_id)
    cols = columns(:bpmn_processes).reject { |c| %w[id created_at updated_at].include?(c.name) }.map(&:name)

    source = execute("SELECT #{cols.join(', ')} FROM bpmn_processes WHERE id = #{source_id}").first
    return unless source

    name = source["name"]
    sync_key = slugify(name.to_s)
    sync_key = ensure_unique_sync_key(:bpmn_processes, tenant_id, sync_key)

    values = cols.map do |col|
      case col
      when "tenant_id" then tenant_id
      when "sync_key" then quote(sync_key)
      else source[col].nil? ? "NULL" : quote(source[col])
      end
    end

    new_id = execute(<<~SQL).first["id"]
      INSERT INTO bpmn_processes (#{cols.join(', ')}, created_at, updated_at)
      VALUES (#{values.join(', ')}, NOW(), NOW())
      RETURNING id
    SQL

    # Update both workflow FK references in sm_schedule_masters for this tenant
    execute(<<~SQL)
      UPDATE sm_schedule_masters
      SET start_workflow_id = #{new_id}
      WHERE start_workflow_id = #{source_id}
        AND tenant_id = #{tenant_id}
    SQL

    execute(<<~SQL)
      UPDATE sm_schedule_masters
      SET complete_workflow_id = #{new_id}
      WHERE complete_workflow_id = #{source_id}
        AND tenant_id = #{tenant_id}
    SQL

    # Clone child records (bpmn_nodes, bpmn_edges, bpmn_triggers)
    clone_bpmn_children(source_id, new_id)
  end

  def clone_bpmn_children(source_process_id, new_process_id)
    # Clone nodes, building ID map
    node_map = {}
    nodes = execute("SELECT * FROM bpmn_nodes WHERE bpmn_process_id = #{source_process_id}").to_a
    nodes.each do |node|
      old_id = node["id"]
      node_cols = node.keys.reject { |k| %w[id created_at updated_at].include?(k) }
      values = node_cols.map do |col|
        if col == "bpmn_process_id"
          new_process_id
        else
          node[col].nil? ? "NULL" : quote(node[col])
        end
      end

      new_node = execute(<<~SQL).first
        INSERT INTO bpmn_nodes (#{node_cols.join(', ')}, created_at, updated_at)
        VALUES (#{values.join(', ')}, NOW(), NOW())
        RETURNING id
      SQL
      node_map[old_id.to_i] = new_node["id"]
    end

    # Clone edges with remapped node IDs
    edges = execute("SELECT * FROM bpmn_edges WHERE bpmn_process_id = #{source_process_id}").to_a
    edges.each do |edge|
      edge_cols = edge.keys.reject { |k| %w[id created_at updated_at].include?(k) }
      values = edge_cols.map do |col|
        case col
        when "bpmn_process_id" then new_process_id
        when "source_node_id" then node_map[edge[col].to_i] || "NULL"
        when "target_node_id" then node_map[edge[col].to_i] || "NULL"
        else edge[col].nil? ? "NULL" : quote(edge[col])
        end
      end

      execute(<<~SQL)
        INSERT INTO bpmn_edges (#{edge_cols.join(', ')}, created_at, updated_at)
        VALUES (#{values.join(', ')}, NOW(), NOW())
      SQL
    end

    # Clone triggers
    triggers = execute("SELECT * FROM bpmn_triggers WHERE bpmn_process_id = #{source_process_id}").to_a
    triggers.each do |trigger|
      trigger_cols = trigger.keys.reject { |k| %w[id created_at updated_at].include?(k) }
      values = trigger_cols.map do |col|
        if col == "bpmn_process_id"
          new_process_id
        else
          trigger[col].nil? ? "NULL" : quote(trigger[col])
        end
      end

      execute(<<~SQL)
        INSERT INTO bpmn_triggers (#{trigger_cols.join(', ')}, created_at, updated_at)
        VALUES (#{values.join(', ')}, NOW(), NOW())
      SQL
    end
  end

  def slugify(str)
    str.strip
       .downcase
       .gsub(/[_\s.]+/, "-")
       .gsub(/[^a-z0-9\-]/, "")
       .gsub(/-{2,}/, "-")
       .gsub(/\A-|-\z/, "")
  end

  def ensure_unique_sync_key(table, tenant_id, sync_key)
    existing = execute(<<~SQL).first&.dig("count").to_i
      SELECT COUNT(*) AS count FROM #{table}
      WHERE tenant_id = #{tenant_id} AND sync_key = #{quote(sync_key)}
    SQL

    return sync_key if existing == 0

    # Append numeric suffix
    counter = 2
    loop do
      candidate = "#{sync_key}-#{counter}"
      count = execute(<<~SQL).first&.dig("count").to_i
        SELECT COUNT(*) AS count FROM #{table}
        WHERE tenant_id = #{tenant_id} AND sync_key = #{quote(candidate)}
      SQL
      return candidate if count == 0
      counter += 1
    end
  end

  def parse_pg_array(value)
    return [] if value.nil?
    return value if value.is_a?(Array)
    # Postgres arrays come as "{1,2,3}" strings
    value.to_s.gsub(/[{}]/, "").split(",").map(&:strip).reject(&:empty?).map(&:to_i)
  end

  def quote(value)
    ActiveRecord::Base.connection.quote(value)
  end

  def columns(table)
    ActiveRecord::Base.connection.columns(table)
  end
end
