# frozen_string_literal: true

# Add header_type and system_locked to tender_headers.
#
# header_type distinguishes standard headers from PC/PS schedule headers:
#   - "standard"    → normal header with sections containing PO items
#   - "pc_schedule" → aggregated Prime Cost Items schedule
#   - "ps_schedule" → aggregated Provisional Sum Items schedule
#
# system_locked prevents deletion of base headers (rename/reorder/deactivate still allowed).
#
# Also seeds per-tenant PC and PS schedule headers and registers new Foundation columns.
#
class AddHeaderTypeToTenderHeaders < ActiveRecord::Migration[8.0]
  def up
    # ── Schema changes ────────────────────────────────────────────────
    add_column :tender_headers, :header_type, :string, limit: 20, default: "standard", null: false
    add_column :tender_headers, :system_locked, :boolean, default: false, null: false

    # ── Seed PC/PS headers per tenant ─────────────────────────────────
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        TenderHeader.find_or_create_by!(code: "TH-PC", tenant: tenant) do |h|
          h.name = "Schedule of Prime Cost Items"
          h.header_type = "pc_schedule"
          h.system_locked = true
          h.sort_order = 60
        end

        TenderHeader.find_or_create_by!(code: "TH-PS", tenant: tenant) do |h|
          h.name = "Schedule of Provisional Sum Items"
          h.header_type = "ps_schedule"
          h.system_locked = true
          h.sort_order = 70
        end

        # Mark existing standard headers as system_locked (base set)
        TenderHeader.where(tenant: tenant)
                    .where(header_type: "standard")
                    .update_all(system_locked: true)
      end
    end

    # ── Register Foundation columns ───────────────────────────────────
    foundation = Foundation.find_by(slug: "tender_headers")
    if foundation
      Column.find_or_create_by!(foundation: foundation, column_name: "header_type") do |c|
        c.name = "Type"
        c.column_type = "single_line_text"
        c.position = 10
        c.has_ui = true
        c.searchable = false
      end

      Column.find_or_create_by!(foundation: foundation, column_name: "system_locked") do |c|
        c.name = "Locked"
        c.column_type = "boolean"
        c.position = 11
        c.has_ui = true
        c.searchable = false
      end
    end
  end

  def down
    foundation = Foundation.find_by(slug: "tender_headers")
    if foundation
      foundation.columns.where(column_name: %w[header_type system_locked]).destroy_all
    end

    # Remove seeded PC/PS headers
    TenderHeader.where(code: %w[TH-PC TH-PS]).destroy_all

    remove_column :tender_headers, :system_locked
    remove_column :tender_headers, :header_type
  end
end
