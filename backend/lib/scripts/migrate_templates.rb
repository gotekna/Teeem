# Template Migration Script
# Run with: heroku run rails runner tmp/migrate_templates.rb --app teeemlive

graph_client = MicrosoftAppGraphClient.new

migrations = {
  27 => { folder: "Templates/Contract", filename: "qbcc-contract.docx" },
  26 => { folder: "Templates/Contract", filename: "qbcc-general-conditions.docx" },
  25 => { folder: "Templates/Contract", filename: "qbcc-consumer-building-guide.docx" },
  24 => { folder: "Templates/Letters", filename: "welcome-letter.docx" },
  29 => { folder: "Templates/Forms", filename: "owners-authority.docx" },
  32 => { folder: "Templates/Forms", filename: "colour-selections.docx" },
  30 => { folder: "Templates/Forms", filename: "spec-acknowledgement.docx" },
  28 => { folder: "Templates/Specifications", filename: "specifications.docx" },
  31 => { folder: "Templates/Specifications", filename: "termite-protection.docx" }
}

puts "\n=== Migrating Templates to New Folder Structure ===\n\n"

migrations.each do |id, config|
  template = DocumentTemplate.find_by(id: id)
  next unless template&.sharepoint_linked?

  puts "#{template.name}:"
  puts "  FROM: #{template.sharepoint_path}"
  puts "  TO:   #{config[:folder]}/#{config[:filename]}"

  begin
    # Download content from old location
    content = graph_client.get_drive_item_content(
      drive_id: template.sharepoint_drive_id,
      item_id: template.sharepoint_item_id
    )

    # Upload to new location
    new_item = graph_client.upload_file_content(
      nil,
      template.sharepoint_drive_id,
      config[:folder],
      config[:filename],
      content
    )

    # Update database
    new_path = "#{config[:folder]}/#{config[:filename]}"
    template.update!(
      sharepoint_path: new_path,
      sharepoint_item_id: new_item["id"]
    )

    puts "  DONE!"
  rescue => e
    puts "  ERROR: #{e.message}"
  end

  puts ""
end

puts "=== Migration Complete ===\n"
