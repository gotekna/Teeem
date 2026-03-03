# frozen_string_literal: true

namespace :data_fix do
  desc "Fix remaining system tabs with document types"
  task separate_system_doc_tabs: :environment do
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        puts "=== Processing #{tenant.name} ==="

        # Find ALL system tabs that have doc types (the actual offenders)
        offenders = WarehouseFolder.where(tab_type: "system")
                                   .joins(:warehouse_folder_document_types)
                                   .distinct
                                   .to_a

        next if offenders.empty?

        offenders.each do |folder|
          dt_count = folder.warehouse_folder_document_types.count
          puts "  Offender: #{folder.tab_key} (id=#{folder.id}) doc_types=#{dt_count}"

          # Determine the target doc tab key
          doc_tab_key = case folder.tab_key
                        when "expenses" then "expense-docs"
                        when "templates" then "template-docs"
                        else "#{folder.tab_key}-docs"
                        end

          # Find the existing doc tab (by key AND document type)
          doc_tab = WarehouseFolder.find_by(tab_key: doc_tab_key, tab_type: "document")

          if doc_tab
            puts "  Target exists: #{doc_tab_key} (id=#{doc_tab.id})"
          else
            # Create doc child under the offending parent
            doc_tab = WarehouseFolder.create!(
              name: "#{folder.display_name || folder.name} Docs",
              display_name: "#{folder.display_name || folder.name} Docs",
              folder_segment: doc_tab_key,
              tab_key: doc_tab_key,
              tab_type: "document",
              tab_group: "documents",
              warehouse_type_id: folder.warehouse_type_id,
              parent_id: folder.children.exists? ? folder.id : folder.parent_id,
              is_system: false,
              enabled: true,
              order_position: folder.order_position + 1,
              folder_path_suffix: folder.folder_path_suffix
            )
            puts "  Created: #{doc_tab_key} (id=#{doc_tab.id})"
          end

          # Move doc types from offender to doc tab
          folder.warehouse_folder_document_types.update_all(warehouse_folder_id: doc_tab.id)
          puts "  Moved #{dt_count} doc types -> #{doc_tab_key}"
        end
      end
    end

    puts "\n--- Verification ---"
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        offenders = WarehouseFolder.where(tab_type: "system")
                                   .joins(:warehouse_folder_document_types)
                                   .distinct
        if offenders.any?
          offenders.each do |f|
            puts "STILL OFFENDING: #{tenant.name}|#{f.tab_key}|doc_types=#{f.warehouse_folder_document_types.count}"
          end
        else
          puts "#{tenant.name}: CLEAN"
        end
      end
    end
  end
end
