namespace :emails do
  namespace :sharepoint do
    desc "Show SharePoint sync stats"
    task stats: :environment do
      puts "\n========================================="
      puts "Email SharePoint Sync Stats"
      puts "=========================================\n"

      service = EmailSharePointService.new
      stats = service.stats

      puts "Total emails:          #{stats[:total_emails]}"
      puts "Synced to SharePoint:  #{stats[:synced_to_sharepoint]}"
      puts "Pending sync:          #{stats[:pending_sync]}"
      puts "With body in DB:       #{stats[:with_body_text]}"
      puts "Body cleared (saved):  #{stats[:body_cleared]}"
      puts "\n"
    end

    desc "Sync pending emails to SharePoint (limit: ENV['LIMIT'] or 10)"
    task sync: :environment do
      limit = (ENV["LIMIT"] || 10).to_i
      only_business = ENV["ALL"] != "true"

      puts "\n========================================="
      puts "Syncing Emails to SharePoint"
      puts "=========================================\n"
      puts "Limit: #{limit}"
      puts "Only business emails: #{only_business}\n\n"

      service = EmailSharePointService.new
      results = service.sync_all_pending(limit: limit, only_business: only_business)

      puts "Processed: #{results[:processed]}"
      puts "Uploaded:  #{results[:uploaded]}"
      puts "Skipped:   #{results[:skipped]}"

      if results[:errors].any?
        puts "\nErrors (#{results[:errors].count}):"
        results[:errors].first(10).each do |error|
          puts "  - Email #{error[:email_id]}: #{error[:error]}"
        end
      end

      puts "\n"
    end

    desc "Sync emails for a specific domain (DOMAIN=tekna.com.au LIMIT=100)"
    task sync_domain: :environment do
      domain = ENV["DOMAIN"]
      limit = (ENV["LIMIT"] || 100).to_i

      unless domain
        puts "ERROR: DOMAIN is required"
        puts "Usage: rails emails:sharepoint:sync_domain DOMAIN=tekna.com.au LIMIT=100"
        exit 1
      end

      puts "\n========================================="
      puts "Syncing #{domain} Emails to SharePoint"
      puts "=========================================\n"
      puts "Limit: #{limit}\n\n"

      service = EmailSharePointService.new
      results = service.sync_domain(domain, limit: limit)

      puts "Processed: #{results[:processed]}"
      puts "Uploaded:  #{results[:uploaded]}"

      if results[:errors].any?
        puts "\nErrors (#{results[:errors].count}):"
        results[:errors].first(10).each do |error|
          puts "  - Email #{error[:email_id]}: #{error[:error]}"
        end
      end

      puts "\n"
    end

    desc "Sync emails for a specific user (USER=robert@tekna.com.au LIMIT=100)"
    task sync_user: :environment do
      user_email = ENV["USER"]
      limit = (ENV["LIMIT"] || 100).to_i

      unless user_email
        puts "ERROR: USER is required"
        puts "Usage: rails emails:sharepoint:sync_user USER=robert@tekna.com.au LIMIT=100"
        exit 1
      end

      puts "\n========================================="
      puts "Syncing #{user_email} Emails to SharePoint"
      puts "=========================================\n"
      puts "Limit: #{limit}\n\n"

      service = EmailSharePointService.new
      results = service.sync_user(user_email, limit: limit)

      puts "Processed: #{results[:processed]}"
      puts "Uploaded:  #{results[:uploaded]}"

      if results[:errors].any?
        puts "\nErrors (#{results[:errors].count}):"
        results[:errors].first(10).each do |error|
          puts "  - Email #{error[:email_id]}: #{error[:error]}"
        end
      end

      puts "\n"
    end

    desc "Clear body_text from emails already synced to SharePoint (frees DB space)"
    task clear_bodies: :environment do
      limit = (ENV["LIMIT"] || 100).to_i
      dry_run = ENV["DRY_RUN"] != "false"

      puts "\n========================================="
      puts "Clear Synced Email Bodies"
      puts "=========================================\n"

      if dry_run
        puts "DRY RUN - No changes will be made"
        puts "Set DRY_RUN=false to actually clear bodies\n\n"

        count = EmailWarehouse.synced_to_sharepoint.where.not(body_text: nil).count
        puts "Would clear body_text from #{count} emails"
      else
        puts "LIVE MODE - Clearing bodies from synced emails\n\n"

        service = EmailSharePointService.new
        results = service.clear_synced_bodies(limit: limit)

        puts "Cleared: #{results[:cleared]} email bodies"
      end

      puts "\n"
    end

    desc "Test sync a single email by ID"
    task :test, [ :email_id ] => :environment do |_t, args|
      email_id = args[:email_id] || ENV["EMAIL_ID"]

      unless email_id
        puts "ERROR: email_id is required"
        puts "Usage: rails 'emails:sharepoint:test[123]' or EMAIL_ID=123 rails emails:sharepoint:test"
        exit 1
      end

      email = EmailWarehouse.find(email_id)
      puts "\n========================================="
      puts "Test Sync Email ##{email.id}"
      puts "=========================================\n"
      puts "Subject: #{email.subject}"
      puts "From: #{email.from_email}"
      puts "Date: #{email.received_at}"
      puts "Direction: #{email.direction}"
      puts "SSoT Owner: #{email.ssot_owner&.email}\n\n"

      service = EmailSharePointService.new
      result = service.save_to_sharepoint(email)

      if result
        puts "SUCCESS!"
        puts "SharePoint File ID: #{result[:id]}"
        puts "SharePoint Path: #{email.reload.sharepoint_path}"
        puts "Web URL: #{result[:web_url]}"
      else
        puts "FAILED!"
        puts "Errors: #{service.results[:errors].inspect}"
      end

      puts "\n"
    end
  end
end
