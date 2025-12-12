namespace :document_templates do
  desc "Create DocumentTemplates from BPMN service tasks"
  task create_from_bpmn: :environment do
    process = BpmnProcess.find_by(name: "UPHomes Dual Client") ||
              BpmnProcess.find_by(name: "Dual Client Contract Pack") ||
              BpmnProcess.order(created_at: :desc).first

    unless process
      puts "No BPMN process found"
      exit
    end

    puts "Processing: #{process.name}"
    puts "=" * 60

    # Find all generate_document tasks (support both handler styles)
    service_tasks = process.bpmn_nodes.where(node_type: "service_task")
      .select { |n| n.config["handler"] == "generate_document" || n.config["task_type"] == "generate_document" }

    puts "Found #{service_tasks.count} document generation tasks"
    puts ""

    service_tasks.each do |task|
      # Extract template name from config, node name, or output_filename
      template_name = extract_template_name(task)
      output_format = task.config["convert_to_pdf"] ? "pdf" : "docx"

      puts "Node: #{task.name}"
      puts "  Template Name: #{template_name}"

      next if template_name.blank?

      # Check if already exists
      existing = DocumentTemplate.find_by(name: template_name)
      if existing
        puts "  -> Already exists (ID: #{existing.id})"
        # Update BPMN node config to reference the template
        update_bpmn_node_config(task, existing.id, template_name)
        puts "  -> Updated BPMN node config with template_id"
        puts ""
        next
      end

      # Create the template with Compoza SharePoint reference if available
      template = DocumentTemplate.create!(
        name: template_name,
        description: "Auto-created from BPMN workflow: #{process.name}",
        category: "contract",
        output_format: output_format,
        output_naming_pattern: "{job.job_number} - #{template_name}",
        is_active: true,
        # Store Compoza SharePoint reference for migration
        sharepoint_drive_id: task.config["template_drive_id"],
        sharepoint_item_id: task.config["template_item_id"],
        data_schema: {
          source: "bpmn_import",
          bpmn_process_id: process.id,
          bpmn_node_id: task.id,
          compoza_item_data: task.config["item_data"],
          output_filename_pattern: task.config["output_filename"]
        }
      )

      # Update BPMN node config to reference the new template
      update_bpmn_node_config(task, template.id, template_name)

      puts "  -> Created (ID: #{template.id})"
      puts "  -> Updated BPMN node config with template_id"
      if task.config["template_item_id"].present?
        puts "  -> Compoza SharePoint reference preserved"
      end
      puts ""
    end

    puts "=" * 60
    puts "Next steps:"
    puts "1. Upload Word templates to SharePoint: gotekna.sharepoint.com/sites/TEEEM/Shared Documents/Warehousing/Templates/"
    puts "2. Run: rake document_templates:setup_sharepoint_folder  (creates folder if needed)"
    puts "3. Run: rake document_templates:link_to_sharepoint       (auto-links by filename match)"
    puts ""
    puts "Word Template Variable Format:"
    puts "  {{job.address}}           - Job address"
    puts "  {{job.full_address}}      - Full formatted address"
    puts "  {{job.contract_price}}    - e.g. $450,000.00"
    puts "  {{job.lot}}               - Lot number"
    puts "  {{job.plan_number}}       - Plan/SP number"
    puts "  {{job.council}}           - Council name"
    puts "  {{job.build_period}}      - Build period"
    puts "  {{job.deposit}}           - Deposit amount"
    puts "  {{client_1.full_name}}    - Primary buyer full name"
    puts "  {{client_1.first_name}}   - Primary buyer first name"
    puts "  {{client_1.email}}        - Primary buyer email"
    puts "  {{client_2.full_name}}    - Secondary buyer full name"
    puts "  {{client_2.first_name}}   - Secondary buyer first name"
    puts "  {{builder.full_name}}     - Builder contact name"
    puts "  {{generated_date}}        - e.g. 11/12/2025"
  end

  desc "List all DocumentTemplates and their SharePoint status"
  task list: :environment do
    templates = DocumentTemplate.order(:name)

    puts "DocumentTemplates:"
    puts "=" * 80

    templates.each do |t|
      status = t.sharepoint_linked? ? "✓ Linked" : "✗ Not linked"
      puts "#{t.id.to_s.rjust(4)} | #{status.ljust(12)} | #{t.name}"
      if t.sharepoint_linked?
        puts "       SharePoint: #{t.sharepoint_path}"
      end
    end

    puts ""
    puts "Total: #{templates.count} templates"
    puts "Linked: #{templates.select(&:sharepoint_linked?).count}"
    puts "Not linked: #{templates.reject(&:sharepoint_linked?).count}"
  end

  desc "Link BPMN service tasks to existing DocumentTemplates by name"
  task link_bpmn_nodes: :environment do
    BpmnNode.where(node_type: "service_task").each do |node|
      next unless node.config["handler"] == "generate_document" || node.config["task_type"] == "generate_document"
      next if node.config["template_id"].present? # Already linked

      template_name = extract_template_name(node)
      next if template_name.blank?

      template = DocumentTemplate.find_by(name: template_name)
      if template
        update_bpmn_node_config(node, template.id, template_name)
        puts "Linked: #{node.name} -> Template #{template.id} (#{template.name})"
      else
        puts "NOT FOUND: #{node.name} needs template '#{template_name}'"
      end
    end
  end

  desc "Create Warehousing/Templates folder in TEEEM SharePoint and list contents"
  task setup_sharepoint_folder: :environment do
    sp_config = OrganizationMicrosoftAppCredential.teeem_sharepoint_config
    unless sp_config
      puts "ERROR: TEEEM SharePoint not configured"
      exit 1
    end

    puts "TEEEM SharePoint Configuration:"
    puts "  Site ID: #{sp_config[:site_id]}"
    puts "  Drive ID: #{sp_config[:drive_id]}"
    puts "  Drive Name: #{sp_config[:drive_name]}"
    puts ""

    client = MicrosoftAppGraphClient.new(sp_config[:credential])

    # Check if Warehousing/Templates folder exists
    puts "Checking for Warehousing/Templates folder..."
    begin
      existing = client.list_folder_contents(
        site_id: sp_config[:site_id],
        drive_id: sp_config[:drive_id],
        folder_path: "Warehousing/Templates"
      )
      puts "✓ Warehousing/Templates folder exists with #{existing.count} files:"
      existing.each do |item|
        type = item[:folder] ? "📁" : "📄"
        puts "  #{type} #{item[:name]} (#{item[:id]})"
      end
    rescue StandardError => e
      if e.message.include?("itemNotFound") || e.message.include?("404")
        puts "Creating Warehousing/Templates folder..."
        # First ensure Warehousing exists
        begin
          client.list_folder_contents(
            site_id: sp_config[:site_id],
            drive_id: sp_config[:drive_id],
            folder_path: "Warehousing"
          )
        rescue StandardError
          client.create_folder(
            site_id: sp_config[:site_id],
            drive_id: sp_config[:drive_id],
            parent_path: "",
            folder_name: "Warehousing"
          )
          puts "  Created Warehousing folder"
        end
        # Create Templates under Warehousing
        client.create_folder(
          site_id: sp_config[:site_id],
          drive_id: sp_config[:drive_id],
          parent_path: "Warehousing",
          folder_name: "Templates"
        )
        puts "✓ Warehousing/Templates folder created"
      else
        puts "ERROR: #{e.message}"
      end
    end

    # Store config for use by other tasks
    puts ""
    puts "To use this SharePoint for templates, templates should be linked with:"
    puts "  site_id: #{sp_config[:site_id]}"
    puts "  drive_id: #{sp_config[:drive_id]}"
    puts "  path: Warehousing/Templates/{filename}"
    puts ""
    puts "Upload Word templates to: SharePoint > #{sp_config[:drive_name]} > Warehousing > Templates"
  end

  desc "List files in TEEEM SharePoint Warehousing/Templates folder"
  task list_sharepoint_templates: :environment do
    sp_config = OrganizationMicrosoftAppCredential.teeem_sharepoint_config
    unless sp_config
      puts "ERROR: TEEEM SharePoint not configured"
      exit 1
    end

    client = MicrosoftAppGraphClient.new(sp_config[:credential])

    puts "Templates in TEEEM SharePoint (Warehousing/Templates):"
    puts "=" * 60

    begin
      files = client.list_folder_contents(
        site_id: sp_config[:site_id],
        drive_id: sp_config[:drive_id],
        folder_path: "Warehousing/Templates"
      )

      files.each do |item|
        next if item[:folder]
        puts "#{item[:name]}"
        puts "  ID: #{item[:id]}"
        puts "  Size: #{item[:size]} bytes"
        puts ""
      end

      puts "Total: #{files.reject { |f| f[:folder] }.count} template files"
    rescue StandardError => e
      puts "ERROR: #{e.message}"
      puts "(Warehousing/Templates folder may not exist yet - run rake document_templates:setup_sharepoint_folder)"
    end
  end

  desc "Link DocumentTemplates to files in TEEEM SharePoint Warehousing/Templates folder"
  task link_to_sharepoint: :environment do
    sp_config = OrganizationMicrosoftAppCredential.teeem_sharepoint_config
    unless sp_config
      puts "ERROR: TEEEM SharePoint not configured"
      exit 1
    end

    client = MicrosoftAppGraphClient.new(sp_config[:credential])

    puts "Linking DocumentTemplates to TEEEM SharePoint files..."
    puts "=" * 60

    # Get files from Warehousing/Templates folder
    begin
      files = client.list_folder_contents(
        site_id: sp_config[:site_id],
        drive_id: sp_config[:drive_id],
        folder_path: "Warehousing/Templates"
      )
    rescue StandardError => e
      puts "ERROR: #{e.message}"
      exit 1
    end

    # Build lookup map (filename without extension => file info)
    file_map = {}
    files.each do |file|
      next if file[:folder]
      base_name = File.basename(file[:name], ".*")
      file_map[base_name.downcase] = file
      # Also try without leading numbers: "01 Welcome Letter" => "Welcome Letter"
      simple_name = base_name.sub(/^\d+\s+/, "")
      file_map[simple_name.downcase] = file
    end

    # Link templates
    DocumentTemplate.find_each do |template|
      if template.sharepoint_linked?
        puts "#{template.name}: Already linked"
        next
      end

      # Try to find matching file
      match_key = template.name.downcase
      file = file_map[match_key]

      # Try with common variations
      unless file
        variations = [
          template.name.downcase,
          template.name.sub(/^\d+\s+/, "").downcase,
          template.name.gsub(/\s+/, " ").downcase
        ]
        variations.each do |v|
          file = file_map[v]
          break if file
        end
      end

      if file
        template.update!(
          sharepoint_site_id: sp_config[:site_id],
          sharepoint_drive_id: sp_config[:drive_id],
          sharepoint_item_id: file[:id],
          sharepoint_path: "Warehousing/Templates/#{file[:name]}"
        )
        puts "#{template.name}: ✓ Linked to #{file[:name]}"
      else
        puts "#{template.name}: ✗ No matching file found"
      end
    end
  end

  desc "Map Compoza item_data expressions to TEEEM field paths"
  task show_field_mapping: :environment do
    puts "Compoza to TEEEM Field Mapping"
    puts "=" * 70
    puts ""
    puts "Compoza Expression                              -> TEEEM Variable"
    puts "-" * 70
    puts "workflow['Contract'].properties.item.buyer_1    -> {{client_1.display_name}}"
    puts "workflow['Contract'].properties.item.buyer_2    -> {{client_2.display_name}}"
    puts "workflow['Contacts Buyer 1'].properties.item.*  -> {{client_1.*}}"
    puts "workflow['Contacts Buyer 2'].properties.item.*  -> {{client_2.*}}"
    puts "workflow['Contract'].properties.item.job        -> {{job.title}}"
    puts "workflow['Contract'].properties.item.lot        -> {{job.lot}}"
    puts "workflow['Contract'].properties.item.plan_sp_*  -> {{job.plan_sp_number}}"
    puts "workflow['Job'].properties.item.council_auto    -> {{job.council}}"
    puts "workflow['Job'].properties.item.job_name        -> {{job.title}}"
    puts "workflow['Job'].properties.item.builder_brand   -> {{job.builder_brand}}"
    puts ""
    puts "To create new Word templates, use TEEEM's Sablon syntax:"
    puts "  {{job.address}}         - Job street address"
    puts "  {{job.full_address}}    - Complete address with suburb, state, postcode"
    puts "  {{job.contract_price}}  - e.g. $450,000.00"
    puts "  {{job.lot}}             - Lot number"
    puts "  {{job.plan_sp_number}}  - Plan/SP number"
    puts "  {{job.council}}         - Council name"
    puts "  {{job.build_period}}    - Build period"
    puts "  {{job.deposit}}         - Deposit amount"
    puts "  {{client_1.display_name}} or {{client_1.full_name}}"
    puts "  {{client_1.first_name}}"
    puts "  {{client_1.email}}"
    puts "  {{client_2.display_name}} - Secondary buyer"
    puts "  {{builder.display_name}} - Builder contact"
    puts "  {{generated_date}}      - e.g. 11/12/2025"
    puts ""
  end

  # Helper: Extract template name from BPMN node
  def extract_template_name(task)
    # First try explicit template_name in config
    return task.config["template_name"] if task.config["template_name"].present?

    # Extract from output_filename pattern: "01 Welcome Letter - <%= ... %>.docx"
    if task.config["output_filename"].present?
      # Match pattern like "01 Welcome Letter - ..." or "02 QBCC Consumer Building Guide - ..."
      match = task.config["output_filename"].match(/^(\d+\s+)?(.+?)\s*-\s*<%/)
      return match[2].strip if match && match[2]
    end

    # Extract from node name: "Generate Welcome Letter" -> "Welcome Letter"
    if task.name.present?
      name = task.name.sub(/^Generate\s+/i, "").strip
      return name if name.present? && name != task.name
    end

    nil
  end

  # Helper: Update BPMN node config with template reference
  def update_bpmn_node_config(node, template_id, template_name)
    new_config = node.config.merge(
      "template_id" => template_id,
      "template_name" => template_name,
      "handler" => "generate_document"
    )
    node.update!(config: new_config)
  end

  desc "Convert old merge field syntax to new Sablon syntax in all templates"
  task convert_fields: :environment do
    require "zip"
    require "nokogiri"

    # Field mapping: old -> new
    FIELD_MAP = {
      # Client 1 fields
      "{Client1.First}" => "{{client_1.first_name}}",
      "{Client1.Full_Name}" => "{{client_1.display_name}}",
      "{Buyer1.Full_Name}" => "{{client_1.display_name}}",
      "{Buyer1.First_Name}" => "{{client_1.first_name}}",
      "{Buyer1.Home_Phone}" => "{{client_1.phone}}",
      "{Buyer1.Mobile}" => "{{client_1.mobile}}",
      "{Buyer1.Street}" => "{{client_1.address_line_1}}",
      "{Buyer1.Suburb}" => "{{client_1.suburb}}",
      "{Buyer1.State}" => "{{client_1.state}}",
      "{Buyer1.Postcode}" => "{{client_1.postcode}}",
      "{Buyer1.Email}" => "{{client_1.email}}",

      # Generic Client fields (map to client_1)
      "{Client.address}" => "{{client_1.address_line_1}}",
      "{Client.City}" => "{{client_1.suburb}}",
      "{Client.State}" => "{{client_1.state}}",
      "{Client.postcode}" => "{{client_1.postcode}}",
      "{Client.phone}" => "{{client_1.phone}}",
      "{Client.email}" => "{{client_1.email}}",

      # Client 2 fields
      "{Client2.First}" => "{{client_2.first_name}}",
      "{Client2.Full_Name}" => "{{client_2.display_name}}",
      "{Buyer2.Full_Name}" => "{{client_2.display_name}}",
      "{Buyer2.First_Name}" => "{{client_2.first_name}}",
      "{Buyer2.Home_Phone}" => "{{client_2.phone}}",
      "{Buyer2.Mobile}" => "{{client_2.mobile}}",
      "{Buyer2.Street}" => "{{client_2.address_line_1}}",
      "{Buyer2.Suburb}" => "{{client_2.suburb}}",
      "{Buyer2.State}" => "{{client_2.state}}",
      "{Buyer2.Postcode}" => "{{client_2.postcode}}",
      "{Buyer2.Email}" => "{{client_2.email}}",

      # Job/Address fields
      "{Job_Address.Title}" => "{{job.address}}",
      "{Job.Title}" => "{{job.title}}",
      "{Job.Address}" => "{{job.address}}",
      "{Job.Full_Address}" => "{{job.full_address}}",
      "{Job.Suburb}" => "{{job.suburb}}",
      "{Job.State}" => "{{job.state}}",
      "{Job.Postcode}" => "{{job.postcode}}",

      # Land fields
      "{Land.lot}" => "{{job.lot}}",
      "{land.lot}" => "{{job.lot}}",
      "{Land.Lot}" => "{{job.lot}}",
      "{land.SP_Number}" => "{{job.plan_number}}",
      "{Land.SP_Number}" => "{{job.plan_number}}",
      "{land.council}" => "{{job.council}}",
      "{Land.Council}" => "{{job.council}}",

      # Contract fields
      "{Contract.Contract_Price}" => "{{job.contract_price}}",
      "{Contract.Fixed_Price}" => "{{job.contract_price}}",
      "{Contract.Prime_Cost}" => "{{job.prime_cost}}",
      "{Contract.Provisonial_Sums}" => "{{job.provisional_sums}}",
      "{Contract.plan_date}" => "{{job.plan_date}}",
      "{Contract.spec_date}" => "{{job.spec_date}}",
      "{Contract.prime}" => "{{job.prime_cost}}",
      "{Contract.prov}" => "{{job.provisional_sums}}",

      # House/Build fields
      "{house.deposit}" => "{{job.deposit}}",
      "{House.Deposit}" => "{{job.deposit}}",
      "{house.build_days}" => "{{job.build_period}}",
      "{house.total_build}" => "{{job.build_period}}",
      "{house.slab}" => "{{job.stage_slab}}",
      "{house.frame}" => "{{job.stage_frame}}",
      "{house.enclosed}" => "{{job.stage_enclosed}}",
      "{house.fixing}" => "{{job.stage_fixing}}",
      "{house.practical}" => "{{job.stage_practical}}",
      "{house.weather}" => "{{job.stage_weather}}",
      "{house.weekend}" => "{{job.weekend_work}}",

      # Client type
      "{Client.type}" => "{{client_type}}",

      # Date fields
      "{Today}" => "{{generated_date}}",
      "{Date}" => "{{generated_date}}"
    }.freeze

    sp_config = OrganizationMicrosoftAppCredential.teeem_sharepoint_config
    unless sp_config
      puts "ERROR: TEEEM SharePoint not configured"
      exit 1
    end

    client = MicrosoftAppGraphClient.new(sp_config[:credential])

    # Check if Warehousing/Templates folder exists
    puts "Checking Warehousing/Templates folder..."
    templates_folder_exists = false
    begin
      client.list_drive_items(sp_config[:drive_id], folder_path: "Warehousing/Templates")
      puts "  Folder exists"
      templates_folder_exists = true
    rescue StandardError => e
      if e.message.include?("itemNotFound") || e.message.include?("404")
        puts "  Folder doesn't exist - will upload to Teeem Contract Info instead"
        puts "  (Create Warehousing/Templates folder manually in SharePoint to use that location)"
      else
        raise e
      end
    end

    # Determine upload folder
    upload_folder = templates_folder_exists ? "Warehousing/Templates" : "Teeem Contract Info/Converted"

    puts ""
    puts "Converting templates..."
    puts "=" * 60

    DocumentTemplate.find_each do |template|
      puts ""
      puts "#{template.id}: #{template.name}"

      unless template.sharepoint_item_id.present?
        puts "  SKIP: Not linked to SharePoint"
        next
      end

      begin
        # Download the template
        content = client.get_drive_item_content(
          site_id: sp_config[:site_id],
          drive_id: sp_config[:drive_id],
          item_id: template.sharepoint_item_id
        )
        puts "  Downloaded #{content.bytesize} bytes"

        # Process the DOCX file
        output = StringIO.new
        output.set_encoding("ASCII-8BIT")
        fields_converted = 0

        Zip::OutputStream.write_buffer(output) do |out|
          Zip::File.open_buffer(StringIO.new(content)) do |zip|
            zip.each do |entry|
              if entry.name.end_with?(".xml", ".rels")
                # Process XML files for field replacement
                xml_content = entry.get_input_stream.read

                FIELD_MAP.each do |old_field, new_field|
                  if xml_content.include?(old_field)
                    xml_content = xml_content.gsub(old_field, new_field)
                    fields_converted += 1
                  end
                end

                out.put_next_entry(entry.name)
                out.write(xml_content)
              else
                # Copy other files as-is
                out.put_next_entry(entry.name)
                out.write(entry.get_input_stream.read)
              end
            end
          end
        end

        output.rewind
        converted_content = output.read

        puts "  Converted #{fields_converted} field occurrences"

        if fields_converted > 0
          # Upload converted file
          new_filename = "#{template.name.parameterize}.docx"
          puts "  Uploading to #{upload_folder}/#{new_filename}..."

          result = client.upload_file_content(
            sp_config[:site_id],
            sp_config[:drive_id],
            upload_folder,
            new_filename,
            converted_content
          )

          # Update template record with new SharePoint location
          template.update!(
            sharepoint_item_id: result[:id],
            sharepoint_path: "#{upload_folder}/#{new_filename}"
          )

          puts "  OK: Uploaded and linked (ID: #{result[:id]})"
        else
          puts "  No fields to convert - keeping original"
        end

      rescue StandardError => e
        puts "  ERROR: #{e.message}"
      end
    end

    puts ""
    puts "=" * 60
    puts "Conversion complete!"
    puts ""
    puts "Templates are now in: SharePoint > Documents > Warehousing > Templates"
  end

  desc "Show what fields would be converted (dry run)"
  task convert_fields_preview: :environment do
    require "zip"

    sp_config = OrganizationMicrosoftAppCredential.teeem_sharepoint_config
    unless sp_config
      puts "ERROR: TEEEM SharePoint not configured"
      exit 1
    end

    client = MicrosoftAppGraphClient.new(sp_config[:credential])

    puts "Scanning templates for old field syntax..."
    puts "=" * 60

    all_fields = Set.new

    DocumentTemplate.find_each do |template|
      next unless template.sharepoint_item_id.present?

      begin
        content = client.get_drive_item_content(
          site_id: sp_config[:site_id],
          drive_id: sp_config[:drive_id],
          item_id: template.sharepoint_item_id
        )

        Zip::File.open_buffer(StringIO.new(content)) do |zip|
          doc_entry = zip.find_entry("word/document.xml")
          next unless doc_entry

          xml = doc_entry.get_input_stream.read
          fields = xml.scan(/\{[A-Za-z0-9_\.]+\}/).uniq

          if fields.any?
            puts ""
            puts "#{template.name}:"
            fields.each do |f|
              all_fields.add(f)
              puts "  #{f}"
            end
          end
        end
      rescue StandardError => e
        puts "#{template.name}: ERROR - #{e.message}"
      end
    end

    puts ""
    puts "=" * 60
    puts "All unique fields found:"
    all_fields.sort.each { |f| puts "  #{f}" }
    puts ""
    puts "Total: #{all_fields.count} unique fields"
  end
end
