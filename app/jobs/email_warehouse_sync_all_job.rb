class EmailWarehouseSyncAllJob < ApplicationJob
  queue_as :low

  # Periodic job to sync all connected users
  # Should be scheduled to run every 10 minutes
  def perform
    # Find all users with valid Outlook credentials who need sync
    users_to_sync = User.joins(:outlook_credential)
                        .joins('LEFT JOIN email_sync_statuses ON email_sync_statuses.user_id = users.id')
                        .where('email_sync_statuses.id IS NULL OR email_sync_statuses.status != ? OR email_sync_statuses.last_sync_at < ?',
                               'syncing', 10.minutes.ago)

    users_to_sync.find_each do |user|
      next unless user.outlook_credential&.valid_credential?

      # Queue individual sync job for each user
      EmailWarehouseSyncJob.perform_later(user.id, 'incremental')
    end

    Rails.logger.info "EmailWarehouseSyncAllJob: Queued sync for #{users_to_sync.count} users"
  rescue StandardError => e
    Rails.logger.error "EmailWarehouseSyncAllJob failed: #{e.message}"
  end
end
