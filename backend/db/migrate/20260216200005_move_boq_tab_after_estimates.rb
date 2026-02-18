class MoveBoqTabAfterEstimates < ActiveRecord::Migration[8.0]
  def up
    # BOQ is currently a root-level job tab at position 8.
    # It should be a child of the "jobs" tab, alongside:
    #   purchase-orders (0), estimates (1), purchase-order-lines (1), budget (2), whs (3), rain-log (4)
    # Place BOQ after budget (2) at position 2 (will sort alphabetically with budget).
    ActsAsTenant.without_tenant do
      job_wt = WarehouseType.where(code: 'job').first
      return unless job_wt

      WarehouseFolder.where(warehouse_type_id: job_wt.id, tab_key: "boq", parent_id: nil).find_each do |boq_tab|
        jobs_tab = WarehouseFolder.find_by(
          warehouse_type_id: job_wt.id,
          tab_key: "jobs",
          parent_id: nil,
          tenant_id: boq_tab.tenant_id
        )
        next unless jobs_tab

        boq_tab.update_columns(
          parent_id: jobs_tab.id,
          order_position: 2 # After estimates (1), alongside budget (2), before whs (3)
        )
        Rails.logger.info "Moved BOQ tab (id=#{boq_tab.id}) under Jobs tab (id=#{jobs_tab.id}) for tenant #{boq_tab.tenant_id}"
      end
    end
  end

  def down
    ActsAsTenant.without_tenant do
      job_wt = WarehouseType.where(code: 'job').first
      return unless job_wt

      WarehouseFolder.where(warehouse_type_id: job_wt.id, tab_key: "boq").where.not(parent_id: nil).find_each do |boq_tab|
        boq_tab.update_columns(parent_id: nil, order_position: 8)
        Rails.logger.info "Reverted BOQ tab (id=#{boq_tab.id}) to root level"
      end
    end
  end
end
