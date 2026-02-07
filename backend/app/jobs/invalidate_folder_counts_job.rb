# frozen_string_literal: true

# InvalidateFolderCountsJob - Mark folder count caches as stale
#
# Called after WarehouseDocument create/update/destroy to invalidate
# all parent path prefixes in WarehouseFolderCount.
#
# Usage:
#   InvalidateFolderCountsJob.perform_later(tenant_id, ["Job/Active/J-001/Photo"])
#
class InvalidateFolderCountsJob < ApplicationJob
  queue_as :default

  def perform(tenant_id, folder_paths)
    return if folder_paths.blank?

    Array(folder_paths).each do |path|
      WarehouseFolderCount.invalidate_path(tenant_id, path)
    end
  end
end
