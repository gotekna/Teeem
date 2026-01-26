# frozen_string_literal: true

# Cleanup temporary files from storage
# These accumulate from features like "Download All Response Files" for tasks

namespace :temp do
  desc "Clean up old TaskResponseZips (older than 7 days)"
  task cleanup_response_zips: :environment do
    puts "Cleaning up old TaskResponseZips..."

    begin
      provider = DocumentProviders.for_organization(Organization.first)
      unless provider
        puts "No storage provider configured"
        exit 0
      end

      folder_path = "Temp/TaskResponseZips"
      cutoff_time = 7.days.ago

      # List files in the temp folder
      files = provider.list_files(folder_path) rescue []

      if files.empty?
        puts "No files found in #{folder_path}"
        exit 0
      end

      deleted = 0
      kept = 0

      files.each do |file|
        next unless file[:name]&.end_with?(".zip")

        # Parse timestamp from filename: YYYYMMDD_HHMMSS_name.zip
        if file[:name] =~ /^(\d{8})_(\d{6})_/
          date_str = $1
          time_str = $2
          file_time = Time.zone.parse("#{date_str} #{time_str}") rescue nil

          if file_time && file_time < cutoff_time
            begin
              provider.delete_file(file[:id] || "#{folder_path}/#{file[:name]}")
              puts "  Deleted: #{file[:name]} (#{file_time})"
              deleted += 1
            rescue => e
              puts "  Failed to delete #{file[:name]}: #{e.message}"
            end
          else
            kept += 1
          end
        else
          # Can't parse timestamp, keep it
          kept += 1
        end
      end

      puts ""
      puts "Summary: Deleted #{deleted}, Kept #{kept}"
    rescue DocumentProviders::NotConnectedError => e
      puts "Storage not connected: #{e.message}"
    rescue => e
      puts "Error: #{e.message}"
      puts e.backtrace.first(5).join("\n")
    end
  end

  desc "List TaskResponseZips with sizes"
  task list_response_zips: :environment do
    begin
      provider = DocumentProviders.for_organization(Organization.first)
      unless provider
        puts "No storage provider configured"
        exit 0
      end

      folder_path = "Temp/TaskResponseZips"
      files = provider.list_files(folder_path) rescue []

      if files.empty?
        puts "No files found"
        exit 0
      end

      total_size = 0
      puts "TaskResponseZips:"
      puts "=" * 80

      files.sort_by { |f| f[:name] || "" }.reverse.each do |file|
        size = file[:size] || 0
        total_size += size
        size_str = size > 1_000_000 ? "#{(size / 1_000_000.0).round(1)} MB" : "#{(size / 1000.0).round(1)} KB"
        puts "  #{file[:name]} (#{size_str})"
      end

      puts ""
      puts "Total: #{files.size} files, #{(total_size / 1_000_000.0).round(2)} MB"
    rescue => e
      puts "Error: #{e.message}"
    end
  end
end
