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
#   # Preview what needs backfilling (all tenants)
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
#   # Re-sync emails to discover missing attachments (idempotent)
#   rails email:attachments:resync[100]
#   rails email:attachments:resync[100,rachel@tekna.com.au]
#   rails email:attachments:resync[100,,dry]
#
#   # Fix blob_status metadata on existing docs
#   rails email:attachments:fix_blob_status
#
#   # Fix folder paths: "Email" → "Emails/..." for existing docs
#   rails email:attachments:fix_paths
#   rails email:attachments:fix_paths[dry]
#
namespace :email do
  namespace :attachments do
    desc "Preview email attachment backfill status (all tenants)"
    task preview: :environment do
      puts "=" * 70
      puts "EMAIL ATTACHMENT BACKFILL STATUS"
      puts "=" * 70

      Tenant.find_each do |tenant|
        ActsAsTenant.with_tenant(tenant) do
          total_with_attachments = SyncedEmail.where(has_attachments: true).count
          next if total_with_attachments == 0

          puts ""
          puts "-" * 70
          puts "TENANT: #{tenant.name} (id=#{tenant.id})"
          puts "-" * 70

          total_attachment_docs = WarehouseDocument.where(source_type: "email_attachment").count

          # Find emails that have has_attachments=true but no attachment docs
          emails_with_docs = WarehouseDocument.where(source_type: "email_attachment")
                                              .pluck(Arel.sql("DISTINCT metadata->>'synced_email_id'"))
                                              .compact
                                              .map(&:to_i)

          # Count emails reachable via legacy fields
          missing_via_legacy = SyncedEmail.where(has_attachments: true)
                                          .where.not(id: emails_with_docs)
                                          .where.not(microsoft_credential_id: nil)
                                          .count

          # Count emails reachable via SyncedEmailMailbox join table (M365)
          graph_join_ids = SyncedEmailMailbox.where.not(microsoft_credential_id: nil)
                                             .where.not(outlook_id: [nil, ""])
                                             .select(:synced_email_id)
          missing_via_graph_join = SyncedEmail.where(has_attachments: true)
                                              .where.not(id: emails_with_docs)
                                              .where(microsoft_credential_id: nil)
                                              .where(id: graph_join_ids)
                                              .count

          # Count emails reachable via IMAP only (no M365 credential at all)
          imap_join_ids = SyncedEmailMailbox.where.not(imap_credential_id: nil)
                                            .where.not(uid: nil)
                                            .select(:synced_email_id)
          missing_via_imap = SyncedEmail.where(has_attachments: true)
                                        .where.not(id: emails_with_docs)
                                        .where(microsoft_credential_id: nil)
                                        .where.not(id: graph_join_ids)
                                        .where(id: imap_join_ids)
                                        .count

          missing_count = missing_via_legacy + missing_via_graph_join + missing_via_imap

          puts "Total emails with has_attachments=true:  #{total_with_attachments}"
          puts "Total attachment docs in warehouse:      #{total_attachment_docs}"
          puts "Emails with docs linked:                 #{emails_with_docs.count}"
          puts "Emails MISSING attachment docs:          #{missing_count}"
          puts "  Via legacy M365 credential:            #{missing_via_legacy}"
          puts "  Via M365 join table:                   #{missing_via_graph_join}" if missing_via_graph_join > 0
          puts "  Via IMAP:                              #{missing_via_imap}" if missing_via_imap > 0

          # Docs with blobs but missing blob_status metadata
          docs_missing_status = WarehouseDocument.where(source_type: "email_attachment")
                                                  .where.not(storage_blob_id: nil)
                                                  .where("metadata IS NULL OR NOT (metadata ? 'blob_status')")
                                                  .count
          puts "Docs with blob but no blob_status:       #{docs_missing_status}" if docs_missing_status > 0

          # Docs without blobs (pending download)
          docs_no_blob = WarehouseDocument.where(source_type: "email_attachment")
                                          .where(storage_blob_id: nil)
                                          .count
          puts "Docs WITHOUT blob (need download):       #{docs_no_blob}" if docs_no_blob > 0

          # Folder path check
          bad_paths = WarehouseDocument.where(source_type: "email_attachment")
                                       .where(folder_path: "Email")
                                       .count
          puts "Docs with bad folder_path ('Email'):     #{bad_paths}" if bad_paths > 0

          # Break down by mailbox
          puts ""
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
        end
      end

      puts ""
      puts "=" * 70
      puts "To fix blob_status:         rails email:attachments:fix_blob_status"
      puts "To fix folder paths:        rails email:attachments:fix_paths"
      puts "To backfill (zero docs):    rails email:attachments:backfill[100]"
      puts "To resync (partial docs):   rails email:attachments:resync[100]"
      puts "To dry run:                 rails email:attachments:resync[100,,dry]"
    end

    desc "Fix folder paths: 'Email' → proper 'Emails/...' paths"
    task :fix_paths, [:mode] => :environment do |_t, args|
      dry_run = args[:mode] == "dry"

      puts "=" * 70
      puts dry_run ? "FIX FOLDER PATHS (DRY RUN)" : "FIX FOLDER PATHS"
      puts "=" * 70
      puts ""

      Tenant.find_each do |tenant|
        ActsAsTenant.with_tenant(tenant) do
          bad_docs = WarehouseDocument.where(source_type: "email_attachment", folder_path: "Email")
          count = bad_docs.count
          next if count == 0

          puts "Tenant #{tenant.name} (id=#{tenant.id}): #{count} docs with folder_path='Email'"

          fixed = 0
          errors = 0

          bad_docs.find_each do |doc|
            # Get the associated SyncedEmail to extract mailbox + date
            synced_email_id = doc.metadata&.dig("synced_email_id")
            email = synced_email_id ? SyncedEmail.find_by(id: synced_email_id) : nil

            # Also try via documentable
            email ||= doc.documentable if doc.documentable_type == "SyncedEmail"

            mailbox = email&.mailbox_owner_email || "Unknown"
            received_at = email&.received_at || doc.created_at || Time.current
            year = received_at.year.to_s
            month = format("%02d", received_at.month)

            new_path = "Emails/#{mailbox}/#{year}/#{month}"

            if dry_run
              puts "  [DRY] #{doc.id}: 'Email' → '#{new_path}'"
            else
              # Update folder_path and add mailbox to metadata if missing
              updates = { folder_path: new_path }

              if doc.metadata.blank? || doc.metadata["mailbox"].blank?
                new_meta = (doc.metadata || {}).merge("mailbox" => mailbox)
                updates[:metadata] = new_meta
              end

              doc.update_columns(updates)
              print "."
            end

            fixed += 1
          rescue StandardError => e
            errors += 1
            puts "\n  ERROR doc #{doc.id}: #{e.message}"
          end

          puts "" unless dry_run
          puts "  Fixed: #{fixed}, Errors: #{errors}"
        end
      end

      puts ""
      puts "Done!"
    end

    desc "Backfill missing email attachments from Outlook to Wasabi (all tenants)"
    task :backfill, [:limit, :mailbox, :mode] => :environment do |_t, args|
      limit = (args[:limit] || 100).to_i
      mailbox_filter = args[:mailbox].presence
      dry_run = args[:mode] == "dry"

      puts "=" * 70
      puts dry_run ? "EMAIL ATTACHMENT BACKFILL (DRY RUN)" : "EMAIL ATTACHMENT BACKFILL"
      puts "=" * 70
      puts ""

      Tenant.find_each do |tenant|
        ActsAsTenant.with_tenant(tenant) do
          # Find emails that have has_attachments=true but no attachment docs
          emails_with_docs = WarehouseDocument.where(source_type: "email_attachment")
                                              .pluck(Arel.sql("DISTINCT metadata->>'synced_email_id'"))
                                              .compact
                                              .map(&:to_i)

          # FRC (Feb 2026): Include emails reachable via ANY credential path:
          # 1) Legacy microsoft_credential_id on SyncedEmail
          # 2) SyncedEmailMailbox with M365 credentials (multi-tenant fallback)
          # 3) SyncedEmailMailbox with IMAP credentials (Gmail, Webcentral, etc.)
          scope = SyncedEmail.where(has_attachments: true)
                             .where.not(id: emails_with_docs)
                             .where(
                               "microsoft_credential_id IS NOT NULL OR id IN (" \
                               "SELECT synced_email_id FROM synced_email_mailboxes " \
                               "WHERE (microsoft_credential_id IS NOT NULL AND outlook_id IS NOT NULL AND outlook_id != '') " \
                               "OR (imap_credential_id IS NOT NULL AND uid IS NOT NULL))"
                             )
                             .order(received_at: :desc) # Most recent first

          if mailbox_filter
            if mailbox_filter.include?("@")
              # Exact email: "rach@lyw.org.au"
              scope = scope.where(mailbox_owner_email: mailbox_filter)
            else
              # Domain filter: "lyw.org.au" matches all @lyw.org.au mailboxes
              scope = scope.where("mailbox_owner_email LIKE ?", "%@#{mailbox_filter}")
            end
          end

          total_missing = scope.count
          next if total_missing == 0

          batch_size = [limit, total_missing].min

          puts "-" * 70
          puts "TENANT: #{tenant.name} (id=#{tenant.id})"
          puts "-" * 70
          puts "Total missing:     #{total_missing}"
          puts "Batch size:        #{batch_size}"
          puts "Mailbox filter:    #{mailbox_filter || 'all'}"
          puts ""

          stats = { synced: 0, skipped: 0, errors: [], attachment_count: 0 }

          scope.limit(batch_size).find_each.with_index do |email, i|
            if dry_run
              puts "  [DRY] Would sync email #{email.id}: #{email.subject&.truncate(50)} (#{email.mailbox_owner_email})"
              stats[:synced] += 1
              next
            end

            begin
              # sync_attachments! now handles multi-credential resolution internally
              # (tries legacy fields first, then SyncedEmailMailbox join table)
              before_count = email.attachment_documents.count
              email.sync_attachments!
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
          puts "RESULTS for #{tenant.name}:"
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

          puts ""
        end
      end

      puts "=" * 70
      puts "BACKFILL COMPLETE"
      puts "=" * 70
    end

    desc "Fix blob_status metadata on docs that have blobs but no status (from old sync code)"
    task fix_blob_status: :environment do
      puts "=" * 70
      puts "FIX BLOB STATUS METADATA"
      puts "=" * 70
      puts ""

      Tenant.find_each do |tenant|
        ActsAsTenant.with_tenant(tenant) do
          # Find docs with blobs but missing blob_status in metadata
          docs = WarehouseDocument.where(source_type: "email_attachment")
                                  .where.not(storage_blob_id: nil)
                                  .where("metadata IS NULL OR NOT (metadata ? 'blob_status')")
          count = docs.count
          next if count == 0

          puts "Tenant #{tenant.name} (id=#{tenant.id}): #{count} docs need blob_status"

          fixed = 0
          docs.find_each do |doc|
            new_meta = (doc.metadata || {}).merge("blob_status" => "downloaded")
            doc.update_columns(metadata: new_meta)
            fixed += 1
            print "."
          rescue StandardError => e
            puts "\n  ERROR doc #{doc.id}: #{e.message}"
          end

          puts ""
          puts "  Fixed: #{fixed}"
        end
      end

      puts ""
      puts "Done!"
    end

    desc "Re-sync emails to discover missing attachments (idempotent, catches partial docs)"
    task :resync, [:limit, :mailbox, :mode] => :environment do |_t, args|
      limit = (args[:limit] || 100).to_i
      mailbox_filter = args[:mailbox].presence
      dry_run = args[:mode] == "dry"

      puts "=" * 70
      puts dry_run ? "EMAIL ATTACHMENT RESYNC (DRY RUN)" : "EMAIL ATTACHMENT RESYNC"
      puts "=" * 70
      puts ""
      puts "This re-syncs ALL emails with has_attachments=true (not just those"
      puts "with zero docs). The two-step sync is idempotent - existing docs"
      puts "are preserved and new ones are discovered."
      puts ""

      Tenant.find_each do |tenant|
        ActsAsTenant.with_tenant(tenant) do
          # All emails that claim to have attachments and are reachable via a credential
          scope = SyncedEmail.where(has_attachments: true)
                             .where(
                               "microsoft_credential_id IS NOT NULL OR id IN (" \
                               "SELECT synced_email_id FROM synced_email_mailboxes " \
                               "WHERE (microsoft_credential_id IS NOT NULL AND outlook_id IS NOT NULL AND outlook_id != '') " \
                               "OR (imap_credential_id IS NOT NULL AND uid IS NOT NULL))"
                             )
                             .order(received_at: :desc)

          if mailbox_filter
            if mailbox_filter.include?("@")
              # Exact email: "rach@lyw.org.au"
              scope = scope.where(mailbox_owner_email: mailbox_filter)
            else
              # Domain filter: "lyw.org.au" matches all @lyw.org.au mailboxes
              scope = scope.where("mailbox_owner_email LIKE ?", "%@#{mailbox_filter}")
            end
          end

          total = scope.count
          next if total == 0

          batch_size = [limit, total].min

          puts "-" * 70
          puts "TENANT: #{tenant.name} (id=#{tenant.id})"
          puts "-" * 70
          puts "Total with attachments: #{total}"
          puts "Batch size:             #{batch_size}"
          puts "Mailbox filter:         #{mailbox_filter || 'all'}"
          puts ""

          stats = { synced: 0, new_attachments: 0, errors: [] }

          scope.limit(batch_size).find_each.with_index do |email, i|
            if dry_run
              doc_count = email.attachment_documents.count
              puts "  [DRY] Would resync email #{email.id}: #{email.subject&.truncate(50)} (#{doc_count} existing docs)"
              stats[:synced] += 1
              next
            end

            begin
              before_count = email.attachment_documents.count
              email.sync_attachments!
              after_count = email.attachment_documents.reload.count
              new_found = after_count - before_count

              stats[:synced] += 1
              stats[:new_attachments] += new_found
              print new_found > 0 ? "+#{new_found}" : "."

            rescue StandardError => e
              stats[:errors] << { id: email.id, subject: email.subject&.truncate(40), error: e.message }
              print "E"
            end

            if (i + 1) % 50 == 0
              puts " #{i + 1}/#{batch_size} (#{stats[:synced]} synced, #{stats[:new_attachments]} new, #{stats[:errors].count} errors)"
            end

            # Rate limit: don't hammer Outlook Graph API
            sleep(0.2) if (i + 1) % 10 == 0
          end

          puts ""
          puts ""
          puts "RESULTS for #{tenant.name}:"
          puts "Processed:         #{stats[:synced]}"
          puts "New attachments:   #{stats[:new_attachments]}"
          puts "Errors:            #{stats[:errors].count}"
          puts "Remaining:         #{total - batch_size}"

          if stats[:errors].any?
            puts ""
            puts "Errors (first 20):"
            stats[:errors].first(20).each do |err|
              puts "  Email #{err[:id]} (#{err[:subject]}): #{err[:error]}"
            end
          end

          if total > batch_size
            puts ""
            puts "More emails to resync. Run again:"
            puts "  rails email:attachments:resync[#{batch_size}#{mailbox_filter ? ",#{mailbox_filter}" : ""}]"
          end

          puts ""
        end
      end

      puts "=" * 70
      puts "RESYNC COMPLETE"
      puts "=" * 70
    end

    desc "Backfill SyncedEmailMailbox join table for IMAP emails (enables attachment backfill)"
    task backfill_imap_appearances: :environment do
      puts "=" * 70
      puts "IMAP MAILBOX APPEARANCE BACKFILL"
      puts "=" * 70
      puts ""

      Tenant.find_each do |tenant|
        ActsAsTenant.with_tenant(tenant) do
          # Find IMAP emails that have legacy fields but no join table entry
          imap_emails = SyncedEmail.where(source_type: "imap")
                                    .where.not(imap_credential_id: nil)
                                    .where.not(uid: nil)

          total = imap_emails.count
          next if total == 0

          # Check how many already have appearances
          with_appearances = imap_emails.where(
            id: SyncedEmailMailbox.where.not(imap_credential_id: nil).select(:synced_email_id)
          ).count

          missing = total - with_appearances

          puts "-" * 70
          puts "TENANT: #{tenant.name} (id=#{tenant.id})"
          puts "-" * 70
          puts "Total IMAP emails:              #{total}"
          puts "Already have appearances:        #{with_appearances}"
          puts "Missing appearances:             #{missing}"

          next if missing == 0

          created = 0
          errors = 0

          imap_emails.where.not(
            id: SyncedEmailMailbox.where.not(imap_credential_id: nil).select(:synced_email_id)
          ).find_each do |email|
            email.ensure_mailbox_appearance(
              mailbox_email: email.mailbox_owner_email,
              uid: email.uid,
              folder_name: email.folder_name,
              is_read: email.is_read,
              imap_credential_id: email.imap_credential_id
            )
            created += 1
            print "."
          rescue StandardError => e
            errors += 1
            puts "\n  ERROR email #{email.id}: #{e.message}"
          end

          puts ""
          puts "  Created: #{created}, Errors: #{errors}"
        end
      end

      puts ""
      puts "=" * 70
      puts "IMAP APPEARANCE BACKFILL COMPLETE"
      puts "=" * 70
      puts ""
      puts "Now run: rails email:attachments:backfill[100]"
      puts "to backfill attachments for IMAP emails."
    end
  end
end
