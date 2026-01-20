# frozen_string_literal: true

namespace :email do
  desc "Sync attachments for a specific email from Microsoft Graph"
  task :sync_attachments, [:email_id] => :environment do |_t, args|
    email_id = args[:email_id]
    abort "Usage: rails email:sync_attachments[EMAIL_ID]" if email_id.blank?

    email = SyncedEmail.find(email_id)
    puts "Email ##{email.id}: #{email.subject}"
    puts "  From: #{email.from_email}"
    puts "  has_attachments: #{email.has_attachments}"
    puts "  Current email_attachments: #{email.email_attachments.count}"

    unless email.has_attachments
      puts "  No attachments to sync"
      exit
    end

    unless email.microsoft_credential_id.present?
      puts "  ERROR: No Microsoft credential linked"
      exit
    end

    cred = MicrosoftCredential.find(email.microsoft_credential_id)
    client = MicrosoftAppGraphClient.new(cred)

    # Get attachments from Graph API
    attachments = client.get_email_attachments(email.mailbox_owner_email, email.outlook_id)
    puts "  Found #{attachments.count} attachments from Graph API"

    synced = 0
    skipped = 0

    attachments.each do |att|
      next if att["contentBytes"].blank?

      content = Base64.decode64(att["contentBytes"])
      filename = att["name"]
      content_type = att["contentType"]
      byte_size = att["size"].to_i

      # Skip small images (likely email signatures)
      if content_type&.start_with?("image/") && byte_size < 50_000
        puts "    Skipping: #{filename} (small image)"
        skipped += 1
        next
      end

      # Find existing or create new EmailAttachment
      ea = EmailAttachment.find_by(synced_email_id: email.id, filename: filename)
      if ea.nil?
        # Table was created without auto-increment, so manually assign ID
        next_id = (EmailAttachment.maximum(:id) || 0) + 1
        ea = EmailAttachment.new(id: next_id, synced_email_id: email.id, filename: filename)
        ea.save!
      end

      # Store content (handles blob creation/deduplication)
      ea.store_content!(content, filename: filename, content_type: content_type)

      puts "    Synced: #{filename} (EA ##{ea.id}, blob ##{ea.storage_blob_id})"
      synced += 1
    end

    puts ""
    puts "Done! Synced: #{synced}, Skipped: #{skipped}"
    puts "Total attachments: #{email.email_attachments.reload.count}"
  end

  desc "Sync attachments for all emails missing them (batch)"
  task :sync_missing_batch, [:limit] => :environment do |_t, args|
    limit = (args[:limit] || 100).to_i

    fixable = SyncedEmail
      .where(has_attachments: true)
      .where.not(outlook_id: nil, mailbox_owner_email: nil, microsoft_credential_id: nil)
      .left_joins(:email_attachments)
      .where(email_attachments: { id: nil })
      .order(received_at: :desc)
      .limit(limit)

    total = fixable.count
    puts "Processing #{total} emails with missing attachments..."
    puts ""

    synced = 0
    failed = 0

    fixable.each_with_index do |email, idx|
      print "[#{idx + 1}/#{total}] #{email.id}: #{email.subject.to_s[0..50]}... "
      begin
        email.sync_attachments!
        synced += 1
        puts "OK"
      rescue StandardError => e
        failed += 1
        puts "ERROR: #{e.message[0..50]}"
      end
    end

    puts ""
    puts "=" * 50
    puts "Batch complete: #{synced} synced, #{failed} failed"

    remaining = SyncedEmail
      .where(has_attachments: true)
      .where.not(outlook_id: nil, mailbox_owner_email: nil, microsoft_credential_id: nil)
      .left_joins(:email_attachments)
      .where(email_attachments: { id: nil })
      .count
    puts "Remaining to sync: #{remaining}"
  end

  desc "Enqueue batch attachment sync jobs (parallel workers)"
  task :sync_missing_jobs, [:limit] => :environment do |_t, args|
    limit = (args[:limit] || 500).to_i

    remaining = SyncedEmail
      .where(has_attachments: true)
      .where.not(outlook_id: nil, mailbox_owner_email: nil, microsoft_credential_id: nil)
      .left_joins(:email_attachments)
      .where(email_attachments: { id: nil })
      .count

    puts "Emails needing attachment sync: #{remaining}"
    puts "Enqueuing #{[limit, remaining].min} jobs..."
    puts ""

    result = BatchSyncEmailAttachmentsJob.perform_now(limit: limit)

    puts ""
    puts "=" * 50
    puts "Enqueued: #{result[:enqueued]} jobs"
    puts "Remaining after this batch: #{result[:remaining]}"
    puts ""
    puts "Jobs will be processed by Solid Queue workers in parallel."
    puts "Monitor progress: rails email:sync_status"
  end

  desc "Check attachment sync status"
  task sync_status: :environment do
    total_with_attachments = SyncedEmail.where(has_attachments: true).count
    synced = SyncedEmail
      .where(has_attachments: true)
      .joins(:email_attachments)
      .distinct
      .count
    pending = SyncedEmail
      .where(has_attachments: true)
      .where.not(outlook_id: nil, mailbox_owner_email: nil, microsoft_credential_id: nil)
      .left_joins(:email_attachments)
      .where(email_attachments: { id: nil })
      .count
    unsyncable = total_with_attachments - synced - pending

    puts "=" * 50
    puts "Email Attachment Sync Status"
    puts "=" * 50
    puts "Total emails with attachments: #{total_with_attachments}"
    puts "  Synced:     #{synced}"
    puts "  Pending:    #{pending} (can be synced)"
    puts "  Unsyncable: #{unsyncable} (missing outlook_id/credential)"
    puts ""

    # Check queue status if Solid Queue
    if defined?(SolidQueue)
      queued = SolidQueue::Job.where(class_name: "SyncEmailAttachmentsJob").where(finished_at: nil).count
      puts "Jobs in queue: #{queued}"
    end
  end

  desc "Sync batch with offset (for parallel workers)"
  task :sync_worker, [:worker_id, :total_workers, :batch_size] => :environment do |_t, args|
    worker_id = (args[:worker_id] || 0).to_i
    total_workers = (args[:total_workers] || 4).to_i
    batch_size = (args[:batch_size] || 200).to_i

    puts "Worker #{worker_id + 1}/#{total_workers} starting (batch_size: #{batch_size})..."

    loop do
      # Get all fixable email IDs
      all_ids = SyncedEmail
        .where(has_attachments: true)
        .where.not(outlook_id: nil, mailbox_owner_email: nil, microsoft_credential_id: nil)
        .left_joins(:email_attachments)
        .where(email_attachments: { id: nil })
        .order(:id)
        .pluck(:id)

      break if all_ids.empty?

      # Each worker takes every Nth email (interleaved)
      my_ids = all_ids.select.with_index { |_, i| i % total_workers == worker_id }
      my_batch = my_ids.first(batch_size)

      break if my_batch.empty?

      puts "[Worker #{worker_id + 1}] Processing #{my_batch.size} emails (#{all_ids.size} total remaining)..."

      synced = 0
      failed = 0

      my_batch.each_with_index do |email_id, idx|
        email = SyncedEmail.find_by(id: email_id)
        next unless email

        print "[#{idx + 1}/#{my_batch.size}] #{email_id}... "
        begin
          email.sync_attachments!
          synced += 1
          puts "OK"
        rescue StandardError => e
          failed += 1
          puts "ERROR: #{e.message[0..40]}"
        end
      end

      puts "[Worker #{worker_id + 1}] Batch done: #{synced} synced, #{failed} failed"
    end

    puts "[Worker #{worker_id + 1}] Complete!"
  end

  desc "Link existing attachments from related emails (SSoT - no download needed)"
  task :link_existing, [:limit] => :environment do |_t, args|
    limit = (args[:limit] || 1000).to_i

    pending = SyncedEmail
      .where(has_attachments: true)
      .left_joins(:email_attachments)
      .where(email_attachments: { id: nil })
      .limit(limit)

    total = pending.count
    puts "Checking #{total} emails for linkable attachments..."
    puts ""

    linked = 0
    need_download = 0

    pending.find_each do |email|
      if email.link_existing_attachments!
        linked += 1
        puts "✓ Linked: #{email.id} - #{email.subject.to_s[0..50]}"
      else
        need_download += 1
      end
    end

    puts ""
    puts "=" * 50
    puts "Done: #{linked} linked from existing, #{need_download} still need download"

    remaining = SyncedEmail
      .where(has_attachments: true)
      .left_joins(:email_attachments)
      .where(email_attachments: { id: nil })
      .count
    puts "Total remaining: #{remaining}"
  end

  desc "Enqueue ALL missing attachments in batches (run multiple times or let queue drain)"
  task :sync_all, [:batch_size] => :environment do |_t, args|
    batch_size = (args[:batch_size] || 500).to_i

    remaining = SyncedEmail
      .where(has_attachments: true)
      .where.not(outlook_id: nil, mailbox_owner_email: nil, microsoft_credential_id: nil)
      .left_joins(:email_attachments)
      .where(email_attachments: { id: nil })
      .count

    puts "Total emails needing sync: #{remaining}"
    puts "Enqueuing in batches of #{batch_size}..."
    puts ""

    batches = (remaining.to_f / batch_size).ceil
    total_enqueued = 0

    batches.times do |i|
      result = BatchSyncEmailAttachmentsJob.perform_now(limit: batch_size)
      total_enqueued += result[:enqueued]
      puts "Batch #{i + 1}/#{batches}: enqueued #{result[:enqueued]}, remaining: #{result[:remaining]}"
      break if result[:remaining] <= 0
    end

    puts ""
    puts "=" * 50
    puts "Total enqueued: #{total_enqueued} jobs"
    puts "Workers will process these in parallel."
  end
end
