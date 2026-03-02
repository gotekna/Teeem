# frozen_string_literal: true

# Create Foundation for Tender sections + add tender_id lookup to SM Schedule Masters.
#
# Enables:
# 1. TeeemTableView for managing tender sections in Settings > Operations
# 2. SM Schedule Master "Tender Section" lookup column for assigning tasks to tender sections
# 3. PO inherits tender section via SmTask → SmScheduleMaster.tender_id chain
#
class CreateTendersFoundation < ActiveRecord::Migration[8.0]
  def up
    # ═══════════════════════════════════════════════════════════════════════════
    # 1. Create Foundation for Tender
    # ═══════════════════════════════════════════════════════════════════════════
    foundation = Foundation.find_or_create_by!(slug: "tenders") do |f|
      f.name = "Tender Sections"
      f.singular_name = "Tender Section"
      f.plural_name = "Tender Sections"
      f.database_table_name = "tenders"
      f.table_type = "system"
      f.model_class = "Tender"
      f.icon = "FileSignature"
      f.feature = "Jobs"
      f.searchable = true
      f.is_live = true
      f.has_ui = true
      f.has_saved_views = true
      f.allow_reserved_name = true
    end

    foundation.update!(model_class: "Tender") if foundation.model_class.blank?

    puts "  Created Foundation: #{foundation.name} (ID: #{foundation.id})"

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. Sync columns from database schema
    # ═══════════════════════════════════════════════════════════════════════════
    columns_config = [
      { column_name: "id",              position: 1,  column_type: "whole_number",        has_ui: false, searchable: false },
      { column_name: "tenant_id",       position: 2,  column_type: "whole_number",        has_ui: false, searchable: false },
      { column_name: "code",            position: 3,  column_type: "single_line_text",    has_ui: true,  searchable: true,  name: "Code", is_title: true },
      { column_name: "name",            position: 4,  column_type: "single_line_text",    has_ui: true,  searchable: true,  name: "Name" },
      { column_name: "description",     position: 5,  column_type: "multiple_lines_text", has_ui: true,  searchable: true,  name: "Description" },
      { column_name: "section_type",    position: 6,  column_type: "single_line_text",    has_ui: true,  searchable: false, name: "Section Type" },
      { column_name: "sort_order",      position: 7,  column_type: "whole_number",        has_ui: true,  searchable: false, name: "Sort Order" },
      { column_name: "show_line_items", position: 8,  column_type: "boolean",             has_ui: true,  searchable: false, name: "Show Line Items" },
      { column_name: "section_notes",   position: 9,  column_type: "multiple_lines_text", has_ui: true,  searchable: false, name: "Section Notes" },
      { column_name: "active",          position: 10, column_type: "boolean",             has_ui: true,  searchable: false, name: "Active" },
      { column_name: "created_at",      position: 11, column_type: "date_and_time",       has_ui: false, searchable: false, name: "Created At" },
      { column_name: "updated_at",      position: 12, column_type: "date_and_time",       has_ui: false, searchable: false, name: "Updated At" },
    ]

    columns_config.each do |config|
      Column.find_or_create_by!(foundation_id: foundation.id, column_name: config[:column_name]) do |col|
        col.name = config[:name] || config[:column_name].titleize
        col.column_type = config[:column_type]
        col.position = config[:position]
        col.searchable = config[:searchable]
        col.has_ui = config[:has_ui]
        col.is_title = config[:is_title] || false
        col.required = false
      end
    end

    puts "  Synced #{columns_config.size} columns"

    # ═══════════════════════════════════════════════════════════════════════════
    # 3. Add tender_id column to sm_schedule_masters
    # ═══════════════════════════════════════════════════════════════════════════
    add_column :sm_schedule_masters, :tender_id, :integer, if_not_exists: true
    add_index :sm_schedule_masters, :tender_id, if_not_exists: true

    # Add "Tender Section" lookup column to SM Schedule Master Foundation
    sm_foundation = Foundation.find_by(slug: "sm-schedule-master")
    if sm_foundation
      last_position = sm_foundation.columns.maximum(:position) || 0

      Column.find_or_create_by!(foundation_id: sm_foundation.id, column_name: "tender_id") do |col|
        col.name = "Tender Section"
        col.column_type = "lookup"
        col.lookup_foundation_id = foundation.id
        col.lookup_display_column = "name"
        col.position = last_position + 1
        col.has_ui = true
        col.searchable = false
        col.required = false
      end

      puts "  Added 'Tender Section' lookup column to SM Schedule Master"
    end

    # ═══════════════════════════════════════════════════════════════════════════
    # 4. Seed default tender sections per tenant
    # ═══════════════════════════════════════════════════════════════════════════
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        [
          { code: "TS-001", name: "Base Price & Essential Inclusions", section_type: "priced", sort_order: 1, description: "Standard inclusions and base contract items" },
          { code: "TS-002", name: "Site Costs", section_type: "priced", sort_order: 2, description: "Site preparation, earthworks, and access" },
          { code: "TS-003", name: "Authority Conditions", section_type: "priced", sort_order: 3, description: "Council and authority requirements" },
          { code: "TS-004", name: "Plan Changes", section_type: "priced", sort_order: 4, description: "Variations to base plan" },
          { code: "TS-005", name: "Provisional Sums", section_type: "provisional", sort_order: 5, description: "Estimated costs subject to actual amounts" },
          { code: "TS-006", name: "Selections & Upgrades", section_type: "priced", sort_order: 6, description: "Client selections and upgrade options" },
          { code: "TS-007", name: "Notes & Conditions", section_type: "note", sort_order: 7, description: "General notes and conditions" },
        ].each do |attrs|
          Tender.find_or_create_by!(code: attrs[:code]) do |t|
            t.assign_attributes(attrs.merge(active: true, show_line_items: true))
          end
        end
      end
    end

    puts "  Seeded default tender sections"
  end

  def down
    # Remove SM Schedule Master lookup column
    sm_foundation = Foundation.find_by(slug: "sm-schedule-master")
    sm_foundation&.columns&.find_by(column_name: "tender_id")&.destroy

    # Remove tender_id from sm_schedule_masters
    remove_column :sm_schedule_masters, :tender_id, if_exists: true

    # Remove seeded data
    Tender.destroy_all

    # Remove Foundation columns then Foundation
    foundation = Foundation.find_by(slug: "tenders")
    if foundation
      foundation.columns.destroy_all
      foundation.destroy
    end
  end
end
