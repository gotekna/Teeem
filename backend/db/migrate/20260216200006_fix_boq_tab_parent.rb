class FixBoqTabParent < ActiveRecord::Migration[8.0]
  def up
    # Previous migration (20260216200005) searched for parent_id: nil but on production
    # the BOQ tab was created with parent_id: estimates_tab.id. This migration finds
    # ALL BOQ tabs regardless of current parent and moves them under the "jobs" tab.
    ActsAsTenant.without_tenant do
      job_wt = WarehouseType.where(code: 'job').first
      return unless job_wt

      # Find ALL BOQ tabs for this warehouse type (regardless of parent_id)
      WarehouseFolder.where(warehouse_type_id: job_wt.id, tab_key: "boq").find_each do |boq_tab|
        jobs_tab = WarehouseFolder.find_by(
          warehouse_type_id: job_wt.id,
          tab_key: "jobs",
          parent_id: nil,
          tenant_id: boq_tab.tenant_id
        )
        next unless jobs_tab
        next if boq_tab.parent_id == jobs_tab.id # Already correct

        boq_tab.update_columns(
          parent_id: jobs_tab.id,
          order_position: 2
        )
        Rails.logger.info "Moved BOQ tab (id=#{boq_tab.id}) under Jobs tab (id=#{jobs_tab.id}) for tenant #{boq_tab.tenant_id}"
      end
    end
  end

  def down
    # No-op: previous migration's down handles reverting
  end
end
