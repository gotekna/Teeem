namespace :email_warehouse do
  desc "Delete all spam emails from Outlook"
  task delete_spam: :environment do
    # Find a user with valid Outlook credentials
    user = User.joins(:outlook_credential).where("outlook_credentials.expires_at > ?", Time.current).first

    if user.nil?
      puts "No user with valid Outlook credentials found!"
      exit 1
    end

    puts "Using user: #{user.email}"

    outlook_service = OutlookService.new(user)
    spam_emails = EmailWarehouse.where("email_classification->>'email_type' = ?", "spam")
                                .where.not(outlook_id: nil)
                                .where("email_classification->>'deleted_from_outlook' IS NULL OR email_classification->>'deleted_from_outlook' != 'true'")

    puts "Found #{spam_emails.count} spam emails to delete"

    deleted_count = 0
    failed_count = 0

    spam_emails.find_each do |email|
      begin
        if outlook_service.delete_email(email.outlook_id)
          email.update!(
            email_classification: (email.email_classification || {}).merge(
              "deleted_from_outlook" => true,
              "deleted_at" => Time.current.iso8601
            )
          )
          deleted_count += 1
          print "." if deleted_count % 10 == 0
        else
          failed_count += 1
        end
      rescue => e
        puts "\nError on email #{email.id}: #{e.message}"
        failed_count += 1
      end
    end

    puts "\n\nCompleted! Deleted: #{deleted_count}, Failed: #{failed_count}"
  end

  desc "Run backfill job to set direction, body_preview, ssot_owner_id"
  task backfill_ssot: :environment do
    puts "Starting SSoT backfill..."
    BackfillEmailSsotJob.perform_now
    puts "Backfill complete!"
  end

  desc "Classify unclassified emails"
  task classify_emails: :environment do
    unclassified = EmailWarehouse.where("email_classification IS NULL OR email_classification = '{}'")
    total = unclassified.count
    puts "Found #{total} unclassified emails"

    classified = 0
    unclassified.find_each do |email|
      begin
        EmailClassificationService.new(email).classify!
        classified += 1
        print "." if classified % 100 == 0
      rescue => e
        puts "\nError classifying email #{email.id}: #{e.message}"
      end
    end

    puts "\n\nClassified #{classified} of #{total} emails"
  end

  desc "Generate AI summaries for business emails"
  task summarize_emails: :environment do
    business_emails = EmailWarehouse.where("email_classification->>'email_type' = ?", "business")
                                    .where(ai_summary: nil)
                                    .limit(100) # Start with a batch

    puts "Found #{business_emails.count} business emails to summarize"

    summarized = 0
    business_emails.find_each do |email|
      begin
        EmailSummaryService.new(email).summarize!
        summarized += 1
        print "."
      rescue => e
        puts "\nError summarizing email #{email.id}: #{e.message}"
      end
    end

    puts "\n\nSummarized #{summarized} emails"
  end

  desc "Enrich contacts from email signatures"
  task enrich_contacts: :environment do
    puts "Starting contact enrichment from email signatures..."
    EnrichContactsFromEmailsJob.perform_now
    puts "Contact enrichment complete!"
  end
end
