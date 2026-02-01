class ApplyPriceUpdatesJob < ApplicationJob
  queue_as :default

  def perform
    # Find all price histories with effective dates that have arrived (today or earlier)
    # but haven't been applied yet
    today = TenantSetting.today

    # Get price histories where:
    # 1. date_effective <= today
    # 2. The item's current price doesn't match the new_price
    # 3. The item's default_supplier matches the price history supplier
    PriceHistory.includes(:pricebook_item)
                .where("date_effective <= ?", today)
                .find_each do |history|
      item = history.pricebook_item

      # Skip if item doesn't exist
      next unless item

      # Only update if this supplier is the default supplier for this item
      next unless item.default_supplier_id == history.supplier_id

      # Only update if the price hasn't been applied yet
      # (item's current price is different from this history's new price)
      if item.current_price != history.new_price
        # Check if this is the most recent effective price for today or earlier
        latest_history = PriceHistory.where(pricebook_item_id: item.id, supplier_id: history.supplier_id)
                                     .where("date_effective <= ?", today)
                                     .order(date_effective: :desc, created_at: :desc)
                                     .first

        # Only apply if this is the latest effective price
        if latest_history&.id == history.id
          item.update!(
            current_price: history.new_price,
            price_last_updated_at: Time.current
          )

          Rails.logger.info "Applied price update for item #{item.item_code}: $#{history.new_price} (effective #{history.date_effective})"
        end
      end
    end
  end
end
