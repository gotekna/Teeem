# frozen_string_literal: true

# FRC Fix: Recompute job warehouse_document folder_paths that are missing
# {{JobStatus}}/{{JobType}} tokens.
#
# Root cause: Old hardcoded token extraction only knew about JobCode/JobName.
# Commit 57fbabecfa replaced it with config-driven extraction from
# warehouse_types.token_config, which now resolves all tokens.
#
# Affected: ~8 job documents with pattern "Job/J..." (missing status/type)
# Expected: "Job/Active Job/House Renovation/J201..." (with status/type)
class RecomputeJobWarehouseDocumentPaths < ActiveRecord::Migration[7.2]
  def up
    # Find job docs with old-style paths (JobCode immediately after "Job/")
    docs = WarehouseDocument.where("folder_path ~ ?", "^Job/J[0-9]")

    if docs.none?
      puts "[RecomputeJobPaths] No documents to fix"
      return
    end

    puts "[RecomputeJobPaths] Found #{docs.count} documents with old-style paths"

    computer = WarehousePathComputer.new
    fixed = 0

    docs.find_each do |doc|
      old_path = doc.folder_path

      # Ensure tenant context for path computation
      tenant = doc.tenant
      next unless tenant

      result = ActsAsTenant.with_tenant(tenant) do
        computer.compute(doc)
      end

      if result[:folder_path].present? && result[:folder_path] != old_path
        doc.update_columns(
          folder_path: result[:folder_path],
          warehouse_folder_id: result[:warehouse_folder_id],
          path_template_version: result[:path_template_version]
        )
        fixed += 1
        puts "  Fixed ##{doc.id}: #{old_path} → #{result[:folder_path]}"
      end
    end

    puts "[RecomputeJobPaths] Fixed #{fixed}/#{docs.count} documents"
  end

  def down
    # No rollback - paths are now correct
  end
end
