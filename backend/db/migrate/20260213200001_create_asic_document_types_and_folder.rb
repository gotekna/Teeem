# frozen_string_literal: true

# Create ASIC document types and warehouse folder for Director Changes workflow.
#
# Creates:
# - 4 DocumentType records (Form 484 Record, Consent to Act, Director Resignation, Directors Minutes)
# - "ASIC Forms" WarehouseFolder under the "corporate" warehouse type
# - WarehouseFolderDocumentType links (is_primary: true)
# - 4 DocumentTemplate records for the existing ERB templates
#
class CreateAsicDocumentTypesAndFolder < ActiveRecord::Migration[8.0]
  def up
    corporate_wt = WarehouseType.find_by(code: "corporate")
    unless corporate_wt
      puts "⚠️  No 'corporate' warehouse type found - skipping ASIC folder setup"
      create_document_types_only
      return
    end

    # Set tenant context for acts_as_tenant models
    tenant = Tenant.first
    ActsAsTenant.with_tenant(tenant) do
      run_with_tenant(corporate_wt)
    end
  end

  def run_with_tenant(corporate_wt)
    # Find or create "ASIC Forms" folder under corporate warehouse type
    asic_folder = WarehouseFolder.find_or_create_by!(
      warehouse_type: corporate_wt,
      name: "ASIC Forms",
      parent_id: nil
    ) do |wf|
      wf.folder_segment = "ASIC Forms"
      wf.tab_type = "document"
      wf.tab_group = "documents"
      wf.tab_key = "asic-forms"
      wf.warehouse_enabled = true
      wf.is_system = false
      wf.enabled = true
      wf.order_position = 90
      wf.description = "ASIC director change forms (Form 484, Consent to Act, Resignation, Minutes)"
    end

    # Create the 4 document types
    doc_types = create_document_types(corporate_wt)

    # Link document types to the ASIC Forms folder
    doc_types.each do |dt|
      WarehouseFolderDocumentType.find_or_create_by!(
        warehouse_folder: asic_folder,
        document_type: dt
      ) do |wfdt|
        wfdt.is_primary = true
      end
    end

    # Create document templates for the existing ERB files
    create_document_templates

    puts "✅ Created ASIC document types, folder, and templates:"
    doc_types.each { |dt| puts "  - #{dt.abbreviation}: #{dt.name}" }
    puts "  - Folder: #{asic_folder.name} (#{corporate_wt.display_name})"
  end

  def down
    # Remove templates
    DocumentTemplate.where(
      local_template_path: [
        "tekna_documents/templates/asic/form_484_record",
        "tekna_documents/templates/asic/consent_to_act",
        "tekna_documents/templates/asic/director_resignation",
        "tekna_documents/templates/asic/directors_minutes"
      ]
    ).destroy_all

    # Remove folder-doc type links
    abbreviations = %w[484 CTA DR DM]
    doc_types = DocumentType.where(abbreviation: abbreviations)
    WarehouseFolderDocumentType.where(document_type: doc_types).destroy_all

    # Remove the folder
    corporate_wt = WarehouseType.find_by(code: "corporate")
    if corporate_wt
      WarehouseFolder.where(warehouse_type: corporate_wt, name: "ASIC Forms").destroy_all
    end

    # Remove document types
    doc_types.destroy_all

    puts "❌ Removed ASIC document types, folder, and templates"
  end

  private

  def create_document_types(warehouse_type)
    types = [
      {
        name: "Form 484 Record",
        abbreviation: "484",
        ui_name: "Form 484 Record",
        description: "ASIC Form 484 - Change to company details (internal record copy)",
        scope: "company",
        active: true,
        warehouse_type: warehouse_type
      },
      {
        name: "Consent to Act",
        abbreviation: "CTA",
        ui_name: "Consent to Act as Director",
        description: "Consent form for newly appointed directors",
        scope: "company",
        active: true,
        warehouse_type: warehouse_type
      },
      {
        name: "Director Resignation",
        abbreviation: "DR",
        ui_name: "Director Resignation Letter",
        description: "Formal resignation letter for ceasing directors",
        scope: "company",
        active: true,
        warehouse_type: warehouse_type
      },
      {
        name: "Directors Minutes",
        abbreviation: "DM",
        ui_name: "Minutes of Meeting of Directors",
        description: "Board resolution minutes for director changes",
        scope: "company",
        active: true,
        warehouse_type: warehouse_type
      }
    ]

    types.map do |attrs|
      DocumentType.find_or_create_by!(abbreviation: attrs[:abbreviation]) do |dt|
        dt.assign_attributes(attrs)
      end
    end
  end

  def create_document_types_only
    # Fallback: create doc types without warehouse linking
    [
      { name: "Form 484 Record", abbreviation: "484", scope: "company", active: true },
      { name: "Consent to Act", abbreviation: "CTA", scope: "company", active: true },
      { name: "Director Resignation", abbreviation: "DR", scope: "company", active: true },
      { name: "Directors Minutes", abbreviation: "DM", scope: "company", active: true }
    ].each do |attrs|
      DocumentType.find_or_create_by!(abbreviation: attrs[:abbreviation]) do |dt|
        dt.assign_attributes(attrs)
      end
    end
    puts "✅ Created ASIC document types (no warehouse folder - corporate warehouse type not found)"
  end

  def create_document_templates
    templates = [
      {
        name: "Form 484 Record",
        local_template_path: "tekna_documents/templates/asic/form_484_record",
        category: "letter",
        template_type: "html",
        output_format: "pdf",
        is_active: true,
        description: "ASIC Form 484 - Change to company details template"
      },
      {
        name: "Consent to Act as Director",
        local_template_path: "tekna_documents/templates/asic/consent_to_act",
        category: "letter",
        template_type: "html",
        output_format: "pdf",
        is_active: true,
        description: "Consent form template for newly appointed directors"
      },
      {
        name: "Director Resignation Letter",
        local_template_path: "tekna_documents/templates/asic/director_resignation",
        category: "letter",
        template_type: "html",
        output_format: "pdf",
        is_active: true,
        description: "Formal resignation letter template for ceasing directors"
      },
      {
        name: "Directors Minutes",
        local_template_path: "tekna_documents/templates/asic/directors_minutes",
        category: "letter",
        template_type: "html",
        output_format: "pdf",
        is_active: true,
        description: "Board resolution minutes template for director changes"
      }
    ]

    templates.each do |attrs|
      DocumentTemplate.find_or_create_by!(local_template_path: attrs[:local_template_path]) do |dt|
        dt.assign_attributes(attrs)
      end
    end
  end
end
