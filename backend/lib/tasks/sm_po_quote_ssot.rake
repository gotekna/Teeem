# frozen_string_literal: true

namespace :sm do
  desc "Backfill PO/quote SSoT fields from CustomQuoteTemplateLine → SmScheduleMaster"
  task backfill_po_quote_fields: :environment do
    puts "=== SM PO/Quote SSoT Backfill ==="
    puts "Copying tender_description, po_description, rfq_instructions, budget_amount"
    puts "from CustomQuoteTemplateLine → SmScheduleMaster (where SM is linked and field is blank)"
    puts

    updated = 0
    skipped = 0
    no_sm = 0

    CustomQuoteTemplateLine.where.not(sm_schedule_master_id: nil)
                            .includes(:sm_schedule_master)
                            .find_each do |line|
      sm = line.sm_schedule_master
      unless sm
        no_sm += 1
        next
      end

      changes = {}

      # Only backfill if SM field is blank and template line has data
      if sm.tender_description.blank? && line.tender_description.present?
        changes[:tender_description] = line.tender_description
      end

      if sm.po_description.blank? && line.po_description.present?
        changes[:po_description] = line.po_description
      end

      if sm.rfq_instructions.blank? && line.default_instructions.present?
        changes[:rfq_instructions] = line.default_instructions
      end

      if sm.budget_amount.blank? && line.budget_amount.present?
        changes[:budget_amount] = line.budget_amount
      end

      if changes.any?
        sm.update_columns(changes)
        updated += 1
        puts "  Updated SM ##{sm.id} (#{sm.name}): #{changes.keys.join(', ')}"
      else
        skipped += 1
      end
    end

    puts
    puts "=== Results ==="
    puts "  Updated: #{updated} SM records"
    puts "  Skipped: #{skipped} (SM already had data or template line was blank)"
    puts "  Missing SM: #{no_sm} (template line had sm_schedule_master_id but SM not found)"
    puts "=== Done ==="
  end
end
