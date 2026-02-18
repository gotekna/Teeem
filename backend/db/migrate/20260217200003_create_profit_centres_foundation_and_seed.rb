# frozen_string_literal: true

# Migration: Create Foundation for ProfitCentre + seed default templates
#
# 1. Creates Foundation record so TeeemTableView can display profit centres
# 2. Syncs columns from DB schema with appropriate types and visibility
# 3. Seeds default global templates (Design, Base Contract)
#
class CreateProfitCentresFoundationAndSeed < ActiveRecord::Migration[8.0]
  def up
    # ═══════════════════════════════════════════════════════════════════════════
    # 1. Create Foundation for ProfitCentre
    # ═══════════════════════════════════════════════════════════════════════════
    foundation = Foundation.find_or_create_by!(slug: "profit_centres") do |f|
      f.name = "Profit Centres"
      f.singular_name = "Profit Centre"
      f.plural_name = "Profit Centres"
      f.database_table_name = "profit_centres"
      f.table_type = "system"
      f.model_class = "ProfitCentre"
      f.icon = "PieChart"
      f.feature = "Finance"
      f.searchable = true
      f.is_live = true
      f.has_ui = true
      f.has_saved_views = true
      f.allow_reserved_name = true
    end

    foundation.update!(model_class: "ProfitCentre") if foundation.model_class.blank?

    puts "  Created Foundation: #{foundation.name} (ID: #{foundation.id})"

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. Sync columns from database schema
    # ═══════════════════════════════════════════════════════════════════════════
    columns_config = [
      { column_name: "id",            position: 1,  column_type: "whole_number",       visible: false, searchable: false },
      { column_name: "tenant_id",     position: 2,  column_type: "whole_number",       visible: false, searchable: false },
      { column_name: "job_id",        position: 3,  column_type: "lookup",             visible: true,  searchable: false, name: "Job" },
      { column_name: "code",          position: 4,  column_type: "single_line_text",   visible: true,  searchable: true,  name: "Code", is_title: true },
      { column_name: "name",          position: 5,  column_type: "single_line_text",   visible: true,  searchable: true,  name: "Name" },
      { column_name: "centre_type",   position: 6,  column_type: "single_line_text",   visible: true,  searchable: false, name: "Type" },
      { column_name: "description",   position: 7,  column_type: "multiple_lines_text", visible: true, searchable: true,  name: "Description" },
      { column_name: "is_template",   position: 8,  column_type: "boolean",            visible: true,  searchable: false, name: "Template" },
      { column_name: "active",        position: 9,  column_type: "boolean",            visible: true,  searchable: false, name: "Active" },
      { column_name: "sort_order",    position: 10, column_type: "whole_number",       visible: false, searchable: false, name: "Sort Order" },
      { column_name: "budget_amount", position: 11, column_type: "currency",           visible: true,  searchable: false, name: "Budget" },
      { column_name: "created_at",    position: 12, column_type: "date_and_time",      visible: false, searchable: false, name: "Created At" },
      { column_name: "updated_at",    position: 13, column_type: "date_and_time",      visible: false, searchable: false, name: "Updated At" },
    ]

    columns_config.each do |config|
      Column.find_or_create_by!(foundation_id: foundation.id, column_name: config[:column_name]) do |col|
        col.name = config[:name] || config[:column_name].titleize
        col.column_type = config[:column_type]
        col.position = config[:position]
        col.searchable = config[:searchable]
        col.is_title = config[:is_title] || false
        col.required = false
      end
    end

    puts "  Synced #{columns_config.size} columns"

    # ═══════════════════════════════════════════════════════════════════════════
    # 3. Seed default global templates (per tenant)
    # ═══════════════════════════════════════════════════════════════════════════
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        [
          { code: "DESIGN", name: "Design", centre_type: "design", sort_order: 1, description: "Design phase revenue and costs" },
          { code: "BASE", name: "Base Contract", centre_type: "base", sort_order: 2, description: "Base contract revenue and costs" },
        ].each do |attrs|
          ProfitCentre.find_or_create_by!(code: attrs[:code], job_id: nil) do |pc|
            pc.assign_attributes(attrs.merge(is_template: true, active: true))
          end
        end
      end
    end

    puts "  Seeded default profit centre templates"
  end

  def down
    # Remove seeded profit centres
    ProfitCentre.where(is_template: true, job_id: nil, code: %w[DESIGN BASE]).destroy_all

    # Remove Foundation columns then Foundation
    foundation = Foundation.find_by(slug: "profit_centres")
    if foundation
      foundation.columns.destroy_all
      foundation.destroy
    end
  end
end
