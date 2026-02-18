# frozen_string_literal: true

module HealthChecks
  # Health checks for Pricebook items
  # Foundation: pricebook-items (slug-based lookup - SSoT)
  #
  # Checks:
  #   - Items without default supplier (warning)
  #   - Items with supplier but no price (warning)
  #   - Items with supplier but no price history (info)
  #   - Price mismatches between current_price and latest history (warning)
  #
  class PricebookCheck < BaseCheck
    FOUNDATION_SLUG = "pricebook-items".freeze

    def self.check_type
      "pricebook"
    end

    # SSoT: Use slug lookup, not hardcoded numeric ID (differs per environment)
    def self.foundation_id
      @foundation_id ||= Foundation.find_by(slug: FOUNDATION_SLUG)&.id
    end

    # Items that don't have a default supplier assigned
    def check_items_without_supplier
      items = PricebookItem.active.where(default_supplier_id: nil)
                          .select(:id, :item_code, :item_name, :category)

      build_result(
        name: "Items Without Default Supplier",
        description: "Pricebook items that do not have a default supplier assigned. These items cannot be quoted until a supplier is set.",
        severity: :warning,
        items: items,
        icon: "building-storefront",
        action_path: "/pricebook/:id"
      )
    end

    # Items with supplier assigned but no current price set
    def check_items_with_supplier_no_price
      items = PricebookItem.active
                          .where.not(default_supplier_id: nil)
                          .where(current_price: [nil, 0])
                          .select(:id, :item_code, :item_name, :category)

      build_result(
        name: "Items With Supplier But No Price",
        description: "Pricebook items that have a default supplier assigned but no current price set. These items need a price before they can be used in quotes.",
        severity: :warning,
        items: items,
        icon: "tag",
        action_path: "/pricebook/:id"
      )
    end

    # Items with supplier but missing price history
    def check_items_without_price_history
      items = PricebookItem.active
                          .where.not(default_supplier_id: nil)
                          .left_joins(:price_histories)
                          .where(price_histories: { id: nil })
                          .select("pricebooks.id, pricebooks.item_code, pricebooks.item_name")

      build_result(
        name: "Items Without Price History",
        description: "Items with a default supplier but no price history records. Price history is needed for tracking costs over time.",
        severity: :info,
        items: items,
        icon: "clock",
        action_path: "/pricebook/:id"
      )
    end

    # Items where current_price doesn't match latest price history
    def check_price_mismatches
      mismatches = find_price_mismatches(limit: 50)

      build_result(
        name: "Price Mismatches",
        description: "Items where the current price does not match the latest price history entry from the default supplier.",
        severity: :warning,
        items: mismatches,
        icon: "currency-dollar",
        action_path: "/pricebook/:id"
      )
    end

    protected

    def format_items(items)
      items.map do |item|
        if item.is_a?(Hash)
          item
        elsif item.respond_to?(:item_code)
          {
            id: item.id,
            display: "#{item.item_code} - #{item.item_name}",
            item_code: item.item_code,
            item_name: item.item_name,
            category: item&.category
          }
        else
          super
        end
      end
    end

    private

    def find_price_mismatches(limit: 50)
      mismatches = []

      PricebookItem.active
                   .where.not(default_supplier_id: nil)
                   .includes(:price_histories)
                   .find_each do |item|
        # Get latest price from default supplier
        latest_price = item.price_histories
                          .where(supplier_id: item.default_supplier_id)
                          .order(date_effective: :desc, created_at: :desc)
                          .first

        next unless latest_price
        next if item.current_price.to_f == latest_price.new_price.to_f

        mismatches << {
          id: item.id,
          display: "#{item.item_code}: $#{item.current_price} vs $#{latest_price.new_price}",
          item_code: item.item_code,
          item_name: item.item_name,
          current_price: item.current_price,
          history_price: latest_price.new_price,
          difference: (item.current_price.to_f - latest_price.new_price.to_f).round(2)
        }

        break if mismatches.size >= limit
      end

      mismatches
    end

  end
end
