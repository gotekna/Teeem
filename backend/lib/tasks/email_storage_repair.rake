# frozen_string_literal: true

# Email Storage Repair - Fix old emails with missing or broken storage
#
# Background:
#   Old emails (before EmailStorageUploadService) may have:
#   1. storage_path set but file doesn't exist in S3
#   2. No warehouse_document or storage_blob
#   3. Files at old path format (Emails/eml/YYYY/MM/)
#
# This task:
#   1. Diagnoses the current state of email storage
#   2. Re-fetches missing .eml files from Outlook Graph API
#   3. Uploads to correct S3 path
#   4. Creates/updates WarehouseDocument and StorageBlob
#
# Usage:
#   # Preview what needs repair
#   rails email:storage:preview
#
#   # Verify files exist in S3
#   rails email:storage:verify[100]  # Check first 100 emails
#
#   # Repair missing files (re-fetch from Outlook)
#   rails email:storage:repair[100]  # Repair up to 100 emails
#
namespace :email do
  namespace :storage do
    desc "Preview email storage status"
    task preview: :environment do
      puts "=" * 70
      puts "EMAIL STORAGE STATUS"
      puts "=" * 70
      puts ""

      total = SyncedEmail.count
      with_storage_path = SyncedEmail.where.not(storage_path: [nil, ""]).count
      with_warehouse = SyncedEmail.joins(:warehouse_document).count
      with_blob = SyncedEmail.joins(warehouse_document: :storage_blob).count

      puts "Total emails:                     #{total}"
      puts "With storage_path:                #{with_storage_path}"
      puts "With warehouse_document:          #{with_warehouse}"
      puts "With warehouse + storage_blob:    #{with_blob}"
      puts ""

      # Sample path formats
      puts "Sample storage_path formats (first 10):"
      SyncedEmail.where.not(storage_path: [nil, ""])
                 .limit(10)
                 .pluck(:id, :storage_path)
                 .each do |id, path|
        puts "  #{id}: #{path&.truncate(60)}"
      end
      puts ""

      # Emails needing warehouse_document
      missing_warehouse = SyncedEmail.where.not(storage_path: [nil, ""])
                                     .left_joins(:warehouse_document)
                                     .where(warehouse_documents: { id: nil })
                                     .count
      puts "Emails with storage_path but no warehouse_document: #{missing_warehouse}"
      puts ""

      if missing_warehouse > 0
        puts "To create missing warehouse entries, run:"
        puts "  rails email:storage:create_warehouse_docs[#{[missing_warehouse, 1000].min}]"
      end
    end

    desc "Verify emails have files in S3 (checks first N emails with storage_path)"
    task :verify, [:limit] => :environment do |_t, args|
      limit = (args[:limit] || 100).to_i

      puts "=" * 70
      puts "VERIFY EMAIL FILES IN S3"
      puts "=" * 70
      puts ""

      provider = DocumentProviders.for_organization(Organization.first)
      unless provider
        puts "ERROR: No storage provider configured"
        exit 1
      end

      stats = { exists: 0, missing: 0, errors: [] }

      scope = SyncedEmail.where.not(storage_path: [nil, ""])
                         .order(:id)
                         .limit(limit)

      puts "Checking #{scope.count} emails..."
      puts ""

      scope.find_each.with_index do |email, i|
        path = email.storage_path.to_s.gsub(%r{^/+}, "")

        begin
          provider.get_file(path)
          stats[:exists] += 1
          print "."
        rescue DocumentProviders::NotFoundError
          stats[:missing] += 1
          stats[:errors] << { id: email.id, path: path, error: "File not found" }
          print "X"
        rescue StandardError => e
          stats[:errors] << { id: email.id, path: path, error: e.message }
          print "E"
        end

        puts " #{i + 1}" if (i + 1) % 50 == 0
      end

      puts ""
      puts ""
      puts "=" * 70
      puts "VERIFICATION RESULTS"
      puts "=" * 70
      puts "Exists in S3:  #{stats[:exists]}"
      puts "Missing:       #{stats[:missing]}"
      puts ""

      if stats[:errors].any?
        puts "Missing files (first 20):"
        stats[:errors].first(20).each do |err|
          puts "  Email #{err[:id]}: #{err[:path]} - #{err[:error]}"
        end
      end

      if stats[:missing] > 0
        puts ""
        puts "To repair missing files, run:"
        puts "  rails email:storage:repair[#{stats[:missing]}]"
      end
    end

    desc "Repair emails with missing S3 files by re-fetching from Outlook"
    task :repair, [:limit] => :environment do |_t, args|
      limit = (args[:limit] || 100).to_i

      puts "=" * 70
      puts "REPAIR EMAIL STORAGE"
      puts "=" * 70
      puts ""

      provider = DocumentProviders.for_organization(Organization.first)
      unless provider
        puts "ERROR: No storage provider configured"
        exit 1
      end

      storage_config = StorageConfiguration.instance

      stats = { repaired: 0, skipped: 0, errors: [] }

      # Find emails with storage_path but file doesn't exist
      scope = SyncedEmail.where.not(storage_path: [nil, ""])
                         .where.not(outlook_id: [nil, ""])
                         .where.not(mailbox_owner_email: [nil, ""])
                         .order(:id)
                         .limit(limit * 2) # Get more to account for existing files

      repaired_count = 0
      checked_count = 0

      puts "Checking emails for missing files..."
      puts ""

      scope.find_each do |email|
        break if repaired_count >= limit

        checked_count += 1
        path = email.storage_path.to_s.gsub(%r{^/+}, "")

        # Check if file exists
        begin
          provider.get_file(path)
          stats[:skipped] += 1
          next # File exists, skip
        rescue DocumentProviders::NotFoundError
          # File missing, needs repair
        end

        # Re-fetch from Outlook
        print "  Repairing email #{email.id}..."

        begin
          credential = MicrosoftCredential.active_credential
          unless credential&.connected?
            puts " SKIP (no credential)"
            stats[:skipped] += 1
            next
          end

          client = MicrosoftAppGraphClient.new(credential)
          mime_content = client.get_email_mime_content(email.mailbox_owner_email, email.outlook_id)

          unless mime_content.present?
            puts " SKIP (no content from Outlook)"
            stats[:errors] << { id: email.id, error: "Could not fetch from Outlook" }
            next
          end

          # Upload to new path format
          year = email.received_at&.year || email.created_at.year
          month = (email.received_at || email.created_at).strftime("%m")
          mailbox = email.mailbox_owner_email&.split("@")&.first || "unknown"
          base_path = storage_config.path_for(:email) || "Emails"

          # Substitute template tokens
          folder_path = base_path.gsub("{{Mailbox}}", mailbox)
                                 .gsub("{{Year}}", year.to_s)
                                 .gsub("{{Month}}", month)

          filename = "#{email.id}.eml"

          result = provider.upload_file(folder_path, mime_content, filename, content_type: "message/rfc822")

          # Update email with new path
          email.update_columns(
            storage_path: result[:path],
            storage_file_id: result[:id],
            storage_email_path: result[:path],
            storage_email_file_id: result[:id]
          )

          # Update or create StorageBlob
          blob = StorageBlob.find_or_create_by!(storage_path: result[:path]) do |b|
            b.content_hash = Digest::SHA256.hexdigest(mime_content)
            b.file_size = mime_content.bytesize
            b.original_filename = filename
            b.content_type = "message/rfc822"
            b.reference_count = 0
          end

          # Update or create WarehouseDocument
          if email.warehouse_document
            email.warehouse_document.update!(storage_blob: blob)
          else
            WarehouseDocument.create!(
              documentable: email,
              storage_blob: blob,
              source_type: "email",
              folder: email.virtual_folder_path,
              display_name: email.subject.presence || "No Subject",
              original_filename: filename,
              metadata: {
                subject: email.subject,
                from_email: email.from_email,
                received_at: email.received_at&.iso8601,
                mailbox: email.mailbox_owner_email
              }
            )
          end

          blob.increment!(:reference_count) if blob.reference_count == 0

          puts " OK (#{result[:path]})"
          stats[:repaired] += 1
          repaired_count += 1

        rescue StandardError => e
          puts " ERROR: #{e.message}"
          stats[:errors] << { id: email.id, error: e.message }
        end
      end

      puts ""
      puts "=" * 70
      puts "REPAIR COMPLETE"
      puts "=" * 70
      puts "Checked:  #{checked_count}"
      puts "Repaired: #{stats[:repaired]}"
      puts "Skipped:  #{stats[:skipped]} (file exists)"
      puts "Errors:   #{stats[:errors].count}"

      if stats[:errors].any?
        puts ""
        puts "Errors (first 10):"
        stats[:errors].first(10).each do |err|
          puts "  Email #{err[:id]}: #{err[:error]}"
        end
      end
    end

    desc "Create missing WarehouseDocument entries for emails"
    task :create_warehouse_docs, [:limit] => :environment do |_t, args|
      limit = (args[:limit] || 1000).to_i

      puts "=" * 70
      puts "CREATE MISSING WAREHOUSE DOCUMENTS"
      puts "=" * 70
      puts ""

      stats = { created: 0, skipped: 0, errors: [] }

      scope = SyncedEmail.where.not(storage_path: [nil, ""])
                         .left_joins(:warehouse_document)
                         .where(warehouse_documents: { id: nil })
                         .limit(limit)

      total = scope.count
      puts "Found #{total} emails needing WarehouseDocument"
      puts ""

      scope.find_each.with_index do |email, i|
        begin
          # Find or create StorageBlob
          blob = StorageBlob.find_or_create_by!(storage_path: email.storage_path) do |b|
            b.content_hash = Digest::SHA256.hexdigest("#{email.id}-#{email.storage_path}")
            b.file_size = 0
            b.original_filename = "#{email.id}.eml"
            b.content_type = "message/rfc822"
            b.reference_count = 0
          end

          # Create WarehouseDocument
          WarehouseDocument.create!(
            documentable: email,
            storage_blob: blob,
            source_type: "email",
            folder: email.virtual_folder_path,
            display_name: email.subject.presence || "No Subject",
            original_filename: "#{email.id}.eml",
            metadata: {
              subject: email.subject,
              from_email: email.from_email,
              received_at: email.received_at&.iso8601,
              mailbox: email.mailbox_owner_email
            }
          )

          blob.increment!(:reference_count) if blob.reference_count == 0
          stats[:created] += 1
          print "."

        rescue ActiveRecord::RecordNotUnique
          stats[:skipped] += 1
          print "S"
        rescue StandardError => e
          stats[:errors] << { id: email.id, error: e.message }
          print "E"
        end

        puts " #{i + 1}" if (i + 1) % 100 == 0
      end

      puts ""
      puts ""
      puts "=" * 70
      puts "COMPLETE"
      puts "=" * 70
      puts "Created: #{stats[:created]}"
      puts "Skipped: #{stats[:skipped]} (already exists)"
      puts "Errors:  #{stats[:errors].count}"

      if stats[:errors].any?
        puts ""
        puts "Errors (first 10):"
        stats[:errors].first(10).each do |err|
          puts "  Email #{err[:id]}: #{err[:error]}"
        end
      end
    end
  end
end
