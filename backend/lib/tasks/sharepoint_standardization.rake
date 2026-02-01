# frozen_string_literal: true

namespace :sharepoint do
  desc "Audit SharePoint data - show what needs fixing"
  task audit: :environment do
    puts "=== SharePoint Data Audit ==="
    puts ""

    # Jobs folder status
    puts "📁 JOB FOLDERS:"
    total_jobs = Job.count
    jobs_with_folder_id = Job.where.not(sharepoint_folder_id: [nil, ""]).count
    jobs_with_folder_status = Job.where(sharepoint_folder_status: "completed").count
    puts "  Total jobs: #{total_jobs}"
    puts "  With folder ID stored: #{jobs_with_folder_id}"
    puts "  With folder status 'completed': #{jobs_with_folder_status}"
    puts "  Need backfill: #{jobs_with_folder_status - jobs_with_folder_id}"
    puts ""

    # Documents status
    puts "📄 DOCUMENTS:"
    total_docs = JobDocument.count
    docs_with_ai_name = JobDocument.where.not(ai_proposed_name: [nil, ""]).count
    docs_needing_rename = 0
    if docs_with_ai_name > 0
      JobDocument.where.not(ai_proposed_name: [nil, ""]).find_each do |doc|
        current = doc.file_name.to_s.downcase.gsub(/\s+/, " ").strip
        proposed = doc.ai_proposed_name.to_s.downcase.gsub(/\s+/, " ").strip
        docs_needing_rename += 1 if current != proposed
      end
    end
    puts "  Total documents: #{total_docs}"
    puts "  With AI proposed name: #{docs_with_ai_name}"
    puts "  Needing rename: #{docs_needing_rename}"
    puts ""

    # EntityTabs folder status
    puts "🗂️ ENTITY TABS:"
    tabs_with_folder = EntityTab.where(warehouse_enabled: true).count
    tabs_with_folder_id = EntityTab.where(warehouse_enabled: true).where.not(storage_folder_id: [nil, ""]).count
    puts "  Tabs with SharePoint folder: #{tabs_with_folder}"
    puts "  With folder ID stored: #{tabs_with_folder_id}"
    puts "  Need backfill: #{tabs_with_folder - tabs_with_folder_id}"
  end

  desc "Backfill folder IDs for jobs that have SharePoint folders"
  task backfill_job_folder_ids: :environment do
    puts "=== Backfilling Job Folder IDs ==="

    credential = MicrosoftCredential.sharepoint_credential
    unless credential
      puts "❌ No SharePoint credential found"
      exit 1
    end

    client = MicrosoftGraphClient.new(credential)
    drive_id = credential.drive_id

    unless drive_id
      puts "❌ No drive_id on SharePoint credential"
      exit 1
    end

    puts "Drive ID: #{drive_id}"

    # Use the root_folder_id stored on the credential - this IS the TEEEM Jobs folder
    jobs_folder_id = credential.root_folder_id
    unless jobs_folder_id
      puts "❌ No root_folder_id on SharePoint credential"
      exit 1
    end

    puts "Jobs folder ID: #{jobs_folder_id}"
    puts ""

    # Helper to fetch all items from a folder (handles pagination)
    fetch_folder_items = lambda do |folder_id|
      items = []
      url = "/drives/#{drive_id}/items/#{folder_id}/children?$filter=folder ne null&$select=id,name,folder"
      loop do
        response = client.get(url)
        items.concat(response["value"] || [])
        url = response["@odata.nextLink"]&.sub("https://graph.microsoft.com/v1.0", "")
        break unless url
      end
      items
    end

    # Search for job folders (recursively up to 2 levels deep)
    puts "Fetching all job folders from SharePoint (including subfolders)..."
    folder_lookup = {}

    search_for_jobs = lambda do |folder_id, depth = 0, path = ""|
      items = fetch_folder_items.call(folder_id)
      items.each do |folder|
        name = folder["name"]
        # Check if this is a job folder
        if name =~ /^(\d{3})\s*-/
          job_id = $1.to_i
          folder_lookup[job_id] = folder.merge("path" => path)
        elsif depth < 2
          # Recurse into subfolders (but not into job folders)
          search_for_jobs.call(folder["id"], depth + 1, "#{path}#{name}/")
        end
      end
    end

    search_for_jobs.call(jobs_folder_id)

    puts "Found #{folder_lookup.count} job folders in SharePoint"
    puts ""

    # Update jobs
    updated = 0
    skipped = 0
    not_found = 0

    Job.where(sharepoint_folder_status: "completed")
       .where(sharepoint_folder_id: [nil, ""])
       .find_each do |job|
      folder = folder_lookup[job.id]
      if folder
        job.update_column(:sharepoint_folder_id, folder["id"])
        path_info = folder["path"].present? ? " (in #{folder['path']})" : ""
        puts "✅ Job #{job.id}: #{folder['name']}#{path_info}"
        updated += 1
      else
        puts "⚠️  Job #{job.id}: No matching folder found"
        not_found += 1
      end
    end

    puts ""
    puts "=== Summary ==="
    puts "  Updated: #{updated}"
    puts "  Not found: #{not_found}"
  end

  desc "Verify and fix job folder naming conventions"
  task verify_folder_names: :environment do
    puts "=== Verifying Job Folder Names ==="

    credential = MicrosoftCredential.sharepoint_credential
    unless credential
      puts "❌ No SharePoint credential found"
      exit 1
    end

    client = MicrosoftGraphClient.new(credential)
    drive_id = credential.drive_id

    unless drive_id
      puts "❌ No drive_id on SharePoint credential"
      exit 1
    end

    mismatched = []

    Job.where.not(sharepoint_folder_id: [nil, ""]).find_each do |job|
      # Get current folder name from SharePoint
      begin
        folder = client.get("/drives/#{drive_id}/items/#{job.sharepoint_folder_id}")
        current_name = folder["name"]

        # Calculate expected name
        expected_name = format("%03d - %s", job.id, job.title.to_s.split(",").first.to_s.strip[0..50])

        if current_name != expected_name
          mismatched << {
            job: job,
            current: current_name,
            expected: expected_name
          }
          puts "⚠️  Job #{job.id}:"
          puts "     Current:  #{current_name}"
          puts "     Expected: #{expected_name}"
        else
          puts "✅ Job #{job.id}: #{current_name}"
        end
      rescue => e
        puts "❌ Job #{job.id}: Error - #{e.message}"
      end
    end

    puts ""
    puts "=== Summary ==="
    puts "  Total checked: #{Job.where.not(sharepoint_folder_id: [nil, '']).count}"
    puts "  Mismatched: #{mismatched.count}"

    if mismatched.any? && ENV["FIX"] == "true"
      puts ""
      puts "=== Fixing mismatched folders ==="
      mismatched.each do |item|
        begin
          client.rename_folder(item[:job].sharepoint_folder_id, item[:expected])
          puts "✅ Renamed Job #{item[:job].id} folder"
        rescue => e
          puts "❌ Failed to rename Job #{item[:job].id}: #{e.message}"
        end
      end
    elsif mismatched.any?
      puts ""
      puts "Run with FIX=true to rename mismatched folders:"
      puts "  bin/rails sharepoint:verify_folder_names FIX=true"
    end
  end

  desc "Run full SharePoint standardization (backfill IDs, verify names)"
  task standardize: :environment do
    puts "🚀 Running full SharePoint standardization..."
    puts ""

    Rake::Task["sharepoint:backfill_job_folder_ids"].invoke
    puts ""
    puts "=" * 50
    puts ""
    Rake::Task["sharepoint:verify_folder_names"].invoke

    puts ""
    puts "✅ Standardization complete!"
    puts ""
    puts "Next steps:"
    puts "  1. If folder names need fixing, run: bin/rails sharepoint:verify_folder_names FIX=true"
    puts "  2. To analyze documents for renaming, run the AI analyzer job"
    puts "  3. To preview document renames, use: GET /api/v1/document_standardization/preview"
  end
end
