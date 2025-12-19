# Import all legacy files for Job 69
# Move files to new folder structure, classify what we can, mark rest for review

job = Job.find(69)
puts "=== IMPORTING LEGACY FILES FOR JOB 69 ==="
puts "Job: #{job.title}"
puts ""

credential = OrganizationOneDriveCredential.active_credential
unless credential&.valid_credential?
  puts "ERROR: SharePoint not connected"
  exit 1
end

client = MicrosoftGraphClient.new(credential)

# Get the job folder
job_folder = client.find_job_folder(job)
unless job_folder
  puts "ERROR: Job folder not found - run create_job_folders first"
  exit 1
end
puts "Job folder: #{job_folder['name']}"
puts ""

# Get legacy files
service = JobDocumentMigrationService.new
files = service.list_legacy_files_for_job(job)
puts "Found #{files.length} legacy files to import"
puts ""

# Classification rules based on filename patterns
def classify_file(filename)
  name = filename.downcase

  # Revit/CAD
  return { folder: "02 PreCon/Revit-DWG", type: "RVT" } if name.end_with?(".rvt")
  return { folder: "02 PreCon/Revit-DWG", type: "RFA" } if name.end_with?(".rfa")
  return { folder: "02 PreCon/Revit-DWG", type: "DWG" } if name.end_with?(".dwg")
  return { folder: "02 PreCon/Revit-DWG", type: "DXF" } if name.end_with?(".dxf")

  # Photos/Videos
  return { folder: "06 Photo/01 SITE", type: "PHOTO" } if name.match?(/\.(jpg|jpeg|png|heic)$/i)
  return { folder: "06 Photo/01 SITE", type: "VIDEO" } if name.match?(/\.(mp4|mov|lrf|srt)$/i)

  # Forms and Certifications
  return { folder: "03 Certification/Final Approval", type: "FINAL" } if name.include?("form 21") || name.include?("form21")
  return { folder: "03 Certification/Final Approval", type: "FINAL" } if name.include?("form 16") || name.include?("form16")
  return { folder: "03 Certification", type: "CERT" } if name.include?("form 12") || name.include?("form12")
  return { folder: "03 Certification", type: "CERT" } if name.include?("form 15") || name.include?("form15")
  return { folder: "03 Certification", type: "CERT" } if name.include?("form 43") || name.include?("form43")
  return { folder: "03 Certification", type: "CERT" } if name.include?("inspection")
  return { folder: "03 Certification/Final Approval", type: "FINAL" } if name.include?("final")

  # Energy/HEBS
  return { folder: "03 Certification/Energy Efficiency", type: "HEBS" } if name.include?("energy") || name.include?("ee assessment")

  # Plumbing
  return { folder: "03 Certification/Plumbing", type: "PLUMB" } if name.include?("plumb") || name.include?("drain")

  # Council
  return { folder: "03 Certification/Council", type: "COUNCIL" } if name.include?("council") || name.include?("approval") || name.include?("concurrence")
  return { folder: "03 Certification/Council", type: "COUNCIL" } if name.include?("decision notice")

  # Contracts
  return { folder: "02 PreCon/Contracts", type: "JCON" } if name.include?("contract") || name.include?("qbcc")
  return { folder: "02 PreCon/Contracts", type: "JCON" } if name.include?("reiq")

  # Plans
  return { folder: "04 Plans/Certified Plans", type: "CPLAN" } if name.include?("certified") || name.include?("approved plan")
  return { folder: "04 Plans/Working Drawings", type: "WDRAW" } if name.include?("working") || name.include?("wd plan")
  return { folder: "04 Plans", type: "PLAN" } if name.include?("plan") && name.end_with?(".pdf")

  # Estimation/Quotes
  return { folder: "02 PreCon/Estimation", type: "EST" } if name.include?("quote") || name.include?("price")
  return { folder: "02 PreCon/Estimation", type: "EST" } if name.include?("purchase order") || name.include?("po0")

  # Land/Survey
  return { folder: "02 PreCon/Land Info", type: "LAND" } if name.include?("survey") || name.include?("soil") || name.include?("setout")
  return { folder: "02 PreCon/Land Info", type: "LAND" } if name.include?("site class")

  # Colour Selection
  return { folder: "02 PreCon/Colour Selection", type: "COLOR" } if name.include?("selection") || name.include?("colour") || name.include?("color")
  return { folder: "02 PreCon/Colour Selection", type: "COLOR" } if name.include?("spec") && !name.include?("inspection")

  # Engineering
  return { folder: "02 PreCon/Revit-DWG", type: "ENG" } if name.include?("engineering") || name.include?("truss")

  # QBCC/Insurance
  return { folder: "02 PreCon/Contracts", type: "JCON" } if name.include?("qbcc") || name.include?("cover")
  return { folder: "02 PreCon/Contracts", type: "JCON" } if name.include?("qleave") || name.include?("q leave")

  # Default - unclassified goes to 01 Sales for review
  { folder: "01 Sales", type: "REVIEW", needs_review: true }
end

# Get all subfolders in job folder
job_items = client.list_folder_items(job_folder["id"])
folder_cache = {}
job_items["value"]&.each do |item|
  folder_cache[item["name"]] = item["id"] if item["folder"]
end

# Also get subfolders of subfolders
job_items["value"]&.select { |i| i["folder"] }&.each do |parent|
  sub_items = client.list_folder_items(parent["id"])
  sub_items["value"]&.each do |item|
    folder_cache["#{parent['name']}/#{item['name']}"] = item["id"] if item["folder"]
  end
end

puts "Folder cache: #{folder_cache.keys.join(', ')}"
puts ""

# Track stats
stats = {
  moved: 0,
  classified: 0,
  needs_review: 0,
  errors: [],
  by_folder: Hash.new(0)
}

# Process each file
files.each_with_index do |file, idx|
  begin
    classification = classify_file(file[:name])
    target_folder = classification[:folder]
    target_folder_id = folder_cache[target_folder]

    unless target_folder_id
      # Try partial match
      target_folder_id = folder_cache.find { |k, v| k.end_with?(target_folder.split("/").last) }&.last
    end

    unless target_folder_id
      puts "#{idx + 1}. SKIP (no folder): #{file[:name]} -> #{target_folder}"
      stats[:errors] << { file: file[:name], error: "Folder not found: #{target_folder}" }
      next
    end

    # Move the file
    client.move_item(file[:id], target_folder_id)

    status = classification[:needs_review] ? "REVIEW" : "OK"
    puts "#{idx + 1}. #{status}: #{file[:name]} -> #{target_folder}"

    stats[:moved] += 1
    stats[:by_folder][target_folder] += 1

    if classification[:needs_review]
      stats[:needs_review] += 1
    else
      stats[:classified] += 1
    end

  rescue => e
    puts "#{idx + 1}. ERROR: #{file[:name]} - #{e.message}"
    stats[:errors] << { file: file[:name], error: e.message }
  end
end

puts ""
puts "=== IMPORT COMPLETE ==="
puts "Total files: #{files.length}"
puts "Moved: #{stats[:moved]}"
puts "Classified: #{stats[:classified]}"
puts "Needs review: #{stats[:needs_review]}"
puts "Errors: #{stats[:errors].length}"
puts ""
puts "Files by folder:"
stats[:by_folder].sort.each do |folder, count|
  puts "  #{folder}: #{count}"
end

if stats[:errors].any?
  puts ""
  puts "Errors:"
  stats[:errors].first(10).each do |err|
    puts "  #{err[:file]}: #{err[:error]}"
  end
end
