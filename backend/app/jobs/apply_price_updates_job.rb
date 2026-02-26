class ApplyPriceUpdatesJob < ApplicationJob
  queue_as :default

  # ⚠️ FRC (Feb 2026): Must iterate over tenants
  # Root cause: PriceHistory and PricebookItem have acts_as_tenant. Without tenant
  # context, queries return ALL tenants' price histories, applying cross-tenant prices.
  def perform
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        apply_for_tenant
      end
    end
  end

  private

  def apply_for_tenant
    today = TenantSetting.today

    PriceHistory.includes(:pricebook_item)
                .where("date_effective <= ?", today)
                .find_each do |history|
      item = history.pricebook_item

      next unless item
      next unless item.default_supplier_id == history.supplier_id

      if item.current_price != history.new_price
        latest_history = PriceHistory.where(pricebook_item_id: item.id, supplier_id: history.supplier_id)
                                     .where("date_effective <= ?", today)
                                     .order(date_effective: :desc, created_at: :desc)
                                     .first

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
