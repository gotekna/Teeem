# Script to sync all job documents from Old House Data to TEEEM database
#
# Usage: rails runner lib/scripts/sync_old_house_data.rb
#
# This script:
# 1. Scans Old House Data folder structure
# 2. Matches folders to existing TEEEM jobs by address
# 3. Recursively syncs all files to JobDocument table
# 4. Uses onedrive_item_id as unique key to prevent duplicates

puts "=== Sync Old House Data to TEEEM Data Warehouse ==="
puts "Started at: #{Time.current}"

credential = OrganizationOneDriveCredential.active_credential
unless credential
  puts "ERROR: No active OneDrive credential found"
  exit 1
end

client = MicrosoftGraphClient.new(credential)

# Build address lookup for all jobs
# Normalize addresses for fuzzy matching
def normalize_address(str)
  return "" if str.blank?
  str.to_s.downcase
    .gsub(/[^a-z0-9\s]/, "")  # Remove special chars
    .gsub(/\s+/, " ")          # Normalize spaces
    .gsub(/\b(street|st|road|rd|avenue|ave|drive|dr|court|ct|place|pl|crescent|cres|close|cl|circuit|cct|parade|pde|terrace|tce)\b/, "")
    .gsub(/\b(qld|nsw|vic|sa|wa|nt|act|tas)\b/, "")
    .gsub(/\b\d{4}\b/, "")     # Remove postcodes
    .gsub(/\blot\s*\d*\b/, "") # Remove "lot X"
    .strip
end

def extract_street_number(str)
  return nil if str.blank?
  # Match patterns like "83", "Lot 83", "12 -", etc.
  if str =~ /(?:lot\s*)?(\d+)/i
    $1.to_i
  end
end

def extract_street_name(str)
  return "" if str.blank?
  # Remove leading numbers, lot references, and normalize
  str.gsub(/^\d+\s*-?\s*/, "")
     .gsub(/^lot\s*\d+\s*[-\(\)]*\s*/i, "")
     .gsub(/,.*$/, "")  # Remove everything after comma
     .strip
end

# Load all jobs and create lookup
jobs = Job.all.to_a
puts "\nLoaded #{jobs.count} jobs from database"

# Manual mapping for known complex matches
MANUAL_MAPPINGS = {
  "12 - Lot 83 West Ridge Street, Thornlands" => 69,
  "13 - Lot 2 Manuka Road, Logan Village" => 101, # Created job Dec 2024
  "16 - Lot 160 Alperton Road - NDIS" => 48,
  "18 - Lot 22 (6) Speargrass Drive, Logan Village 4207" => 73,
  "19 - 48 Mali Way Logan Village - Formerly Lot 11 (5) Speargrass Drive, Logan" => 74,
  "35 - Lot 1 (23) Churchill Street , Bellbird Park" => 81,
  "38 - 36 Bowen Road, Glass House Mountains - QLD 4518" => 49,
  "52 - Lot 1 (34) Tristania Street, Cornubia" => 56,
  "90 - 56A Malbon" => 59,
  "94 - 1 Astonbrook Close, Carindale" => 62,
  "Lot 108 (45)  Vanessa Crescent Cotswold Hills Toowoomba" => 88,
  "Lot 2 Cambridge Place, King Windsor Estate, Burnside" => 85,
  "RENO Unit 2 - 41 Weston St, Coorparoo" => 87,

  # Kitchen jobs
  "1 Tristania Cornubia" => 56,
  "13 Azanian Street, Upper Mt Gravatt" => 65,
  "36 Bowen Rd Kitchens" => 49,
  "ANDREW - 22 Oakview Circuit Brookwater" => 52,
  "DOM - 113 Carlton Terrace, Manly" => 60,
  "GABY - 39 Cowell Street, Carindale, QLD - 4152" => 54,
  "ISSAC - 16 Farsley Place Manly West" => 64,
  "KERRI - 23 Orana Street, Victoria Point" => 51,
  "NATACHE - 43 Bougainvillea St Calamvale" => 53,
  "RAMAN - 14 Ruggles Ct, Mcdowall" => 61,
  "TRACEY - 146 Balmoral Road, Montville" => 45,

  # Completed Kitchen Jobs
  "38a Fleming Road, Herston" => 89,
  "BHUPESH - 223 Lakeside Avenue Springfield Lakes" => 90,
  "BRONWYN - 21b Pictum Street, Shailer Park" => 95,
  "HELEN - 10 Rachele Close, Forest Lake" => 91,
  "LINDA Bates - 3422 Surfers Paradise Boulevard" => 98,
  "LOSALINE - 12 Bompa Road, Waterford West" => 57,
  "NICK & Esther - 464 Chelsea Road" => 93,
  "PAWAN - 101 Wimbledon Circuit, Carseldine" => 94,
  "PIA - 303-623 Lutwyche Road" => 96,
  "TRICIA - 41 Weston St Coorparoo - Porchlight Interiors" => 87,
  "Unit 2 , 42 Bundall Road Bundall" => 84,
  "VICKI - 32 Mclwraith Avenue" => 99,

  # Drafting jobs
  "142 Fletcher Parade, Bardon - QLD 4065" => 58,
  "513 Hickory Street Gleneagle" => 55,

  # Completed FY jobs
  "20 - Lot 180 Avondale Street Morayfield QLD" => 75,
  "7 - Lot 6 Patrick King Drive, Burnside" => 86,

  # FY25 completed jobs - different naming pattern from active folders
  "Lot 2 Manuka Road - Logan Village" => 101
}.freeze

def find_job_for_folder(folder_name, jobs)
  # Check manual mapping first
  if MANUAL_MAPPINGS.key?(folder_name)
    job_id = MANUAL_MAPPINGS[folder_name]
    return Job.find_by(id: job_id) if job_id
    return nil
  end

  # Extract key parts from folder name
  folder_normalized = normalize_address(folder_name)
  folder_street = extract_street_name(folder_name)
  folder_number = extract_street_number(folder_name)

  # Try to match against jobs
  best_match = nil
  best_score = 0

  jobs.each do |job|
    job_normalized = normalize_address(job.title)
    job_street = extract_street_name(job.title)
    job_number = extract_street_number(job.title)

    score = 0

    # Street number match
    if folder_number && job_number && folder_number == job_number
      score += 50
    end

    # Street name fuzzy match
    if folder_street.present? && job_street.present?
      folder_words = folder_street.downcase.split(/\s+/)
      job_words = job_street.downcase.split(/\s+/)

      # Check for common words
      common = folder_words & job_words
      if common.any?
        score += common.length * 20
      end
    end

    # Full normalized string similarity
    if folder_normalized.present? && job_normalized.present?
      if folder_normalized.include?(job_normalized) || job_normalized.include?(folder_normalized)
        score += 30
      end
    end

    if score > best_score
      best_score = score
      best_match = job
    end
  end

  # Only return if score is high enough
  best_score >= 50 ? best_match : nil
end

# Recursive file sync function
def sync_folder_files(client, credential, folder_id, folder_path, job, stats)
  result = client.send(:get, "#{client.send(:drive_path)}/items/#{folder_id}/children")
  items = result["value"] || []

  items.each do |item|
    if item["folder"]
      # Recurse into subfolder
      subfolder_path = folder_path.present? ? "#{folder_path}/#{item['name']}" : item["name"]
      sync_folder_files(client, credential, item["id"], subfolder_path, job, stats)
    else
      # It's a file - sync it
      extension = File.extname(item["name"]).delete(".").downcase
      file_type = case extension
      when "pdf", "doc", "docx" then "document"
      when "xls", "xlsx", "csv" then "spreadsheet"
      when "jpg", "jpeg", "png", "gif", "heic", "bmp", "tiff" then "image"
      when "rvt", "dwg", "dxf" then "cad"
      when "mp4", "mov", "avi" then "video"
      else "other"
      end

      # Skip very large files (> 100MB) or system files
      next if item["size"].to_i > 100_000_000
      next if item["name"].start_with?("~$")  # Skip Office temp files
      next if item["name"] == ".DS_Store"

      # Find or create job document
      doc = JobDocument.find_or_initialize_by(
        job_id: job.id,
        onedrive_item_id: item["id"]
      )

      was_new = doc.new_record?

      doc.assign_attributes(
        onedrive_drive_id: credential.drive_id || credential.id.to_s,
        file_name: item["name"],
        file_extension: extension,
        file_type: file_type,
        file_size: item["size"],
        folder_path: folder_path,
        web_url: item["webUrl"],
        last_modified_at: item["lastModifiedDateTime"],
        sync_status: "synced",
        last_synced_at: Time.current
      )

      if doc.save
        if was_new
          stats[:created] += 1
        elsif doc.saved_changes.any?
          stats[:updated] += 1
        else
          stats[:unchanged] += 1
        end
      else
        stats[:errors] += 1
        puts "    ERROR saving #{item['name']}: #{doc.errors.full_messages.join(', ')}"
      end
    end
  end
rescue => e
  puts "  ERROR scanning folder #{folder_path}: #{e.message}"
  stats[:folder_errors] += 1
end

# Find Old House Data folder
root = client.send(:get, "#{client.send(:drive_path)}/root/children")
old_house = (root["value"] || []).find { |i| i["name"] == "Old House Data" }

unless old_house
  puts "ERROR: Old House Data folder not found"
  exit 1
end

puts "Found Old House Data folder: #{old_house['id']}"

# Track overall stats
total_stats = { created: 0, updated: 0, unchanged: 0, errors: 0, folder_errors: 0, unmatched: 0 }
matched_jobs = []
unmatched_folders = []

# Folders to scan within Old House Data
FOLDERS_TO_SCAN = [
  "00 Active - Soon to be moved out",
  "00 Current  Kitchen Jobs",
  "01 Drafting",
  "01 Jobs Complete"
].freeze

# Get Old House Data children
old_house_children = client.send(:get, "#{client.send(:drive_path)}/items/#{old_house['id']}/children")
folders_to_process = (old_house_children["value"] || []).select { |f|
  f["folder"] && FOLDERS_TO_SCAN.any? { |name| f["name"].include?(name.split.first(2).join(" ")) }
}

puts "\nProcessing #{folders_to_process.count} main folders..."

folders_to_process.each do |main_folder|
  puts "\n=== #{main_folder['name']} ==="

  # Get job folders within this main folder
  folder_children = client.send(:get, "#{client.send(:drive_path)}/items/#{main_folder['id']}/children")
  job_folders = (folder_children["value"] || []).select { |f| f["folder"] }

  # Handle completed jobs subfolder structure (24 FY, 25 FY)
  if main_folder["name"].include?("Jobs Complete")
    # Go one level deeper for FY folders
    fy_folders = job_folders.select { |f| f["name"] =~ /\d+\s*FY|Delete/i }

    fy_folders.each do |fy_folder|
      next if fy_folder["name"].downcase.include?("delete")

      puts "  #{fy_folder['name']}:"
      fy_children = client.send(:get, "#{client.send(:drive_path)}/items/#{fy_folder['id']}/children")
      fy_job_folders = (fy_children["value"] || []).select { |f| f["folder"] }

      fy_job_folders.each do |job_folder|
        job = find_job_for_folder(job_folder["name"], jobs)

        if job
          puts "    [MATCH] #{job_folder['name']} -> Job #{job.id}: #{job.title}"
          matched_jobs << { folder: job_folder["name"], job: job }

          stats = { created: 0, updated: 0, unchanged: 0, errors: 0, folder_errors: 0 }
          sync_folder_files(client, credential, job_folder["id"], "", job, stats)

          puts "      Synced: #{stats[:created]} new, #{stats[:updated]} updated, #{stats[:unchanged]} unchanged"
          total_stats.merge!(stats) { |k, old, new| old + new }
        else
          puts "    [SKIP] #{job_folder['name']} - No matching job found"
          unmatched_folders << "#{main_folder['name']}/#{fy_folder['name']}/#{job_folder['name']}"
          total_stats[:unmatched] += 1
        end
      end
    end
    next
  end

  # Handle Kitchen completed subfolder
  if main_folder["name"].include?("Kitchen")
    completed_folder = job_folders.find { |f| f["name"].downcase.include?("completed") }
    if completed_folder
      completed_children = client.send(:get, "#{client.send(:drive_path)}/items/#{completed_folder['id']}/children")
      completed_jobs = (completed_children["value"] || []).select { |f| f["folder"] }
      job_folders = job_folders.reject { |f| f["name"].downcase.include?("completed") || f["name"].downcase.include?("old") }
      job_folders += completed_jobs
    end
  end

  # Skip template/system folders
  job_folders = job_folders.reject { |f|
    f["name"].downcase.include?("template") ||
    f["name"].downcase.include?("zz old") ||
    f["name"].downcase.include?("zz photos") ||
    f["name"] == "New folder" ||
    f["name"].downcase.include?("draft contract") ||
    f["name"].downcase.include?("colour selection") ||
    f["name"].downcase.include?("waiting")
  }

  job_folders.each do |job_folder|
    job = find_job_for_folder(job_folder["name"], jobs)

    if job
      puts "  [MATCH] #{job_folder['name']} -> Job #{job.id}: #{job.title}"
      matched_jobs << { folder: job_folder["name"], job: job }

      stats = { created: 0, updated: 0, unchanged: 0, errors: 0, folder_errors: 0 }
      sync_folder_files(client, credential, job_folder["id"], "", job, stats)

      puts "    Synced: #{stats[:created]} new, #{stats[:updated]} updated, #{stats[:unchanged]} unchanged"
      total_stats.merge!(stats) { |k, old, new| old + new }
    else
      puts "  [SKIP] #{job_folder['name']} - No matching job found"
      unmatched_folders << "#{main_folder['name']}/#{job_folder['name']}"
      total_stats[:unmatched] += 1
    end
  end
end

puts "\n" + "=" * 60
puts "=== SYNC COMPLETE ==="
puts "=" * 60
puts "Finished at: #{Time.current}"
puts "\nDocuments:"
puts "  Created:   #{total_stats[:created]}"
puts "  Updated:   #{total_stats[:updated]}"
puts "  Unchanged: #{total_stats[:unchanged]}"
puts "  Errors:    #{total_stats[:errors]}"
puts "\nFolders:"
puts "  Matched:   #{matched_jobs.count}"
puts "  Unmatched: #{total_stats[:unmatched]}"
puts "  Scan Errors: #{total_stats[:folder_errors]}"

puts "\n=== MATCHED JOBS ==="
matched_jobs.each do |m|
  count = JobDocument.where(job_id: m[:job].id).count
  puts "  Job #{m[:job].id}: #{m[:job].title} (#{count} docs)"
end

if unmatched_folders.any?
  puts "\n=== UNMATCHED FOLDERS (need manual mapping) ==="
  unmatched_folders.each { |f| puts "  #{f}" }
end

puts "\n=== DATABASE TOTALS ==="
puts "Total documents in database: #{JobDocument.count}"
puts "Jobs with documents: #{JobDocument.distinct.pluck(:job_id).count}"
