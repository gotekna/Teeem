# frozen_string_literal: true

namespace :tasks do
  desc "Clean up old task ActiveStorage files with generic image names (image001, image002, etc.)"
  task cleanup_image_attachments: :environment do
    # Pattern for generic image files: image001.jpg, image002.png, etc.
    image_pattern = /\Aimage\d+\.(png|jpg|jpeg|gif|bmp)\z/i

    puts "="*60
    puts "Task Attachment Cleanup: Generic Image Files (ActiveStorage)"
    puts "="*60
    puts ""

    # Find all tasks with files attached
    tasks_with_files = SmTask.joins(:files_attachments).distinct

    puts "Tasks with ActiveStorage files: #{tasks_with_files.count}"
    puts ""

    # Find attachments with generic image names
    to_delete = []
    affected_tasks = Set.new

    tasks_with_files.find_each do |task|
      task.files.each do |file|
        file_name = file.filename.to_s

        if file_name.match?(image_pattern)
          to_delete << { task: task, file: file, file_name: file_name }
          affected_tasks << task.id
          puts "  Found: #{file_name} (Task ##{task.id}: #{task.name.truncate(40)})"
        end
      end
    end

    puts ""
    puts "-"*60
    puts "Summary:"
    puts "  Files to remove: #{to_delete.count}"
    puts "  Tasks affected: #{affected_tasks.count}"
    puts "-"*60

    if to_delete.empty?
      puts "No generic image files found. Nothing to clean up."
      next
    end

    print "\nProceed with deletion? (yes/no): "
    confirmation = $stdin.gets.chomp.downcase

    if confirmation == "yes"
      deleted_count = 0
      # Collect blob IDs first to avoid modifying collection during iteration
      blob_ids_to_delete = to_delete.map { |item| item[:file].blob_id }

      blob_ids_to_delete.each do |blob_id|
        blob = ActiveStorage::Blob.find_by(id: blob_id)
        if blob
          blob.attachments.destroy_all
          blob.purge
          deleted_count += 1
          print "."
        end
      end

      puts ""
      puts "="*60
      puts "Deleted #{deleted_count} files successfully."
      puts "="*60
    else
      puts "Aborted. No changes made."
    end
  end

  desc "Preview task ActiveStorage files with generic image names (dry run)"
  task preview_image_attachments: :environment do
    image_pattern = /\Aimage\d+\.(png|jpg|jpeg|gif|bmp)\z/i

    puts "="*60
    puts "Task Attachment Preview: Generic Image Files (DRY RUN)"
    puts "="*60
    puts ""

    # Group by task
    tasks_with_bad_files = {}

    SmTask.joins(:files_attachments).distinct.includes(:files_attachments).find_each do |task|
      task.files.each do |file|
        file_name = file.filename.to_s

        if file_name.match?(image_pattern)
          task_key = task.id
          tasks_with_bad_files[task_key] ||= {
            task_name: task.name,
            files: []
          }
          tasks_with_bad_files[task_key][:files] << {
            blob_id: file.blob_id,
            file_name: file_name,
            byte_size: file.byte_size,
            created_at: file.created_at
          }
        end
      end
    end

    if tasks_with_bad_files.empty?
      puts "No generic image files found."
      next
    end

    total_files = 0
    total_bytes = 0
    tasks_with_bad_files.each do |task_id, data|
      puts "Task ##{task_id}: #{data[:task_name].truncate(50)}"
      data[:files].each do |f|
        size_kb = (f[:byte_size] / 1024.0).round(1)
        puts "  - #{f[:file_name]} (#{size_kb} KB, Created: #{f[:created_at]&.strftime('%Y-%m-%d')})"
        total_files += 1
        total_bytes += f[:byte_size]
      end
      puts ""
    end

    puts "-"*60
    puts "Total: #{total_files} files (#{(total_bytes / 1024.0 / 1024.0).round(2)} MB) across #{tasks_with_bad_files.count} tasks"
    puts ""
    puts "To delete these, run: rake tasks:cleanup_image_attachments"
  end

  desc "Clean up SmTaskAttachment records linking to documents with generic image names"
  task cleanup_document_attachments: :environment do
    image_pattern = /\Aimage\d+\.(png|jpg|jpeg|gif|bmp)\z/i

    puts "="*60
    puts "Task Attachment Cleanup: Document Links (SmTaskAttachment)"
    puts "="*60
    puts ""

    # Find all document attachments
    document_attachments = SmTaskAttachment.documents.includes(:attachable)

    puts "Total document attachment links: #{document_attachments.count}"
    puts ""

    # Find attachments with generic image names
    to_delete = []
    affected_tasks = Set.new

    document_attachments.find_each do |attachment|
      document = attachment.attachable
      next unless document

      file_name = document.file_name.to_s

      if file_name.match?(image_pattern)
        to_delete << attachment
        affected_tasks << attachment.sm_task_id
        puts "  Found: #{file_name} (Task ##{attachment.sm_task_id}, Attachment ##{attachment.id})"
      end
    end

    puts ""
    puts "-"*60
    puts "Summary:"
    puts "  Attachment links to remove: #{to_delete.count}"
    puts "  Tasks affected: #{affected_tasks.count}"
    puts "-"*60

    if to_delete.empty?
      puts "No generic image document links found. Nothing to clean up."
      next
    end

    print "\nProceed with deletion? (yes/no): "
    confirmation = $stdin.gets.chomp.downcase

    if confirmation == "yes"
      deleted_count = 0
      to_delete.each do |attachment|
        attachment.destroy
        deleted_count += 1
      end

      puts ""
      puts "="*60
      puts "Deleted #{deleted_count} attachment links successfully."
      puts "="*60
    else
      puts "Aborted. No changes made."
    end
  end
end
