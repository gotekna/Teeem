# frozen_string_literal: true

# Email Attachment Backfill - Re-sync missing attachments to Wasabi
#
# FRC (Feb 2026): OrgEmailSyncJob was missing ActsAsTenant.current_tenant,
# causing StorageBlob.storage_provider to raise TenantNotFoundError.
# This meant ~99% of email attachments never made it to Wasabi storage.
# The fix (ActsAsTenant.with_tenant) is deployed - this task backfills
# attachments for emails that were synced before the fix.
#
# Usage:
#   # Preview what needs backfilling
#   rails email:attachments:preview
#
#   # Backfill attachments (default: 100 emails per run)
#   rails email:attachments:backfill[100]
#
#   # Backfill for a specific mailbox only
#   rails email:attachments:backfill[100,rachel@tekna.com.au]
#
#   # Dry run (show what would be done without doing it)
#   rails email:attachments:backfill[100,,dry]
#
namespace :email do
  namespace :attachments do
    desc "Preview email attachment backfill status"
    task preview: :environment do
      tenant = Tenant.first
      unless tenant
        puts "ERROR: No tenant found"
        exit 1
      end

      ActsAsTenant.with_tenant(tenant) do
        puts "=" * 70
        puts "EMAIL ATTACHMENT BACKFILL STATUS"
        puts "=" * 70
        puts ""

        total_with_attachments = SyncedEmail.where(has_attachments: true).count
        total_attachment_docs = WarehouseDocument.where(source_type: "email_attachment").count

        # Find emails that have has_attachments=true but no attachment docs
        emails_with_docs = WarehouseDocument.where(source_type: "email_attachment")
                                            .select("DISTINCT metadata->>'synced_email_id'")
                                            .pluck(Arel.sql("DISTINCT metadata->>'synced_email_id'"))
                                            .compact
                                            .map(&:to_i)

        missing_count = SyncedEmail.where(has_attachments: true)
                                   .where.not(id: emails_with_docs)
                                   .where.not(outlook_id: [nil, ""])
                                   .where.not(mailbox_owner_email: [nil, ""])
                                   .count

        puts "Total emails with has_attachments=true:  #{total_with_attachments}"
        puts "Total attachment docs in Wasabi:         #{total_attachment_docs}"
        puts "Emails with docs linked:                 #{emails_with_docs.count}"
        puts "Emails MISSING attachment docs:          #{missing_count}"
        puts ""

        # Break down by mailbox
        puts "Missing by mailbox:"
        SyncedEmail.where(has_attachments: true)
                   .where.not(id: emails_with_docs)
                   .where.not(outlook_id: [nil, ""])
                   .where.not(mailbox_owner_email: [nil, ""])
                   .group(:mailbox_owner_email)
                   .count
                   .sort_by { |_, v| -v }
                   .each do |mailbox, count|
          puts "  #{mailbox}: #{count}"
        end

        # Break down by age
        puts ""
        puts "Missing by age:"
        [7, 30, 90, 365].each do |days|
          count = SyncedEmail.where(has_attachments: true)
                             .where.not(id: emails_with_docs)
                             .where.not(outlook_id: [nil, ""])
                             .where("received_at >= ?", days.days.ago)
                             .count
          puts "  Last #{days} days: #{count}"
        end

        puts ""
        puts "To backfill, run:"
        puts "  rails email:attachments:backfill[100]           # First 100"
        puts "  rails email:attachments:backfill[500]           # First 500"
        puts "  rails email:attachments:backfill[100,user@co]   # Specific mailbox"
      end
    end

    desc "Backfill missing email attachments from Outlook to Wasabi"
    task :backfill, [:limit, :mailbox, :mode] => :environment do |_t, args|
      limit = (args[:limit] || 100).to_i
      mailbox_filter = args[:mailbox].presence
      dry_run = args[:mode] == "dry"

      tenant = Tenant.first
      unless tenant
        puts "ERROR: No tenant found"
        exit 1
      end

      ActsAsTenant.with_tenant(tenant) do
        puts "=" * 70
        puts dry_run ? "EMAIL ATTACHMENT BACKFILL (DRY RUN)" : "EMAIL ATTACHMENT BACKFILL"
        puts "=" * 70
        puts ""

        # Find emails that have has_attachments=true but no attachment docs
        emails_with_docs = WarehouseDocument.where(source_type: "email_attachment")
                                            .pluck(Arel.sql("DISTINCT metadata->>'synced_email_id'"))
                                            .compact
                                            .map(&:to_i)

        scope = SyncedEmail.where(has_attachments: true)
                           .where.not(id: emails_with_docs)
                           .where.not(outlook_id: [nil, ""])
                           .where.not(mailbox_owner_email: [nil, ""])
                           .where.not(microsoft_credential_id: nil)
                           .order(received_at: :desc) # Most recent first

        scope = scope.where(mailbox_owner_email: mailbox_filter) if mailbox_filter

        total_missing = scope.count
        batch_size = [limit, total_missing].min

        puts "Total missing:     #{total_missing}"
        puts "Batch size:        #{batch_size}"
        puts "Mailbox filter:    #{mailbox_filter || 'all'}"
        puts ""

        if total_missing == 0
          puts "Nothing to backfill!"
          next
        end

        stats = { synced: 0, skipped: 0, errors: [], attachment_count: 0 }
        credential_cache = {}

        scope.limit(batch_size).find_each.with_index do |email, i|
          if dry_run
            puts "  [DRY] Would sync email #{email.id}: #{email.subject&.truncate(50)} (#{email.mailbox_owner_email})"
            stats[:synced] += 1
            next
          end

          begin
            # Cache credential lookups
            cred = credential_cache[email.microsoft_credential_id] ||=
              MicrosoftCredential.find_by(id: email.microsoft_credential_id)

            unless cred&.status == "connected"
              stats[:skipped] += 1
              print "S"
              next
            end

            before_count = email.attachment_documents.count
            email.send(:"sync_attachments!")
            after_count = email.attachment_documents.reload.count
            new_attachments = after_count - before_count

            stats[:synced] += 1
            stats[:attachment_count] += new_attachments
            print new_attachments > 0 ? "+" : "."

          rescue StandardError => e
            stats[:errors] << { id: email.id, subject: email.subject&.truncate(40), error: e.message }
            print "E"
          end

          # Progress every 50
          if (i + 1) % 50 == 0
            puts " #{i + 1}/#{batch_size} (#{stats[:synced]} synced, #{stats[:attachment_count]} attachments, #{stats[:errors].count} errors)"
          end

          # Rate limit: don't hammer Outlook Graph API
          sleep(0.2) if (i + 1) % 10 == 0
        end

        puts ""
        puts ""
        puts "=" * 70
        puts "BACKFILL COMPLETE"
        puts "=" * 70
        puts "Processed:    #{stats[:synced]}"
        puts "Skipped:      #{stats[:skipped]} (credential disconnected)"
        puts "Attachments:  #{stats[:attachment_count]} uploaded to Wasabi"
        puts "Errors:       #{stats[:errors].count}"
        puts "Remaining:    #{total_missing - batch_size}"

        if stats[:errors].any?
          puts ""
          puts "Errors (first 20):"
          stats[:errors].first(20).each do |err|
            puts "  Email #{err[:id]} (#{err[:subject]}): #{err[:error]}"
          end
        end

        if total_missing > batch_size
          puts ""
          puts "More emails need backfilling. Run again:"
          puts "  rails email:attachments:backfill[#{batch_size}#{mailbox_filter ? ",#{mailbox_filter}" : ""}]"
        end
      end
    end
  end
end
