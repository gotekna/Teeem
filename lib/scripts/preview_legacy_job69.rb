# Preview classification for all legacy files for Job 69
# Shows suggested folder and type for each file

job = Job.find(69)
puts "=== PREVIEW: LEGACY FILES FOR JOB 69 ==="
puts "Job: #{job.title}"
puts ""

# Get legacy files
service = JobDocumentMigrationService.new
files = service.list_legacy_files_for_job(job)
puts "Found #{files.length} legacy files"
puts ""

# Classification rules based on filename patterns
def classify_file(filename)
  name = filename.downcase

  # Revit/CAD
  return { folder: "02 PreCon/Revit-DWG", type: "RVT", reason: "Revit project file" } if name.end_with?(".rvt")
  return { folder: "02 PreCon/Revit-DWG", type: "RFA", reason: "Revit family" } if name.end_with?(".rfa")
  return { folder: "02 PreCon/Revit-DWG", type: "DWG", reason: "AutoCAD drawing" } if name.end_with?(".dwg")
  return { folder: "02 PreCon/Revit-DWG", type: "DXF", reason: "AutoCAD export" } if name.end_with?(".dxf")

  # Photos/Videos
  return { folder: "06 Photo/01 SITE", type: "PHOTO", reason: "Image file" } if name.match?(/\.(jpg|jpeg|png|heic)$/i)
  return { folder: "06 Photo/01 SITE", type: "VIDEO", reason: "Video file" } if name.match?(/\.(mp4|mov)$/i)
  return { folder: "06 Photo/01 SITE", type: "VIDEO", reason: "Drone video metadata" } if name.match?(/\.(lrf|srt)$/i)

  # Forms and Certifications
  return { folder: "03 Certification/Final Approval", type: "F21", reason: "Form 21 - Final inspection" } if name.include?("form 21") || name.include?("form21")
  return { folder: "03 Certification/Final Approval", type: "F16", reason: "Form 16 - Inspection certificate" } if name.include?("form 16") || name.include?("form16")
  return { folder: "03 Certification", type: "CERT", reason: "Form 12 - Compliance" } if name.include?("form 12") || name.include?("form12")
  return { folder: "03 Certification", type: "CERT", reason: "Form 15 - Design certificate" } if name.include?("form 15") || name.include?("form15")
  return { folder: "03 Certification", type: "CERT", reason: "Form 43 - Compliance" } if name.include?("form 43") || name.include?("form43")
  return { folder: "03 Certification", type: "CERT", reason: "Inspection document" } if name.include?("inspection") && !name.include?("final")
  return { folder: "03 Certification/Final Approval", type: "FINAL", reason: "Final inspection/approval" } if name.include?("final inspection")

  # Energy/HEBS
  return { folder: "03 Certification/Energy Efficiency", type: "HEBS", reason: "Energy efficiency assessment" } if name.include?("energy") || name.include?("ee assessment")

  # Plumbing
  return { folder: "03 Certification/Plumbing", type: "PLUMB", reason: "Plumbing certificate/permit" } if name.include?("plumb") || name.include?("drain")

  # Council
  return { folder: "03 Certification/Council", type: "COUNCIL", reason: "Council approval/referral" } if name.include?("council") || name.include?("concurrence")
  return { folder: "03 Certification/Council", type: "COUNCIL", reason: "Development approval" } if name.include?("decision notice") || name.include?("approved")
  return { folder: "03 Certification/Council", type: "COUNCIL", reason: "Driveway/crossover permit" } if name.include?("driveway") || name.include?("crossover")

  # Contracts
  return { folder: "02 PreCon/Contracts", type: "JCON", reason: "QBCC contract" } if name.include?("qbcc") && name.include?("contract")
  return { folder: "02 PreCon/Contracts", type: "JCON", reason: "REIQ contract" } if name.include?("reiq")
  return { folder: "02 PreCon/Contracts", type: "JCON", reason: "Building contract" } if name.include?("contract")
  return { folder: "02 PreCon/Contracts", type: "JCON", reason: "Engagement/agreement" } if name.include?("engagement") || name.include?("agreement")

  # Plans
  return { folder: "04 Plans/Certified Plans", type: "CPLAN", reason: "Certified/approved plans" } if name.include?("certified") || name.include?("certification plan")
  return { folder: "04 Plans/Working Drawings", type: "WDRAW", reason: "Working drawings" } if name.include?("wd plan") || name.include?("working")
  return { folder: "04 Plans", type: "PLAN", reason: "Architectural plans" } if name.include?("architectural")
  return { folder: "04 Plans", type: "PLAN", reason: "Amended plans" } if name.include?("amended")

  # Estimation/Quotes
  return { folder: "02 PreCon/Estimation", type: "EST", reason: "Quote/estimate" } if name.include?("quote")
  return { folder: "02 PreCon/Estimation", type: "EST", reason: "Price list" } if name.include?("price")
  return { folder: "02 PreCon/Estimation", type: "EST", reason: "Purchase order" } if name.include?("purchase order") || name.match?(/po[\-_]?\d+/i)
  return { folder: "02 PreCon/Estimation", type: "EST", reason: "Invoice" } if name.include?("invoice")

  # Land/Survey
  return { folder: "02 PreCon/Land Info", type: "LAND", reason: "Survey document" } if name.include?("survey") || name.include?("setout")
  return { folder: "02 PreCon/Land Info", type: "LAND", reason: "Soil/site report" } if name.include?("soil") || name.include?("site class")
  return { folder: "02 PreCon/Land Info", type: "LAND", reason: "Disclosure plan" } if name.include?("disclosure")

  # Colour Selection / Specs
  return { folder: "02 PreCon/Colour Selection", type: "COLOR", reason: "Selection document" } if name.include?("selection")
  return { folder: "02 PreCon/Colour Selection", type: "COLOR", reason: "Specification sheet" } if name.include?("spec") && !name.include?("inspection")
  return { folder: "02 PreCon/Colour Selection", type: "COLOR", reason: "Product specification" } if name.match?(/specsheet|userguide|userinstall/i)

  # Engineering
  return { folder: "02 PreCon/Revit-DWG", type: "ENG", reason: "Engineering document" } if name.include?("engineering")
  return { folder: "02 PreCon/Revit-DWG", type: "ENG", reason: "Truss layout" } if name.include?("truss")
  return { folder: "02 PreCon/Revit-DWG", type: "ENG", reason: "Design document" } if name.include?("design") && name.end_with?(".pdf")

  # QBCC/Insurance/Q-Leave
  return { folder: "02 PreCon/Contracts", type: "QBCC", reason: "QBCC insurance cover" } if name.include?("qbcc") || name.include?("notice of cover")
  return { folder: "02 PreCon/Contracts", type: "QBCC", reason: "Q-Leave levy" } if name.include?("qleave") || name.include?("q leave")

  # Termite
  return { folder: "03 Certification", type: "CERT", reason: "Termite management" } if name.include?("termite") || name.include?("tms")

  # Stormwater
  return { folder: "03 Certification", type: "CERT", reason: "Stormwater certificate" } if name.include?("stormwater")

  # Smoke alarms
  return { folder: "03 Certification", type: "CERT", reason: "Smoke alarm certificate" } if name.include?("smoke alarm")

  # Waterproofing
  return { folder: "03 Certification", type: "CERT", reason: "Waterproofing certificate" } if name.include?("waterproof")

  # Glazing/Windows
  return { folder: "03 Certification", type: "CERT", reason: "Glazing compliance" } if name.include?("glazing") || name.include?("window")

  # Roof
  return { folder: "03 Certification", type: "CERT", reason: "Roof certificate" } if name.include?("roof") && name.include?("form")

  # Showerscreen
  return { folder: "03 Certification", type: "CERT", reason: "Showerscreen certificate" } if name.include?("shower")

  # Ascon/Sewer/Water plans
  return { folder: "02 PreCon/Land Info", type: "LAND", reason: "Infrastructure plans" } if name.include?("ascon") || name.include?("sewer") || name.include?("water")

  # Summary documents
  return { folder: "01 Sales", type: "SALES", reason: "Summary document" } if name.include?("summary")

  # ZIP files
  return { folder: "02 PreCon/Colour Selection", type: "COLOR", reason: "Specs archive" } if name.end_with?(".zip")

  # Word docs
  return { folder: "02 PreCon/Colour Selection", type: "COLOR", reason: "Selection document" } if name.end_with?(".docx") && name.include?("selection")

  # Excel
  return { folder: "02 PreCon/Estimation", type: "EST", reason: "Spreadsheet" } if name.end_with?(".xlsx")

  # MSG (email)
  return { folder: "01 Sales", type: "EMAIL", reason: "Email correspondence" } if name.end_with?(".msg")

  # Default - unclassified
  { folder: "01 Sales", type: "REVIEW", reason: "** NEEDS MANUAL REVIEW **", needs_review: true }
end

# Group files by suggested folder
by_folder = Hash.new { |h, k| h[k] = [] }
needs_review = []

files.each do |file|
  classification = classify_file(file[:name])
  size_mb = (file[:size].to_f / 1024 / 1024).round(2)

  entry = {
    name: file[:name],
    size: size_mb,
    type: classification[:type],
    reason: classification[:reason]
  }

  if classification[:needs_review]
    needs_review << entry
  else
    by_folder[classification[:folder]] << entry
  end
end

# Print by folder
by_folder.keys.sort.each do |folder|
  files_in_folder = by_folder[folder]
  puts "=" * 60
  puts "#{folder} (#{files_in_folder.length} files)"
  puts "=" * 60
  files_in_folder.each do |f|
    puts "  [#{f[:type].ljust(6)}] #{f[:name]}"
    puts "          #{f[:reason]} (#{f[:size]} MB)"
  end
  puts ""
end

# Print needs review
if needs_review.any?
  puts "=" * 60
  puts "** NEEDS MANUAL REVIEW ** (#{needs_review.length} files)"
  puts "=" * 60
  needs_review.each do |f|
    puts "  #{f[:name]} (#{f[:size]} MB)"
  end
  puts ""
end

# Summary
puts "=" * 60
puts "SUMMARY"
puts "=" * 60
puts "Total files: #{files.length}"
puts "Auto-classified: #{files.length - needs_review.length}"
puts "Needs review: #{needs_review.length}"
puts ""
puts "By folder:"
by_folder.keys.sort.each do |folder|
  puts "  #{folder}: #{by_folder[folder].length}"
end
if needs_review.any?
  puts "  01 Sales (needs review): #{needs_review.length}"
end
