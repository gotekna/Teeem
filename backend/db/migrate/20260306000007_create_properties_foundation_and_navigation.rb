# frozen_string_literal: true

# Creates Foundation for Properties and adds navigation item to sidebar.
#
# Enables:
# 1. TeeemTableView for property list page
# 2. Foundation API for all property queries
# 3. Sidebar navigation to /properties
# 4. Default property types and statuses per tenant

class CreatePropertiesFoundationAndNavigation < ActiveRecord::Migration[8.0]
  def up
    # ═══════════════════════════════════════════════════════════════════════════
    # 1. Create Foundation for Properties
    # ═══════════════════════════════════════════════════════════════════════════
    foundation = Foundation.find_or_create_by!(slug: "properties") do |f|
      f.name = "Property Management"
      f.singular_name = "Property"
      f.plural_name = "Property Management"
      f.database_table_name = "properties"
      f.table_type = "system"
      f.model_class = "Property"
      f.icon = "Building2"
      f.feature = "PropertyManagement"
      f.searchable = true
      f.is_live = true
      f.has_ui = true
      f.has_saved_views = true
    end

    foundation.update!(model_class: "Property") if foundation.model_class.blank?

    puts "  Created Foundation: #{foundation.name} (ID: #{foundation.id})"

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. Sync columns from database schema
    # ═══════════════════════════════════════════════════════════════════════════
    columns_config = [
      { column_name: "id",                       position: 1,  column_type: "whole_number",        has_ui: false, searchable: false },
      { column_name: "tenant_id",                position: 2,  column_type: "whole_number",        has_ui: false, searchable: false },
      { column_name: "property_code",            position: 3,  column_type: "single_line_text",    has_ui: true,  searchable: true,  name: "Code", is_title: true },
      { column_name: "name",                     position: 4,  column_type: "single_line_text",    has_ui: true,  searchable: true,  name: "Name" },
      { column_name: "street_address",           position: 5,  column_type: "single_line_text",    has_ui: true,  searchable: true,  name: "Street Address" },
      { column_name: "suburb",                   position: 6,  column_type: "single_line_text",    has_ui: true,  searchable: true,  name: "Suburb" },
      { column_name: "state",                    position: 7,  column_type: "single_line_text",    has_ui: true,  searchable: false, name: "State" },
      { column_name: "postcode",                 position: 8,  column_type: "single_line_text",    has_ui: true,  searchable: false, name: "Postcode" },
      { column_name: "property_type_id",         position: 9,  column_type: "lookup",              has_ui: true,  searchable: false, name: "Type" },
      { column_name: "property_status_id",       position: 10, column_type: "lookup",              has_ui: true,  searchable: false, name: "Status" },
      { column_name: "bedrooms",                 position: 11, column_type: "whole_number",        has_ui: true,  searchable: false, name: "Bedrooms" },
      { column_name: "bathrooms",                position: 12, column_type: "whole_number",        has_ui: true,  searchable: false, name: "Bathrooms" },
      { column_name: "parking_spaces",           position: 13, column_type: "whole_number",        has_ui: true,  searchable: false, name: "Parking" },
      { column_name: "land_area_sqm",            position: 14, column_type: "number",      has_ui: true,  searchable: false, name: "Land Area (sqm)" },
      { column_name: "floor_area_sqm",           position: 15, column_type: "number",      has_ui: true,  searchable: false, name: "Floor Area (sqm)" },
      { column_name: "year_built",               position: 16, column_type: "whole_number",        has_ui: true,  searchable: false, name: "Year Built" },
      { column_name: "description",              position: 17, column_type: "multiple_lines_text", has_ui: true,  searchable: true,  name: "Description" },
      { column_name: "sda_category",             position: 18, column_type: "single_line_text",    has_ui: true,  searchable: false, name: "SDA Category" },
      { column_name: "sda_enrolled",             position: 19, column_type: "boolean",             has_ui: true,  searchable: false, name: "SDA Enrolled" },
      { column_name: "sda_enrolment_date",       position: 20, column_type: "date",                has_ui: true,  searchable: false, name: "SDA Enrolment Date" },
      { column_name: "sda_dwelling_id",          position: 21, column_type: "single_line_text",    has_ui: true,  searchable: false, name: "SDA Dwelling ID" },
      { column_name: "weekly_rent_amount",       position: 22, column_type: "currency",            has_ui: true,  searchable: false, name: "Weekly Rent" },
      { column_name: "bond_amount",              position: 23, column_type: "currency",            has_ui: true,  searchable: false, name: "Bond Amount" },
      { column_name: "owner_contact_id",         position: 24, column_type: "lookup",              has_ui: true,  searchable: false, name: "Owner" },
      { column_name: "managing_agent_contact_id", position: 25, column_type: "lookup",             has_ui: true,  searchable: false, name: "Managing Agent" },
      { column_name: "created_at",               position: 26, column_type: "date_and_time",       has_ui: false, searchable: false, name: "Created At" },
      { column_name: "updated_at",               position: 27, column_type: "date_and_time",       has_ui: false, searchable: false, name: "Updated At" },
    ]

    # Create lookup foundations for PropertyType and PropertyStatus
    type_foundation = Foundation.find_or_create_by!(slug: "property_types") do |f|
      f.name = "Property Types"
      f.singular_name = "Property Type"
      f.plural_name = "Property Types"
      f.database_table_name = "property_types"
      f.table_type = "system"
      f.model_class = "PropertyType"
      f.icon = "Home"
      f.feature = "PropertyManagement"
      f.searchable = false
      f.is_live = true
      f.has_ui = true
    end

    status_foundation = Foundation.find_or_create_by!(slug: "property_statuses") do |f|
      f.name = "Property Statuses"
      f.singular_name = "Property Status"
      f.plural_name = "Property Statuses"
      f.database_table_name = "property_statuses"
      f.table_type = "system"
      f.model_class = "PropertyStatus"
      f.icon = "CircleDot"
      f.feature = "PropertyManagement"
      f.searchable = false
      f.is_live = true
      f.has_ui = true
    end

    # Seed columns for type and status foundations
    [
      { foundation: type_foundation, columns: [
        { column_name: "id",        position: 1, column_type: "whole_number",     has_ui: false, searchable: false },
        { column_name: "tenant_id", position: 2, column_type: "whole_number",     has_ui: false, searchable: false },
        { column_name: "name",      position: 3, column_type: "single_line_text", has_ui: true,  searchable: true, name: "Name", is_title: true },
        { column_name: "description", position: 4, column_type: "single_line_text", has_ui: true, searchable: false, name: "Description" },
        { column_name: "position",  position: 5, column_type: "whole_number",     has_ui: true,  searchable: false, name: "Position" },
        { column_name: "is_active", position: 6, column_type: "boolean",          has_ui: true,  searchable: false, name: "Active" },
      ]},
      { foundation: status_foundation, columns: [
        { column_name: "id",        position: 1, column_type: "whole_number",     has_ui: false, searchable: false },
        { column_name: "tenant_id", position: 2, column_type: "whole_number",     has_ui: false, searchable: false },
        { column_name: "name",      position: 3, column_type: "single_line_text", has_ui: true,  searchable: true, name: "Name", is_title: true },
        { column_name: "color",     position: 4, column_type: "single_line_text", has_ui: true,  searchable: false, name: "Color" },
        { column_name: "position",  position: 5, column_type: "whole_number",     has_ui: true,  searchable: false, name: "Position" },
        { column_name: "is_active", position: 6, column_type: "boolean",          has_ui: true,  searchable: false, name: "Active" },
      ]},
    ].each do |entry|
      entry[:columns].each do |config|
        Column.find_or_create_by!(foundation_id: entry[:foundation].id, column_name: config[:column_name]) do |col|
          col.name = config[:name] || config[:column_name].titleize
          col.column_type = config[:column_type]
          col.position = config[:position]
          col.searchable = config[:searchable]
          col.has_ui = config[:has_ui]
          col.is_title = config[:is_title] || false
          col.required = false
        end
      end
    end

    # Now create main properties columns with lookup references
    columns_config.each do |config|
      col_attrs = {
        name: config[:name] || config[:column_name].titleize,
        column_type: config[:column_type],
        position: config[:position],
        searchable: config[:searchable],
        has_ui: config[:has_ui],
        is_title: config[:is_title] || false,
        required: false,
      }

      # Wire up lookup columns
      if config[:column_name] == "property_type_id"
        col_attrs[:lookup_foundation_id] = type_foundation.id
        col_attrs[:lookup_display_column] = "name"
      elsif config[:column_name] == "property_status_id"
        col_attrs[:lookup_foundation_id] = status_foundation.id
        col_attrs[:lookup_display_column] = "name"
      elsif config[:column_name] == "owner_contact_id"
        contacts_foundation = Foundation.find_by(slug: "contacts")
        if contacts_foundation
          col_attrs[:lookup_foundation_id] = contacts_foundation.id
          col_attrs[:lookup_display_column] = "display_name"
        end
      elsif config[:column_name] == "managing_agent_contact_id"
        contacts_foundation = Foundation.find_by(slug: "contacts")
        if contacts_foundation
          col_attrs[:lookup_foundation_id] = contacts_foundation.id
          col_attrs[:lookup_display_column] = "display_name"
        end
      end

      Column.find_or_create_by!(foundation_id: foundation.id, column_name: config[:column_name]) do |col|
        col.assign_attributes(col_attrs)
      end
    end

    puts "  Synced #{columns_config.size} columns for Properties"

    # ═══════════════════════════════════════════════════════════════════════════
    # 3. Add navigation item
    # ═══════════════════════════════════════════════════════════════════════════
    if defined?(NavigationItem)
      NavigationItem.find_or_create_by!(href: "/properties") do |item|
        item.name = "Property Management"
        item.icon = "Building2"
        item.position = 11
        item.is_active = true
        item.visible_to_roles = []  # All roles
      end
      puts "  Added Properties navigation item"
    end

    # ═══════════════════════════════════════════════════════════════════════════
    # 4. Seed default property types and statuses per tenant
    # ═══════════════════════════════════════════════════════════════════════════
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        # Property types
        [
          { name: "House",         position: 1 },
          { name: "Unit",          position: 2 },
          { name: "Townhouse",     position: 3 },
          { name: "Apartment",     position: 4 },
          { name: "SDA Dwelling",  position: 5 },
          { name: "Duplex",        position: 6 },
          { name: "Villa",         position: 7 },
          { name: "Commercial",    position: 8 },
        ].each do |attrs|
          PropertyType.find_or_create_by!(name: attrs[:name]) do |pt|
            pt.assign_attributes(attrs.merge(is_active: true))
          end
        end

        # Property statuses
        [
          { name: "Vacant",           color: "#ef4444", position: 1 },
          { name: "Occupied",         color: "#22c55e", position: 2 },
          { name: "Under Maintenance", color: "#f59e0b", position: 3 },
          { name: "Listed",           color: "#3b82f6", position: 4 },
          { name: "Under Offer",      color: "#8b5cf6", position: 5 },
          { name: "Sold",             color: "#6b7280", position: 6 },
        ].each do |attrs|
          PropertyStatus.find_or_create_by!(name: attrs[:name]) do |ps|
            ps.assign_attributes(attrs.merge(is_active: true))
          end
        end
      end
    end

    puts "  Seeded default property types and statuses"
  end

  def down
    # Remove navigation
    NavigationItem.find_by(href: "/properties")&.destroy if defined?(NavigationItem)

    # Remove seeded data
    PropertyType.destroy_all
    PropertyStatus.destroy_all

    # Remove Foundation columns then Foundations
    ["properties", "property_types", "property_statuses"].each do |slug|
      foundation = Foundation.find_by(slug: slug)
      if foundation
        foundation.columns.destroy_all
        foundation.destroy
      end
    end
  end
end
