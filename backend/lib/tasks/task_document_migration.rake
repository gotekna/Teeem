# frozen_string_literal: true

namespace :documents do
  desc "Re-migrate task documents to correct /tasks/{task_id}/ path structure"
  task migrate_task_documents: :environment do
    puts "=" * 60
    puts "Task Document Migration"
    puts "Moving documents from /corporate/unassigned/ to /tasks/{task_id}/"
    puts "=" * 60

    # Find all CorporateCompanyDocuments attached to tasks
    task_doc_ids = SmTaskAttachment.where(attachable_type: 'CorporateCompanyDocument')
                                   .pluck(:attachable_id)
                                   .uniq

    documents = CorporateCompanyDocument.where(id: task_doc_ids)
                                        .where(storage_provider: 's3_compatible')
                                        .where.not(storage_path: [nil, ''])

    total = documents.count
    puts "Found #{total} task documents to check"
    puts ""

    # Get S3 client
    credential = S3CompatibleCredential.active.connected.first
    unless credential
      puts "ERROR: No active S3 credential found"
      exit 1
    end

    provider = DocumentProviders::S3Compatible.new(credential)
    migrated = 0
    skipped = 0
    errors = 0

    documents.find_each.with_index do |doc, index|
      # Get the task this document is attached to
      task_attachment = doc.sm_task_attachments.first
      unless task_attachment&.sm_task
        puts "[#{index + 1}/#{total}] SKIP: #{doc.file_name} - No task attachment found"
        skipped += 1
        next
      end

      task = task_attachment.sm_task
      old_path = doc.storage_path

      # Build new path: /tasks/{task_id}/filename
      # Use simple filename (slugified)
      ext = File.extname(doc.file_name)
      base = File.basename(doc.file_name, ext)
      slug_base = base.to_s.downcase
                      .gsub(/^\d+\s*[-_]?\s*/, '')
                      .gsub(/[^a-z0-9\s-]/, '')
                      .gsub(/\s+/, '-')
                      .gsub(/-+/, '-')
                      .gsub(/^-|-$/, '')
                      .presence || "document"
      slugified_filename = "#{slug_base}#{ext.downcase}"
      new_path = "tasks/#{task.id}/#{slugified_filename}"

      # Skip if already in correct path
      if old_path.start_with?("tasks/")
        puts "[#{index + 1}/#{total}] SKIP: #{doc.file_name} - Already in tasks/ folder"
        skipped += 1
        next
      end

      puts "[#{index + 1}/#{total}] Moving: #{doc.file_name}"
      puts "  From: #{old_path}"
      puts "  To:   #{new_path}"

      begin
        # Move file to new location (copy + delete in one operation)
        # move_file(source_path, destination_folder, new_name)
        dest_folder = "tasks/#{task.id}"
        result = provider.move_file(old_path, dest_folder, slugified_filename)

        # Update database record with the new path
        doc.update_columns(storage_path: result[:path] || new_path)

        puts "  SUCCESS"
        migrated += 1
      rescue => e
        puts "  ERROR: #{e.message}"
        errors += 1
      end
    end

    puts ""
    puts "=" * 60
    puts "Migration Complete"
    puts "  Migrated: #{migrated}"
    puts "  Skipped:  #{skipped}"
    puts "  Errors:   #{errors}"
    puts "=" * 60
  end

  desc "Preview task document migration (dry run)"
  task migrate_task_documents_preview: :environment do
    puts "=" * 60
    puts "Task Document Migration PREVIEW (Dry Run)"
    puts "=" * 60

    # Find all CorporateCompanyDocuments attached to tasks
    task_doc_ids = SmTaskAttachment.where(attachable_type: 'CorporateCompanyDocument')
                                   .pluck(:attachable_id)
                                   .uniq

    documents = CorporateCompanyDocument.where(id: task_doc_ids)
                                        .where(storage_provider: 's3_compatible')
                                        .where.not(storage_path: [nil, ''])

    total = documents.count
    puts "Found #{total} task documents"
    puts ""

    would_migrate = 0
    already_correct = 0

    documents.find_each.with_index do |doc, index|
      task_attachment = doc.sm_task_attachments.first
      unless task_attachment&.sm_task
        puts "[#{index + 1}/#{total}] NO TASK: #{doc.file_name}"
        next
      end

      task = task_attachment.sm_task
      old_path = doc.storage_path

      if old_path.start_with?("tasks/")
        already_correct += 1
        next
      end

      ext = File.extname(doc.file_name)
      base = File.basename(doc.file_name, ext)
      slug_base = base.to_s.downcase
                      .gsub(/^\d+\s*[-_]?\s*/, '')
                      .gsub(/[^a-z0-9\s-]/, '')
                      .gsub(/\s+/, '-')
                      .gsub(/-+/, '-')
                      .gsub(/^-|-$/, '')
                      .presence || "document"
      slugified_filename = "#{slug_base}#{ext.downcase}"
      new_path = "tasks/#{task.id}/#{slugified_filename}"

      puts "[#{index + 1}/#{total}] WOULD MOVE: #{doc.file_name}"
      puts "  From: #{old_path}"
      puts "  To:   #{new_path}"
      puts "  Task: ##{task.id} - #{task.name}"
      puts ""

      would_migrate += 1
    end

    puts "=" * 60
    puts "Summary"
    puts "  Would migrate:   #{would_migrate}"
    puts "  Already correct: #{already_correct}"
    puts ""
    puts "Run 'rails documents:migrate_task_documents' to perform migration"
    puts "=" * 60
  end
end
