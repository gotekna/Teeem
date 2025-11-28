namespace :email_warehouse do
  desc "Run full sync for all connected Outlook users"
  task full_sync: :environment do
    users_with_outlook = User.joins(:outlook_credential).to_a
    puts "Found #{users_with_outlook.count} users with Outlook connected"

    users_with_outlook.each do |user|
      puts "\nSyncing for user #{user.id}: #{user.email}"
      begin
        service = EmailWarehouseSyncService.new(user)
        count = service.full_sync!
        puts "  Synced #{count} emails"
      rescue => e
        puts "  ERROR: #{e.class} - #{e.message}"
        puts "  Backtrace: #{e.backtrace.first(5).join("\n  ")}"
      end
    end

    puts "\n"
    puts "Total emails in warehouse: #{EmailWarehouse.count}"
    puts "Assigned to jobs: #{EmailWarehouse.assigned.count}"
    puts "Unassigned: #{EmailWarehouse.unassigned.count}"
  end

  desc "Refresh all Outlook tokens"
  task refresh_tokens: :environment do
    users_with_outlook = User.joins(:outlook_credential).to_a
    puts "Found #{users_with_outlook.count} users with Outlook credentials"

    users_with_outlook.each do |user|
      cred = user.outlook_credential
      puts "\nUser #{user.id}: #{user.email}"
      puts "  Expired: #{cred.expired?}"
      puts "  Expires at: #{cred.expires_at}"

      if cred.expired?
        puts "  Refreshing token..."
        result = cred.refresh!
        puts "  Refresh result: #{result}"
        cred.reload
        puts "  New expires at: #{cred.expires_at}"
        puts "  Now expired: #{cred.expired?}"
      end
    end
  end

  desc "Show warehouse stats"
  task stats: :environment do
    puts "Email Warehouse Stats"
    puts "====================="
    puts "Total emails: #{EmailWarehouse.count}"
    puts "Assigned to jobs: #{EmailWarehouse.assigned.count}"
    puts "Unassigned: #{EmailWarehouse.unassigned.count}"
    puts "Unique conversations: #{EmailWarehouse.distinct.count(:conversation_id)}"
    puts "Oldest email: #{EmailWarehouse.minimum(:received_at)}"
    puts "Newest email: #{EmailWarehouse.maximum(:received_at)}"
  end

  desc "Clear stuck sync status"
  task clear_status: :environment do
    EmailSyncStatus.find_each do |status|
      status.update(
        status: 'completed',
        last_sync_at: Time.current,
        total_emails_synced: EmailWarehouse.count
      )
      puts "Cleared status for user #{status.user_id}"
    end
    puts "Done. Total emails in warehouse: #{EmailWarehouse.count}"
  end
end
