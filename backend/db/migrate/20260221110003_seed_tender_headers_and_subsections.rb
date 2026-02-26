# frozen_string_literal: true

# Seed tender headers (TH-001 to TH-005) following Rawson Homes structure.
# Reclassify existing sections (TS-001 to TS-007) as children of appropriate headers.
# Add new Rawson-style sub-sections with default_note text under Site Costs
# and Authority Conditions.
#
class SeedTenderHeadersAndSubsections < ActiveRecord::Migration[8.0]
  def up
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        seed_headers_for_tenant
      end
    end

    puts "  Seeded tender headers and reclassified sections"
  end

  def down
    # Remove headers (parent_id = nil, code starts with TH-)
    Tender.where("code LIKE 'TH-%'").find_each do |header|
      # Unparent children first
      header.children.update_all(parent_id: nil) if header.respond_to?(:children)
    end
    Tender.where("code LIKE 'TH-%'").destroy_all

    # Remove new sub-sections added by this migration
    new_codes = %w[
      TS-010 TS-011 TS-012 TS-013 TS-014 TS-015 TS-016
      TS-020 TS-021 TS-022 TS-023 TS-024 TS-025
    ]
    Tender.where(code: new_codes).destroy_all

    # Clear parent_id from remaining sections
    Tender.where.not(parent_id: nil).update_all(parent_id: nil)
  end

  private

  def seed_headers_for_tenant
    # ═══════════════════════════════════════════════════════════════════════════
    # 1. Create Headers (parent_id = nil, no section_type needed for headers)
    # ═══════════════════════════════════════════════════════════════════════════
    headers = {
      "TH-001" => { name: "Base Price & Essential Inclusions", sort_order: 10, description: "Standard inclusions and base contract items" },
      "TH-002" => { name: "Site Costs",                       sort_order: 20, description: "Site preparation, earthworks, services connections" },
      "TH-003" => { name: "Authority Conditions",             sort_order: 30, description: "Council, authority, and compliance requirements" },
      "TH-004" => { name: "Client Variations",                sort_order: 40, description: "Plan changes, selections, and upgrades" },
      "TH-005" => { name: "Notes & Conditions",               sort_order: 50, description: "General notes, conditions, and provisional sums" },
    }

    header_records = {}
    headers.each do |code, attrs|
      header_records[code] = Tender.find_or_create_by!(code: code) do |t|
        t.assign_attributes(
          attrs.merge(
            active: true,
            section_type: "note",
            show_line_items: false,
            parent_id: nil
          )
        )
      end
    end

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. Reclassify existing sections under headers
    # ═══════════════════════════════════════════════════════════════════════════
    section_to_header = {
      "TS-001" => "TH-001",  # Base Price & Essential Inclusions
      "TS-002" => "TH-002",  # Site Costs
      "TS-003" => "TH-003",  # Authority Conditions
      "TS-004" => "TH-004",  # Plan Changes → Client Variations
      "TS-005" => "TH-005",  # Provisional Sums → Notes & Conditions
      "TS-006" => "TH-004",  # Selections & Upgrades → Client Variations
      "TS-007" => "TH-005",  # Notes & Conditions → Notes & Conditions
    }

    section_to_header.each do |section_code, header_code|
      section = Tender.find_by(code: section_code)
      header = header_records[header_code]
      next unless section && header

      section.update!(parent_id: header.id)
    end

    # ═══════════════════════════════════════════════════════════════════════════
    # 3. Add new Rawson-style sub-sections under Site Costs (TH-002)
    # ═══════════════════════════════════════════════════════════════════════════
    site_costs_header = header_records["TH-002"]
    site_cost_sections = [
      { code: "TS-010", name: "Site Preparation",       sort_order: 21, section_type: "priced", default_note: "No allowance has been made for additional site preparation works." },
      { code: "TS-011", name: "Piering to Slab",        sort_order: 22, section_type: "priced", default_note: "No allowance has been made for piering." },
      { code: "TS-012", name: "Concrete Slab",          sort_order: 23, section_type: "priced", default_note: "Standard slab is included in the base price." },
      { code: "TS-013", name: "Service Connections",     sort_order: 24, section_type: "priced", default_note: "No allowance has been made for temporary or permanent service connections." },
      { code: "TS-014", name: "Wind Classification",    sort_order: 25, section_type: "priced", default_note: "Standard N2 wind classification is included." },
      { code: "TS-015", name: "Retaining Walls",        sort_order: 26, section_type: "priced", default_note: "No allowance has been made for retaining walls." },
      { code: "TS-016", name: "Driveway & Crossover",   sort_order: 27, section_type: "priced", default_note: "No allowance has been made for driveway or crossover works." },
    ]

    site_cost_sections.each do |attrs|
      Tender.find_or_create_by!(code: attrs[:code]) do |t|
        t.assign_attributes(attrs.merge(
          active: true,
          show_line_items: true,
          parent_id: site_costs_header.id,
          description: attrs[:default_note]
        ))
      end
    end

    # ═══════════════════════════════════════════════════════════════════════════
    # 4. Add new Rawson-style sub-sections under Authority Conditions (TH-003)
    # ═══════════════════════════════════════════════════════════════════════════
    authority_header = header_records["TH-003"]
    authority_sections = [
      { code: "TS-020", name: "CDC/DA Building",        sort_order: 31, section_type: "priced", default_note: "No allowance has been made for additional CDC/DA building requirements." },
      { code: "TS-021", name: "Bushfire Requirements",  sort_order: 32, section_type: "priced", default_note: "No allowance has been made for bushfire requirements (BAL-LOW assumed)." },
      { code: "TS-022", name: "Flood Requirements",     sort_order: 33, section_type: "priced", default_note: "No allowance has been made for flood requirements." },
      { code: "TS-023", name: "Acoustic Requirements",  sort_order: 34, section_type: "priced", default_note: "No allowance has been made for acoustic treatment." },
      { code: "TS-024", name: "Estate Requirements",    sort_order: 35, section_type: "priced", default_note: "No allowance has been made for additional estate compliance requirements." },
      { code: "TS-025", name: "BASIX / NatHERS",        sort_order: 36, section_type: "priced", default_note: "Standard BASIX/NatHERS compliance is included in the base price." },
    ]

    authority_sections.each do |attrs|
      Tender.find_or_create_by!(code: attrs[:code]) do |t|
        t.assign_attributes(attrs.merge(
          active: true,
          show_line_items: true,
          parent_id: authority_header.id,
          description: attrs[:default_note]
        ))
      end
    end
  end
end
