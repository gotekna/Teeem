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
    puts "1. Upload Word templates to SharePoint: gotekna.sharepoint.com/sites/TEEEM/Shared Documents/Templates/"
    puts "2. Link each template via the TEEEM UI or API"
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
end
