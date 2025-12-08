namespace :email_warehouse do
  desc "Delete all spam emails from Outlook using org-wide credentials"
  task delete_spam: :environment do
    # Get org-wide Microsoft credentials
    credential = OrganizationMicrosoftAppCredential.active_credential

    if credential.nil?
      puts "No active organization Microsoft credential found!"
      exit 1
    end

    unless credential.status == "connected"
      puts "Microsoft credential is not connected (status: #{credential.status})"
      exit 1
    end

    puts "Using org-wide Microsoft credential (tenant: #{credential.tenant_id})"

    # Get valid access token
    access_token = credential.valid_access_token
    if access_token.nil?
      puts "Failed to get access token!"
      exit 1
    end

    spam_emails = EmailWarehouse.where("email_classification->>'email_type' = ?", "spam")
                                .where.not(outlook_id: nil)
                                .where("email_classification->>'deleted_from_outlook' IS NULL OR email_classification->>'deleted_from_outlook' != 'true'")
                                .includes(:synced_by_user)

    puts "Found #{spam_emails.count} spam emails to delete"

    deleted_count = 0
    failed_count = 0
    skipped_count = 0

    spam_emails.find_each do |email|
      begin
        # Get the user whose mailbox contains this email
        user = email.synced_by_user
        if user.nil? || user.email.blank?
          skipped_count += 1
          next
        end

        # Delete via Graph API using application permissions
        # Format: DELETE /users/{user-email}/messages/{message-id}
        url = "https://graph.microsoft.com/v1.0/users/#{user.email}/messages/#{email.outlook_id}"
        response = HTTP.auth("Bearer #{access_token}").delete(url)

        if response.status.success? || response.status == 404  # 404 = already deleted
          email.update!(
            email_classification: (email.email_classification || {}).merge(
              "deleted_from_outlook" => true,
              "deleted_at" => Time.current.iso8601
            )
          )
          deleted_count += 1
          print "." if deleted_count % 10 == 0
        else
          puts "\nFailed to delete email #{email.id}: #{response.status} - #{response.body.to_s.truncate(100)}"
          failed_count += 1
        end
      rescue => e
        puts "\nError on email #{email.id}: #{e.message}"
        failed_count += 1
      end
    end

    puts "\n\nCompleted! Deleted: #{deleted_count}, Failed: #{failed_count}, Skipped: #{skipped_count}"
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
