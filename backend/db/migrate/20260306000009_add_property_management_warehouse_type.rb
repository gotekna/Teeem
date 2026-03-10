class AddPropertyManagementWarehouseType < ActiveRecord::Migration[8.0]
  def up
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        next if WarehouseType.exists?(code: "property")

        # 1. Create WarehouseType
        wt = WarehouseType.create!(
          code: "property",
          display_name: "Property Management",
          icon_name: "Building2",
          is_system: false,
          enabled: true,
          order_position: 14,
          folder_path_template: "Properties/{{PropertyCode}}/{{PropertyName}}",
          source_types: ["property"]
        )

        # 2. Create root folder
        root = WarehouseFolder.create!(
          warehouse_type: wt,
          name: "Properties",
          display_name: "Properties",
          folder_segment: "Properties",
          tab_key: "properties",
          tab_type: "system",
          tab_group: "main",
          icon_name: "Building2",
          order_position: 1,
          enabled: true,
          is_system: true,
          warehouse_enabled: true
        )

        # 3. Create sub-folders matching property detail tabs
        folders = {}

        # Contracts & Leases
        folders[:contracts] = WarehouseFolder.create!(
          warehouse_type: wt, parent: root,
          name: "Contracts", display_name: "Contracts & Leases",
          folder_segment: "Contracts", tab_key: "contracts",
          tab_type: "document", tab_group: "documents",
          icon_name: "FileSignature", order_position: 1,
          enabled: true, is_system: true, warehouse_enabled: true
        )

        # Insurance
        folders[:insurance] = WarehouseFolder.create!(
          warehouse_type: wt, parent: root,
          name: "Insurance", display_name: "Insurance",
          folder_segment: "Insurance", tab_key: "insurance",
          tab_type: "document", tab_group: "documents",
          icon_name: "Shield", order_position: 2,
          enabled: true, is_system: true, warehouse_enabled: true
        )

        # Inspections
        folders[:inspections] = WarehouseFolder.create!(
          warehouse_type: wt, parent: root,
          name: "Inspections", display_name: "Inspections",
          folder_segment: "Inspections", tab_key: "inspections",
          tab_type: "document", tab_group: "documents",
          icon_name: "ClipboardCheck", order_position: 3,
          enabled: true, is_system: true, warehouse_enabled: true
        )

        # Maintenance
        folders[:maintenance] = WarehouseFolder.create!(
          warehouse_type: wt, parent: root,
          name: "Maintenance", display_name: "Maintenance",
          folder_segment: "Maintenance", tab_key: "maintenance",
          tab_type: "document", tab_group: "documents",
          icon_name: "Wrench", order_position: 4,
          enabled: true, is_system: true, warehouse_enabled: true
        )

        # Compliance (parent for SDA sub-folders)
        folders[:compliance] = WarehouseFolder.create!(
          warehouse_type: wt, parent: root,
          name: "Compliance", display_name: "Compliance",
          folder_segment: "Compliance", tab_key: "compliance",
          tab_type: "system", tab_group: "documents",
          icon_name: "ShieldCheck", order_position: 5,
          enabled: true, is_system: true, warehouse_enabled: true
        )

        # SDA Documents (under Compliance)
        folders[:sda] = WarehouseFolder.create!(
          warehouse_type: wt, parent: folders[:compliance],
          name: "SDA Documents", display_name: "SDA Documents",
          folder_segment: "SDA", tab_key: "sda-documents",
          tab_type: "document", tab_group: "documents",
          icon_name: "Heart", order_position: 1,
          enabled: true, is_system: true, warehouse_enabled: true
        )

        # Certificates (under Compliance)
        folders[:certificates] = WarehouseFolder.create!(
          warehouse_type: wt, parent: folders[:compliance],
          name: "Certificates", display_name: "Certificates",
          folder_segment: "Certificates", tab_key: "certificates",
          tab_type: "document", tab_group: "documents",
          icon_name: "Award", order_position: 2,
          enabled: true, is_system: true, warehouse_enabled: true
        )

        # Financial Documents
        folders[:financial] = WarehouseFolder.create!(
          warehouse_type: wt, parent: root,
          name: "Financial", display_name: "Financial",
          folder_segment: "Financial", tab_key: "financial",
          tab_type: "document", tab_group: "documents",
          icon_name: "DollarSign", order_position: 6,
          enabled: true, is_system: true, warehouse_enabled: true
        )

        # Photos
        folders[:photos] = WarehouseFolder.create!(
          warehouse_type: wt, parent: root,
          name: "Photos", display_name: "Photos",
          folder_segment: "Photos", tab_key: "photos",
          tab_type: "photo", tab_group: "documents",
          icon_name: "Camera", order_position: 7,
          enabled: true, is_system: true, warehouse_enabled: true
        )

        # 4. Create Document Types for Property Management
        doc_types = {
          "Lease Agreement" =>       { abbr: "LA", folder: :contracts, desc: "Residential or SDA lease agreement" },
          "Lease Renewal" =>         { abbr: "LR", folder: :contracts, desc: "Lease renewal documentation" },
          "Bond Receipt" =>          { abbr: "BR", folder: :contracts, desc: "Bond lodgement receipt" },
          "Tenant Application" =>    { abbr: "TA", folder: :contracts, desc: "Tenant application form" },
          "Insurance Certificate" => { abbr: "IC", folder: :insurance, desc: "Property insurance certificate of currency" },
          "Insurance Claim" =>       { abbr: "ICL", folder: :insurance, desc: "Insurance claim documentation" },
          "Entry Report" =>          { abbr: "ER", folder: :inspections, desc: "Entry condition report" },
          "Routine Inspection" =>    { abbr: "RI", folder: :inspections, desc: "Routine inspection report" },
          "Exit Report" =>           { abbr: "XR", folder: :inspections, desc: "Exit condition report" },
          "SDA Inspection" =>        { abbr: "SI", folder: :inspections, desc: "SDA compliance inspection report" },
          "Maintenance Request" =>   { abbr: "MR", folder: :maintenance, desc: "Maintenance request or work order" },
          "Maintenance Invoice" =>   { abbr: "MI", folder: :maintenance, desc: "Invoice from maintenance contractor" },
          "Maintenance Quote" =>     { abbr: "MQ", folder: :maintenance, desc: "Quote for maintenance work" },
          "SDA Enrolment" =>         { abbr: "SE", folder: :sda, desc: "NDIS SDA enrolment documentation" },
          "NDIS Plan" =>             { abbr: "NP", folder: :sda, desc: "Participant NDIS plan document" },
          "SDA Price Agreement" =>   { abbr: "SP", folder: :sda, desc: "SDA price agreement with NDIA" },
          "Compliance Certificate" => { abbr: "CC", folder: :certificates, desc: "Building or safety compliance certificate" },
          "Fire Safety Certificate" => { abbr: "FS", folder: :certificates, desc: "Fire safety certificate" },
          "Rent Statement" =>        { abbr: "RS", folder: :financial, desc: "Tenant rent statement" },
          "Owner Statement" =>       { abbr: "OS", folder: :financial, desc: "Owner financial statement" },
          "Property Invoice" =>      { abbr: "PI", folder: :financial, desc: "Invoice related to property" },
        }

        doc_types.each do |name, config|
          dt = DocumentType.find_or_create_by!(name: name, scope: "property") do |d|
            d.abbreviation = config[:abbr]
            d.description = config[:desc]
            d.warehouse_type = wt
            d.active = true
          end

          WarehouseFolderDocumentType.find_or_create_by!(
            warehouse_folder: folders[config[:folder]],
            document_type: dt
          ) do |wfdt|
            wfdt.is_primary = true
            wfdt.is_system = true
          end
        end

        puts "  Created Property Management warehouse type for tenant #{tenant.name} (#{tenant.id})"
      end
    end
  end

  def down
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        wt = WarehouseType.find_by(code: "property")
        next unless wt

        # Remove document type links
        folder_ids = WarehouseFolder.where(warehouse_type: wt).pluck(:id)
        WarehouseFolderDocumentType.where(warehouse_folder_id: folder_ids).destroy_all

        # Remove document types
        DocumentType.where(scope: "property").destroy_all

        # Remove folders
        WarehouseFolder.where(warehouse_type: wt).destroy_all

        # Remove warehouse type
        wt.destroy
      end
    end
  end
end
