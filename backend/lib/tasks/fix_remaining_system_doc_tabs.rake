# frozen_string_literal: true

namespace :data_fix do
  desc "Fix remaining system tabs with document types"
  task separate_system_doc_tabs: :environment do
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        puts "=== Processing #{tenant.name} (id=#{tenant.id}) ==="

        # Debug: show all system tabs with doc types
        WarehouseFolder.where(tab_type: "system").each do |f|
          dt_count = f.warehouse_folder_document_types.count
          next if dt_count == 0
          puts "  FOUND: #{f.tab_key} (id=#{f.id}) tab_type=#{f.tab_type} doc_types=#{dt_count}"
        end

        # Fix 1: Expenses
        expenses = WarehouseFolder.find_by(tab_key: "expenses")
        expense_docs = WarehouseFolder.find_by(tab_key: "expense-docs")
        puts "  expenses=#{expenses&.id} expense_docs=#{expense_docs&.id}"
        if expenses
          puts "  expenses.tab_type=#{expenses.tab_type} expenses.doc_types=#{expenses.warehouse_folder_document_types.count}"
        end

        if expenses && expense_docs && expenses.warehouse_folder_document_types.any?
          count = expenses.warehouse_folder_document_types.count
          expenses.warehouse_folder_document_types.update_all(warehouse_folder_id: expense_docs.id)
          expenses.reload
          expenses.save!
          puts "  FIXED: Moved #{count} doc types from expenses -> expense-docs"
        end

        # Fix 2: Templates
        templates = WarehouseFolder.find_by(tab_key: "templates")
        puts "  templates=#{templates&.id}"
        if templates
          puts "  templates.tab_type=#{templates.tab_type} templates.doc_types=#{templates.warehouse_folder_document_types.count}"
        end
        next unless templates
        next unless templates.warehouse_folder_document_types.any?

        template_docs = WarehouseFolder.find_by(tab_key: "template-docs")
        puts "  template_docs=#{template_docs&.id}"
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
          puts "  CREATED: template-docs (id=#{template_docs.id})"
        end

        count = templates.warehouse_folder_document_types.count
        templates.warehouse_folder_document_types.update_all(warehouse_folder_id: template_docs.id)
        puts "  FIXED: Moved #{count} doc types from templates -> template-docs"
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
