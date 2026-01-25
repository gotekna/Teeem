# frozen_string_literal: true

namespace :eml do
  desc "Regenerate .eml files for emails with inline images (content_id)"
  task regenerate_with_inline_images: :environment do
    # Find emails that have attachments with content_id (inline images)
    # and already have a storage_path (were previously uploaded)
    emails_with_inline = SyncedEmail
      .joins(:email_attachments)
      .where.not(email_attachments: { content_id: [nil, ""] })
      .where.not(storage_path: [nil, ""])
      .distinct

    total = emails_with_inline.count
    puts "Found #{total} emails with inline images to regenerate"

    if total == 0
      puts "Nothing to do."
      exit 0
    end

    print "Proceed? (y/N): "
    answer = $stdin.gets&.chomp&.downcase
    unless answer == "y"
      puts "Aborted."
      exit 0
    end

    success = 0
    failed = 0

    emails_with_inline.find_each.with_index do |email, idx|
      print "\r[#{idx + 1}/#{total}] Regenerating email #{email.id}..."

      begin
        result = EmlGeneratorService.generate_and_upload(email)
        if result
          success += 1
        else
          failed += 1
          puts "\n  Failed: #{email.id} - generate returned nil"
        end
      rescue StandardError => e
        failed += 1
        puts "\n  Error: #{email.id} - #{e.message}"
      end
    end

    puts "\n\nComplete!"
    puts "  Success: #{success}"
    puts "  Failed: #{failed}"
  end

  desc "Regenerate .eml for a specific email ID"
  task :regenerate, [:email_id] => :environment do |_t, args|
    email_id = args[:email_id]
    unless email_id
      puts "Usage: rails eml:regenerate[EMAIL_ID]"
      exit 1
    end

    email = SyncedEmail.find_by(id: email_id)
    unless email
      puts "Email #{email_id} not found"
      exit 1
    end

    inline_count = email.email_attachments.where.not(content_id: [nil, ""]).count
    puts "Email: #{email.id}"
    puts "Subject: #{email.subject}"
    puts "Inline images: #{inline_count}"
    puts "Current path: #{email.storage_path}"
    puts ""

    print "Regenerate? (y/N): "
    answer = $stdin.gets&.chomp&.downcase
    unless answer == "y"
      puts "Aborted."
      exit 0
    end

    result = EmlGeneratorService.generate_and_upload(email)
    if result
      puts "Success! New path: #{result}"
    else
      puts "Failed to regenerate"
      exit 1
    end
  end

  desc "List emails with inline images that would be regenerated"
  task list_with_inline_images: :environment do
    emails = SyncedEmail
      .joins(:email_attachments)
      .where.not(email_attachments: { content_id: [nil, ""] })
      .where.not(storage_path: [nil, ""])
      .select("synced_emails.id, synced_emails.subject, synced_emails.storage_path, COUNT(email_attachments.id) as inline_count")
      .group("synced_emails.id")
      .order("inline_count DESC")
      .limit(50)

    puts "Emails with inline images (top 50):"
    puts "-" * 80
    emails.each do |email|
      puts "#{email.id.to_s.ljust(8)} | #{email.inline_count.to_s.ljust(3)} images | #{email.subject&.truncate(50)}"
    end
    puts "-" * 80
    puts "Total: #{SyncedEmail.joins(:email_attachments).where.not(email_attachments: { content_id: [nil, ''] }).where.not(storage_path: [nil, '']).distinct.count}"
  end
end
