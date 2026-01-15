# frozen_string_literal: true

namespace :email do
  desc "Sync attachments for a specific email from Microsoft Graph"
  task :sync_attachments, [:email_id] => :environment do |_t, args|
    email_id = args[:email_id]
    abort "Usage: rails email:sync_attachments[EMAIL_ID]" if email_id.blank?

    email = EmailWarehouse.find(email_id)
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
      ea = EmailAttachment.find_by(email_warehouse_id: email.id, filename: filename)
      if ea.nil?
        # Table was created without auto-increment, so manually assign ID
        next_id = (EmailAttachment.maximum(:id) || 0) + 1
        ea = EmailAttachment.new(id: next_id, email_warehouse_id: email.id, filename: filename)
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

    fixable = EmailWarehouse
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

    remaining = EmailWarehouse
      .where(has_attachments: true)
      .where.not(outlook_id: nil, mailbox_owner_email: nil, microsoft_credential_id: nil)
      .left_joins(:email_attachments)
      .where(email_attachments: { id: nil })
      .count
    puts "Remaining to sync: #{remaining}"
  end
end
