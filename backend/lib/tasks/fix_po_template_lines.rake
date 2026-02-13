# frozen_string_literal: true

# Fix PO template line items that were lost during Config Sync
# due to duplicate line_numbers in source PO line items.
#
# Root Cause: Config Sync matches by (po_template_item_id, line_number).
# When source PO line items all have line_number=1, Config Sync treats
# them as the same record and only keeps the last one per item.
#
# This task:
# 1. Renumbers source PO line items in a job to have sequential line_numbers
# 2. Deletes and re-creates template items from the job with correct line_numbers

namespace :po_templates do
  desc "Fix PO template line items by re-importing from source job"
  task :reimport_from_job, [:pack_name, :job_id] => :environment do |_t, args|
    pack_name = args[:pack_name]
    job_id = args[:job_id]

    abort "Usage: rails po_templates:reimport_from_job['Pack Name',job_id]" unless pack_name && job_id

    pack = PoTemplatePack.find_by!(name: pack_name)
    job = Job.find(job_id)

    puts "Pack: #{pack.name} (ID: #{pack.id})"
    puts "Job: #{job.job_code} - #{job.name} (ID: #{job.id})"
    puts ""

    # Step 1: Fix source PO line_numbers
    fixed_pos = 0
    fixed_lines = 0

    PurchaseOrder.where(job_id: job.id).find_each do |po|
      lines = po.line_items.order(:id)
      next if lines.count <= 1

      needs_fix = lines.pluck(:line_number).uniq.count < lines.count
      next unless needs_fix

      lines.each_with_index do |li, idx|
        new_num = idx + 1
        if li.line_number != new_num
          li.update_column(:line_number, new_num)
          fixed_lines += 1
        end
      end
      fixed_pos += 1
    end

    puts "Step 1: Fixed #{fixed_lines} line_numbers across #{fixed_pos} POs"

    # Step 2: Re-create template items from job
    old_items_count = pack.po_template_items.count
    old_lines_count = PoTemplateLineItem.where(po_template_item_id: pack.po_template_items.pluck(:id)).count

    pack.po_template_items.destroy_all

    pos = PurchaseOrder.where(job_id: job.id)
      .includes(:supplier, sm_task: :sm_schedule_master)
      .includes(:line_items)

    sorted_pos = pos.sort_by { |po| po.sm_task&.sm_schedule_master&.sequence_order || Float::INFINITY }

    total_items = 0
    total_lines = 0

    ActiveRecord::Base.transaction do
      sorted_pos.each_with_index do |po, idx|
        item = pack.po_template_items.create!(
          name: po.sm_task&.name || po.description || "PO #{po.purchase_order_number}",
          sm_schedule_master_id: po.sm_task&.sm_schedule_master_id,
          supplier_id: po.supplier_id,
          supplier_sync_key: po.supplier&.display_name,
          position: idx,
          budget: po.budget,
          notes: po.description,
          status_on_create: "draft"
        )
        total_items += 1

        po.line_items.order(:line_number, :id).each_with_index do |li, line_idx|
          item.po_template_line_items.create!(
            description: li.description,
            quantity: li.quantity,
            unit_price: li.unit_price,
            gst_code: li.gst_code,
            pricebook_item_id: li.pricebook_item_id,
            pricebook_item_code: li.pricebook_item&.item_code,
            line_number: line_idx + 1
          )
          total_lines += 1
        end
      end
    end

    puts ""
    puts "Step 2: Replaced #{old_items_count} items / #{old_lines_count} lines"
    puts "   With: #{total_items} items / #{total_lines} lines"
    puts "   Estimated total: $#{pack.reload.estimated_total}"
    puts ""
    puts "Done! Now re-run Config Sync to push to tenant."
  end
end
