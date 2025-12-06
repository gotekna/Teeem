class EmailWarehouseSyncJob < ApplicationJob
  queue_as :default

  # Full sync for a specific user (initial sync or manual trigger)
  def perform(user_id, sync_type = "incremental")
    user = User.find_by(id: user_id)
    return unless user
    return unless user.outlook_credential&.valid_credential?

    service = EmailWarehouseSyncService.new(user)

    case sync_type
    when "full"
      service.full_sync!
    when "incremental"
      service.incremental_sync!
    end
  rescue EmailWarehouseSyncService::SyncError => e
    Rails.logger.error "EmailWarehouseSyncJob failed for user #{user_id}: #{e.message}"
  rescue StandardError => e
    Rails.logger.error "EmailWarehouseSyncJob unexpected error for user #{user_id}: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
  end
end
