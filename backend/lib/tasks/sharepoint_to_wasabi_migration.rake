# frozen_string_literal: true

# SharePoint → Wasabi Migration
#
# FRC (Jan 2026): Files uploaded to SharePoint were never migrated when
# provider switched to S3/Wasabi. The DB still has SharePoint item IDs
# (e.g. "01P43HWV5GJTQ6IY66V5AKLYLFE7LSUORX") instead of S3 keys.
# This causes "Failed to load PDF" / NoSuchKey errors.
#
# Usage:
#   rails sharepoint:migrate:status                  # Show what needs migrating
#   rails sharepoint:migrate:run[100]                # Migrate up to 100 files
#   rails sharepoint:migrate:run[100,job_plan_revisions]  # Migrate specific table
#
namespace :sharepoint do
  namespace :migrate do
    # Tables with SharePoint item IDs that need migration
    TABLES_WITH_SHAREPOINT_IDS = {
      job_plan_revisions: {
        model: "JobPlanRevision",
        id_columns: %w[storage_item_id storage_file_id],
        filename_method: ->(r) {
          plan = r.job_plan
          job = plan&.job
          "#{job&.job_code || 'Unknown'}_#{plan&.name || 'Plan'}_Rev#{r.revision}#{File.extname(r.file_name || '.pdf')}"
        },
        content_type_method: ->(r) { r.file_name&.end_with?(".pdf") ? "application/pdf" : "application/octet-stream" }
      },
      attachments: {
        model: "Attachment",
        id_columns: %w[storage_item_id storage_file_id],
        filename_method: ->(r) { r.file_name || "attachment_#{r.id}" },
        content_type_method: ->(r) { r.content_type || "application/octet-stream" }
      },
      bill_inboxes: {
        model: "BillInbox",
        id_columns: %w[storage_item_id storage_file_id],
        filename_method: ->(r) { r.file_name || "bill_#{r.id}" },
        content_type_method: ->(r) { r.content_type || "application/octet-stream" }
      },
      document_templates: {
        model: "DocumentTemplate",
        id_columns: %w[storage_item_id],
        filename_method: ->(r) { r.file_name || "template_#{r.id}" },
        content_type_method: ->(r) { r.content_type || "application/octet-stream" }
      },
      financial_transactions: {
        model: "FinancialTransaction",
        id_columns: %w[storage_item_id storage_file_id],
        filename_method: ->(r) { r.respond_to?(:file_name) ? r.file_name : "transaction_#{r.id}" },
        content_type_method: ->(_r) { "application/octet-stream" }
      },
      chat_messages: {
        model: "ChatMessage",
        id_columns: %w[storage_item_id storage_file_id],
        filename_method: ->(r) { r.respond_to?(:file_name) ? r.file_name : "chat_#{r.id}" },
        content_type_method: ->(r) { r.respond_to?(:content_type) ? r.content_type : "application/octet-stream" }
      },
      plan_folder_scans: {
        model: "PlanFolderScan",
        id_columns: %w[storage_item_id storage_file_id],
        filename_method: ->(r) { r.respond_to?(:file_name) ? r.file_name : "scan_#{r.id}" },
        content_type_method: ->(_r) { "application/octet-stream" }
      }
    }.freeze

    # SharePoint item IDs: alphanumeric + !, no slashes or dots
    def self.sharepoint_id?(value)
      value.present? && !value.include?("/") && !value.include?(".") && value.match?(/\A[A-Za-z0-9!_-]+\z/)
    end

    desc "Show migration status - how many files still reference SharePoint"
    task status: :environment do
      tenant = Tenant.first
      unless tenant
        puts "ERROR: No tenant found"
        exit 1
      end

      ActsAsTenant.with_tenant(tenant) do
      puts "\n" + "=" * 70
      puts "SHAREPOINT → WASABI MIGRATION STATUS"
      puts "Tenant: #{tenant.name} (ID: #{tenant.id})"
      puts "=" * 70

      total_sharepoint = 0
      total_already_s3 = 0

      TABLES_WITH_SHAREPOINT_IDS.each do |table_name, config|
        model = config[:model].constantize rescue nil
        unless model
          puts "\n#{table_name}: MODEL NOT FOUND (#{config[:model]})"
          next
        end

        sharepoint_count = 0
        s3_count = 0
        empty_count = 0

        model.find_each do |record|
          ref = config[:id_columns].map { |col|
            record.respond_to?(col) ? record.send(col) : nil
          }.compact.first

          if ref.blank?
            empty_count += 1
          elsif sharepoint_id?(ref)
            sharepoint_count += 1
          else
            s3_count += 1
          end
        end

        total = sharepoint_count + s3_count + empty_count
        total_sharepoint += sharepoint_count
        total_already_s3 += s3_count

        puts "\n#{table_name} (#{total} records):"
        puts "  SharePoint IDs: #{sharepoint_count}" if sharepoint_count > 0
        puts "  S3 keys:        #{s3_count}" if s3_count > 0
        puts "  No reference:   #{empty_count}" if empty_count > 0
        puts "  All S3 already" if sharepoint_count == 0 && s3_count > 0
      end

      puts "\n" + "=" * 70
      puts "TOTAL: #{total_sharepoint} files on SharePoint, #{total_already_s3} already on S3"
      if total_sharepoint > 0
        puts "Run: rails sharepoint:migrate:run[#{total_sharepoint}] to migrate"
      else
        puts "Nothing to migrate!"
      end
      puts "=" * 70
      end # ActsAsTenant.with_tenant
    end

    desc "Migrate files from SharePoint to Wasabi. Args: limit, table (optional)"
    task :run, [:limit, :table] => :environment do |_t, args|
      limit = (args[:limit] || 50).to_i
      target_table = args[:table]&.to_sym

      tenant = Tenant.first
      unless tenant
        puts "ERROR: No tenant found"
        exit 1
      end

      ActsAsTenant.with_tenant(tenant) do

      puts "\n" + "=" * 70
      puts "SHAREPOINT → WASABI MIGRATION"
      puts "Limit: #{limit} files"
      puts "Table: #{target_table || 'all'}"
      puts "Tenant: #{tenant.name} (ID: #{tenant.id})"
      puts "=" * 70

      # Get SharePoint client
      credential = MicrosoftCredential.sharepoint_credential
      unless credential&.valid_access_token.present?
        puts "SharePoint not connected. Cannot migrate."
        exit 1
      end

      sp_config = StorageConfiguration.for_tenant(tenant)
      unless sp_config
        puts "StorageConfiguration not found."
        exit 1
      end

      # Get S3 provider for upload
      s3_cred = S3CompatibleCredential.active.connected.first
      unless s3_cred
        puts "S3/Wasabi not connected. Cannot migrate."
        exit 1
      end
      s3_provider = DocumentProviders::S3Compatible.new(s3_cred)

      # Build SharePoint client
      if credential.credential_type == "app"
        sp_client = MicrosoftAppGraphClient.new(credential)
      else
        sp_client = MicrosoftGraphClient.new(credential.valid_access_token)
      end

      stats = { migrated: 0, skipped: 0, errors: [], already_s3: 0 }
      migrated_total = 0

      tables = target_table ? { target_table => TABLES_WITH_SHAREPOINT_IDS[target_table] } : TABLES_WITH_SHAREPOINT_IDS

      tables.each do |table_name, config|
        next unless config

        model = config[:model].constantize rescue nil
        unless model
          puts "\nSkipping #{table_name}: model not found"
          next
        end

        puts "\n--- #{table_name} ---"

        model.find_each do |record|
          break if migrated_total >= limit

          # Get the SharePoint item ID
          ref = config[:id_columns].map { |col|
            record.respond_to?(col) ? record.send(col) : nil
          }.compact.first

          next if ref.blank?

          unless sharepoint_id?(ref)
            stats[:already_s3] += 1
            next
          end

          print "  [#{migrated_total + 1}/#{limit}] #{model.name} ##{record.id} (#{ref[0..15]}...)..."

          begin
            # 1. Download from SharePoint
            if credential.credential_type == "app"
              content = sp_client.get_drive_item_content(
                drive_id: sp_config.drive_id,
                item_id: ref
              )
              metadata = sp_client.get_drive_item(sp_config.drive_id, ref)
            else
              content = sp_client.download_file(ref)
              metadata = sp_client.get_file(ref)
            end

            unless content.present?
              puts " SKIP (no content)"
              stats[:skipped] += 1
              next
            end

            # 2. Compute content hash for deduplication
            content_hash = Digest::SHA256.hexdigest(content)
            filename = metadata["name"] || config[:filename_method].call(record)
            content_type = metadata.dig("file", "mimeType") || config[:content_type_method].call(record)
            extension = File.extname(filename)
            prefix = content_hash[0..1]
            new_path = "Blobs/#{prefix}/#{content_hash}#{extension}"

            # 3. Check for existing blob (deduplication)
            existing_blob = StorageBlob.find_by(content_hash: content_hash)
            if existing_blob
              blob = existing_blob
              puts " DEDUP (blob #{blob.id})"
            else
              # Upload to Wasabi
              s3_provider.upload_file(
                "Blobs/#{prefix}",
                content,
                "#{content_hash}#{extension}",
                content_type: content_type
              )

              # Create StorageBlob
              blob = StorageBlob.create!(
                content_hash: content_hash,
                storage_path: new_path,
                file_size: content.bytesize,
                original_filename: filename,
                content_type: content_type,
                reference_count: 0,
                verified_at: Time.current
              )
              puts " UPLOADED → #{new_path}"
            end

            # 4. Update the record's storage columns to point to S3 path
            updates = {}
            config[:id_columns].each do |col|
              updates[col.to_sym] = new_path if record.respond_to?(col)
            end
            record.update_columns(updates) if updates.any?

            stats[:migrated] += 1
            migrated_total += 1

          rescue StandardError => e
            puts " ERROR: #{e.message}"
            stats[:errors] << { table: table_name, id: record.id, error: e.message }
          end
        end
      end

      puts "\n" + "=" * 70
      puts "MIGRATION COMPLETE"
      puts "=" * 70
      puts "Migrated:     #{stats[:migrated]}"
      puts "Already S3:   #{stats[:already_s3]}"
      puts "Skipped:      #{stats[:skipped]}"
      puts "Errors:       #{stats[:errors].count}"

      if stats[:errors].any?
        puts "\nErrors (first 10):"
        stats[:errors].first(10).each do |err|
          puts "  #{err[:table]} ##{err[:id]}: #{err[:error]}"
        end
      end
      puts "=" * 70
      end # ActsAsTenant.with_tenant
    end
  end
end
