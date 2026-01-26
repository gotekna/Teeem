# frozen_string_literal: true

namespace :documents do
  desc "List documents with missing files in S3 (file referenced but not found)"
  task find_missing: :environment do
    require "aws-sdk-s3"

    puts "=" * 70
    puts "Document Health Check - Finding Missing Files"
    puts "=" * 70
    puts ""

    cred = S3CompatibleCredential.active.connected.first
    unless cred
      puts "ERROR: No active S3 credential found"
      exit 1
    end

    s3 = Aws::S3::Client.new(
      access_key_id: cred.access_key_id,
      secret_access_key: cred.secret_access_key,
      endpoint: cred.endpoint,
      region: cred.region || "us-east-1",
      force_path_style: true
    )

    bucket = cred.bucket
    puts "Checking S3 bucket: #{bucket}"
    puts ""

    # Check documents with storage_path but no content_hash (legacy uploads)
    docs = CorporateCompanyDocument.where.not(storage_path: [nil, ""])
                                   .where(content_hash: [nil, ""])
                                   .includes(:storage_blob, :corporate_company)

    total = docs.count
    puts "Found #{total} documents without content_hash to check..."
    puts ""

    missing = []
    exists = []

    docs.find_each.with_index do |doc, index|
      # Get the storage path
      path = doc.storage_blob&.storage_path || doc.storage_path
      next unless path.present?

      # Normalize path (remove leading slashes)
      s3_key = path.to_s.gsub(%r{^/+}, "")

      print "\r[#{index + 1}/#{total}] Checking: #{s3_key.truncate(60)}"

      begin
        s3.head_object(bucket: bucket, key: s3_key)
        exists << doc
      rescue Aws::S3::Errors::NotFound
        missing << {
          id: doc.id,
          file_name: doc.file_name,
          storage_path: path,
          storage_reference: doc.storage_reference,
          created_at: doc.created_at,
          company: doc.corporate_company&.name
        }
      rescue => e
        puts "\nError checking #{doc.id}: #{e.message}"
      end
    end

    puts "\n\n"
    puts "=" * 70
    puts "Results"
    puts "=" * 70
    puts "Files found:   #{exists.count}"
    puts "Files MISSING: #{missing.count}"
    puts ""

    if missing.any?
      puts "Missing Files (need to be re-uploaded):"
      puts "-" * 70
      missing.each do |m|
        puts "ID: #{m[:id]}"
        puts "  File: #{m[:file_name]}"
        puts "  Path: #{m[:storage_path]}"
        puts "  Original: #{m[:storage_reference]}" if m[:storage_reference].present?
        puts "  Company: #{m[:company]}" if m[:company].present?
        puts "  Created: #{m[:created_at]}"
        puts ""
      end

      # Save to CSV for easy tracking
      csv_path = Rails.root.join("tmp", "missing_documents_#{Time.now.strftime('%Y%m%d_%H%M%S')}.csv")
      File.open(csv_path, "w") do |f|
        f.puts "id,file_name,storage_path,storage_reference,company,created_at"
        missing.each do |m|
          f.puts "#{m[:id]},\"#{m[:file_name]}\",\"#{m[:storage_path]}\",\"#{m[:storage_reference]}\",\"#{m[:company]}\",#{m[:created_at]}"
        end
      end
      puts "CSV saved to: #{csv_path}"
    else
      puts "All files exist in S3!"
    end
  end

  desc "Find missing files for a specific task"
  task :find_missing_for_task, [:task_id] => :environment do |_t, args|
    require "aws-sdk-s3"

    task_id = args[:task_id]
    unless task_id
      puts "Usage: rails documents:find_missing_for_task[TASK_ID]"
      exit 1
    end

    task = SmTask.find_by(id: task_id)
    unless task
      puts "Task #{task_id} not found"
      exit 1
    end

    puts "=" * 70
    puts "Checking documents for Task ##{task_id}: #{task.name}"
    puts "=" * 70
    puts ""

    cred = S3CompatibleCredential.active.connected.first
    unless cred
      puts "ERROR: No active S3 credential found"
      exit 1
    end

    s3 = Aws::S3::Client.new(
      access_key_id: cred.access_key_id,
      secret_access_key: cred.secret_access_key,
      endpoint: cred.endpoint,
      region: cred.region || "us-east-1",
      force_path_style: true
    )

    bucket = cred.bucket

    # Get all document attachments for this task
    attachments = task.sm_task_attachments.where(attachable_type: "CorporateCompanyDocument")
                      .includes(attachable: :storage_blob)

    puts "Found #{attachments.count} document attachments"
    puts ""

    missing = []
    found = []

    attachments.each do |att|
      doc = att.attachable
      next unless doc

      # Get the storage path
      path = doc.storage_blob&.storage_path || doc.storage_path
      unless path.present?
        missing << { id: doc.id, file_name: doc.file_name, reason: "No storage path" }
        next
      end

      # Normalize path
      s3_key = path.to_s.gsub(%r{^/+}, "")

      begin
        s3.head_object(bucket: bucket, key: s3_key)
        found << doc
        puts "✓ #{doc.file_name}"
      rescue Aws::S3::Errors::NotFound
        missing << {
          id: doc.id,
          file_name: doc.file_name,
          storage_path: path,
          storage_reference: doc.storage_reference
        }
        puts "✗ #{doc.file_name} - FILE MISSING"
      end
    end

    puts ""
    puts "=" * 70
    puts "Summary: #{found.count} found, #{missing.count} MISSING"
    puts "=" * 70

    if missing.any?
      puts ""
      puts "Missing files that need to be re-uploaded:"
      missing.each do |m|
        puts "  Document ID #{m[:id]}: #{m[:file_name]}"
        puts "    Expected path: #{m[:storage_path]}"
        puts "    Original ref:  #{m[:storage_reference]}" if m[:storage_reference]
        puts ""
      end
    end
  end

  desc "Re-upload a file for a specific document"
  task :reupload, [:document_id, :file_path] => :environment do |_t, args|
    document_id = args[:document_id]
    file_path = args[:file_path]

    unless document_id && file_path
      puts "Usage: rails documents:reupload[DOCUMENT_ID,/path/to/file.pdf]"
      exit 1
    end

    doc = CorporateCompanyDocument.find_by(id: document_id)
    unless doc
      puts "Document #{document_id} not found"
      exit 1
    end

    unless File.exist?(file_path)
      puts "File not found: #{file_path}"
      exit 1
    end

    puts "Document: #{doc.id} - #{doc.file_name}"
    puts "Uploading from: #{file_path}"
    puts ""

    content = File.binread(file_path)
    content_type = Marcel::MimeType.for(Pathname.new(file_path))

    puts "File size: #{(content.bytesize / 1024.0).round(2)} KB"
    puts "Content type: #{content_type}"
    puts ""

    print "Proceed? (y/N): "
    answer = $stdin.gets&.chomp&.downcase
    unless answer == "y"
      puts "Aborted."
      exit 0
    end

    # Create new StorageBlob with proper content-addressed storage
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: doc.file_name,
      content_type: content_type
    )

    # Update document to use new blob
    old_blob_id = doc.storage_blob_id
    doc.storage_blob&.decrement_reference! if doc.storage_blob_id.present?
    doc.storage_blob = blob
    doc.content_hash = blob.content_hash
    doc.file_size = content.bytesize
    doc.storage_path = blob.storage_path # Update to new Blobs/ path
    doc.save!
    blob.increment_reference!

    # Update warehouse_document if exists
    if doc.warehouse_document
      doc.warehouse_document.update!(storage_blob: blob)
    end

    puts ""
    puts "SUCCESS!"
    puts "  New blob: #{blob.id}"
    puts "  New path: #{blob.storage_path}"
    puts "  Content hash: #{blob.content_hash}"
  end
end
