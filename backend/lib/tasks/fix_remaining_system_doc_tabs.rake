# frozen_string_literal: true

namespace :data_fix do
  desc "Fix remaining system tabs with document types (Tekna templates, Pilgrim expenses + templates)"
  task separate_system_doc_tabs: :environment do
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        # Fix 1: Expenses - leaf tab, expense-docs should exist, just move doc types
        expenses = WarehouseFolder.find_by(tab_key: "expenses")
        expense_docs = WarehouseFolder.find_by(tab_key: "expense-docs")
        if expenses && expense_docs && expenses.warehouse_folder_document_types.any?
          count = expenses.warehouse_folder_document_types.count
          expenses.warehouse_folder_document_types.update_all(warehouse_folder_id: expense_docs.id)
          # Re-save to trigger enforce_leaf_document_type callback
          expenses.save!
          puts "#{tenant.name}: Moved #{count} doc types from expenses → expense-docs"
        end

        # Fix 2: Templates - parent tab, may need template-docs child created
        templates = WarehouseFolder.find_by(tab_key: "templates")
        next unless templates
        next unless templates.warehouse_folder_document_types.any?

        template_docs = WarehouseFolder.find_by(tab_key: "template-docs")
        unless template_docs
          template_docs = WarehouseFolder.create!(
            name: "Template Docs",
            display_name: "Template Docs",
            folder_segment: "template-docs",
            tab_key: "template-docs",
            tab_type: "document",
            tab_group: "documents",
            warehouse_type_id: templates.warehouse_type_id,
            parent_id: templates.id,
            is_system: false,
            enabled: true,
            order_position: (templates.children.maximum(:order_position) || 0) + 1,
            folder_path_suffix: templates.folder_path_suffix
          )
          puts "#{tenant.name}: Created template-docs child under templates"
        end

        count = templates.warehouse_folder_document_types.count
        templates.warehouse_folder_document_types.update_all(warehouse_folder_id: template_docs.id)
        puts "#{tenant.name}: Moved #{count} doc types from templates → template-docs"
      end
    end

    # Verify
    puts "\n--- Verification ---"
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        offenders = WarehouseFolder.where(tab_type: "system")
                                   .joins(:warehouse_folder_document_types)
                                   .distinct
        if offenders.any?
          offenders.each do |f|
            puts "STILL OFFENDING: #{tenant.name}|#{f.tab_key}|#{f.name}|doc_types=#{f.warehouse_folder_document_types.count}"
          end
        else
          puts "#{tenant.name}: CLEAN"
        end
      end
    end
  end
end
