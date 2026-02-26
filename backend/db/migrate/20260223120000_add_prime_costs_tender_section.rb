# frozen_string_literal: true

# Add "Prime Costs" section under "Notes & Conditions" header (TH-005),
# alongside the existing "Provisional Sums" section.
#
# This gives Prime Cost items a home in the tender tree, matching
# the existing Provisional Sums section structure.
#
class AddPrimeCostsTenderSection < ActiveRecord::Migration[8.0]
  def up
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        header = TenderHeader.find_by(code: "TH-005")
        next unless header

        # Insert Prime Costs before Provisional Sums (sort_order 4 vs 5)
        Tender.find_or_create_by!(code: "TS-008") do |t|
          t.assign_attributes(
            name: "Prime Costs",
            section_type: "note",
            sort_order: 4,
            description: "Prime cost items - subject to competitive quotation",
            default_note: "A Prime Cost is an allowance for items where the actual cost is not yet determined. The contract price will be adjusted to reflect the actual cost of these items when purchased or completed.",
            active: true,
            show_line_items: false,
            tender_header_id: header.id
          )
        end
      end
    end

    puts "  Added Prime Costs section under Notes & Conditions"
  end

  def down
    Tender.where(code: "TS-008").destroy_all
  end
end
