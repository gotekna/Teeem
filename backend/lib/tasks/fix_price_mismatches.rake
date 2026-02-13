# frozen_string_literal: true

# One-time task: Fix all price mismatches between current_price and default supplier's latest price history.
# After running, the new model callbacks will keep them in sync going forward.
#
# Dry run:  rails pricebook:fix_price_mismatches[dry_run]
# Live run: rails pricebook:fix_price_mismatches

namespace :pricebook do
  desc "Fix price mismatches: sync current_price to default supplier's latest price history"
  task :fix_price_mismatches, [:mode] => :environment do |_t, args|
    dry_run = args[:mode] == "dry_run"
    puts dry_run ? "=== DRY RUN ===" : "=== LIVE RUN ==="

    fixed = 0
    skipped_no_history = 0
    already_matching = 0

    # Use raw SQL to bypass acts_as_tenant
    items = ActiveRecord::Base.connection.execute(
      "SELECT id, item_code, current_price, default_supplier_id FROM pricebooks WHERE default_supplier_id IS NOT NULL AND is_active = true ORDER BY id"
    ).to_a

    puts "Checking #{items.size} items with default suppliers..."

    items.each do |row|
      item_id = row["id"]
      item_code = row["item_code"]
      current_price = row["current_price"]&.to_f
      default_supplier_id = row["default_supplier_id"]

      # Get latest price history for this supplier
      latest = ActiveRecord::Base.connection.execute(
        "SELECT new_price FROM price_histories WHERE pricebook_item_id = #{item_id.to_i} AND supplier_id = #{default_supplier_id.to_i} ORDER BY COALESCE(date_effective, '1900-01-01') DESC, created_at DESC LIMIT 1"
      ).to_a.first

      unless latest
        skipped_no_history += 1
        next
      end

      history_price = latest["new_price"]&.to_f

      if current_price == history_price
        already_matching += 1
        next
      end

      if dry_run
        puts "  WOULD FIX: #{item_code} (id=#{item_id}): $#{current_price} -> $#{history_price}"
      else
        ActiveRecord::Base.connection.execute(
          "UPDATE pricebooks SET current_price = #{history_price}, price_last_updated_at = NOW() WHERE id = #{item_id.to_i}"
        )
      end
      fixed += 1
    end

    puts ""
    puts "=== Results ==="
    puts "#{dry_run ? 'Would fix' : 'Fixed'}: #{fixed}"
    puts "Already matching: #{already_matching}"
    puts "Skipped (no history for default supplier): #{skipped_no_history}"
    puts "Total checked: #{items.size}"
  end
end
