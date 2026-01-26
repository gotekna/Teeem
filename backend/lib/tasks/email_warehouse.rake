namespace :synced_email do
  desc "Show email and attachment migration status (storage migration)"
  task migration_stats: :environment do
    em = SyncedEmail.where.not(storage_path: nil).count
    ep = SyncedEmail.where(storage_path: nil).count
    am = EmailAttachment.where.not(storage_blob_id: nil).count
    ap = EmailAttachment.where(storage_blob_id: nil).count

    puts "MIGRATION_STATS:#{em}|#{ep}|#{am}|#{ap}"
  end

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

    spam_emails = SyncedEmail.where("email_classification->>'email_type' = ?", "spam")
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
    unclassified = SyncedEmail.where("email_classification IS NULL OR email_classification = '{}'")
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
    business_emails = SyncedEmail.where("email_classification->>'email_type' = ?", "business")
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

  desc "Backfill WarehouseDocuments for existing SyncedEmails (Phase 4: Virtual File Warehouse)"
  task backfill_warehouse_documents: :environment do
    # Find emails with storage_path but no warehouse_document
    emails_needing_backfill = SyncedEmail
      .left_joins(:warehouse_document)
      .where(warehouse_documents: { id: nil })
      .where.not(storage_path: [nil, ""])

    total = emails_needing_backfill.count
    puts "=" * 60
    puts "BACKFILL: WarehouseDocuments for SyncedEmails"
    puts "=" * 60
    puts "Emails with storage_path but no WarehouseDocument: #{total}"
    puts ""

    if total == 0
      puts "Nothing to backfill!"
      exit 0
    end

    created = 0
    skipped = 0
    errors = 0
    batch_size = 1000

    puts "Processing in batches of #{batch_size}..."
    puts ""

    emails_needing_backfill.find_each(batch_size: batch_size) do |email|
      begin
        # Find or create StorageBlob for this path
        blob = StorageBlob.find_or_create_by!(storage_path: email.storage_path) do |b|
          b.content_hash = Digest::SHA256.hexdigest("#{email.id}-#{email.storage_path}")
          b.original_filename = "#{email.id}.eml"
          b.content_type = "message/rfc822"
          b.reference_count = 0
        end

        # Create WarehouseDocument with virtual folder path
        email.create_warehouse_document!(
          source_type: "email",
          folder: email.virtual_folder_path,
          display_name: email.subject.presence || "No Subject",
          original_filename: "#{email.id}.eml",
          storage_blob: blob,
          metadata: {
            subject: email.subject,
            from_email: email.from_email,
            received_at: email.received_at&.iso8601,
            mailbox: email.mailbox_owner_email
          }
        )

        # Increment blob reference count
        blob.increment!(:reference_count)

        created += 1
        print "." if created % 100 == 0
        print " #{created}/#{total}\n" if created % 1000 == 0
      rescue ActiveRecord::RecordNotUnique
        # WarehouseDocument already exists (race condition)
        skipped += 1
      rescue => e
        errors += 1
        puts "\nError for email #{email.id}: #{e.message}" if errors <= 10
      end
    end

    puts ""
    puts "=" * 60
    puts "BACKFILL COMPLETE"
    puts "=" * 60
    puts "Created:  #{created}"
    puts "Skipped:  #{skipped}"
    puts "Errors:   #{errors}"
    puts ""

    # Verify counts
    final_count = WarehouseDocument.where(source_type: "email").count
    emails_with_storage = SyncedEmail.where.not(storage_path: [nil, ""]).count
    puts "Final verification:"
    puts "  SyncedEmails with storage_path: #{emails_with_storage}"
    puts "  WarehouseDocuments (email):     #{final_count}"
    puts "  Coverage: #{(final_count.to_f / emails_with_storage * 100).round(1)}%"
  end

  desc "Show warehouse document stats for emails"
  task warehouse_stats: :environment do
    puts "=" * 60
    puts "EMAIL WAREHOUSE DOCUMENT STATS"
    puts "=" * 60
    puts ""

    total_emails = SyncedEmail.count
    emails_with_storage = SyncedEmail.where.not(storage_path: [nil, ""]).count
    emails_without_storage = SyncedEmail.where(storage_path: [nil, ""]).count

    warehouse_docs = WarehouseDocument.where(source_type: "email").count
    warehouse_with_folder = WarehouseDocument.where(source_type: "email").where.not(folder: [nil, ""]).count
    warehouse_without_folder = WarehouseDocument.where(source_type: "email").where(folder: [nil, ""]).count

    emails_missing_warehouse = SyncedEmail
      .left_joins(:warehouse_document)
      .where(warehouse_documents: { id: nil })
      .where.not(storage_path: [nil, ""])
      .count

    puts "SyncedEmails:"
    puts "  Total:            #{total_emails}"
    puts "  With storage:     #{emails_with_storage}"
    puts "  Without storage:  #{emails_without_storage}"
    puts ""
    puts "WarehouseDocuments (email):"
    puts "  Total:            #{warehouse_docs}"
    puts "  With folder:      #{warehouse_with_folder}"
    puts "  Without folder:   #{warehouse_without_folder}"
    puts ""
    puts "Gap Analysis:"
    puts "  Emails needing backfill: #{emails_missing_warehouse}"
    puts ""

    # Check virtual_scopes configuration
    config = StorageConfiguration.instance
    email_virtual = config&.virtual_scope?(:email) || false
    puts "StorageConfiguration:"
    puts "  virtual_scopes['email']: #{email_virtual}"

    if emails_missing_warehouse > 0
      puts ""
      puts "Run 'rails synced_email:backfill_warehouse_documents' to backfill"
    end
  end
end
