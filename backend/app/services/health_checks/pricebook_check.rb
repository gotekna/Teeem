# frozen_string_literal: true

module HealthChecks
  # Health checks for Pricebook items
  # Foundation: pricebook-items (slug-based lookup - SSoT)
  #
  # Checks:
  #   - Items without default supplier (warning)
  #   - Items with supplier but no price history (info)
  #   - Items requiring photo without image (info)
  #   - Price mismatches between current_price and latest history (warning)
  #   - Suppliers with incomplete category coverage (info)
  #
  class PricebookCheck < BaseCheck
    FOUNDATION_SLUG = "pricebook-items"

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

    # Items with supplier but missing price history
    def check_items_without_price_history
      items = PricebookItem.active
                          .where.not(default_supplier_id: nil)
                          .left_joins(:price_histories)
                          .where(price_histories: { id: nil })
                          .select("pricebook.id, pricebook.item_code, pricebook.item_name")

      build_result(
        name: "Items Without Price History",
        description: "Items with a default supplier but no price history records. Price history is needed for tracking costs over time.",
        severity: :info,
        items: items,
        icon: "clock",
        action_path: "/pricebook/:id"
      )
    end

    # Items marked as requiring photo but without image
    def check_items_missing_photos
      items = PricebookItem.active
                          .where(requires_photo: true)
                          .where("image_url IS NULL OR image_url = ''")
                          .select(:id, :item_code, :item_name)

      build_result(
        name: "Items Missing Required Photos",
        description: "Items marked as requiring a photo but without an image uploaded. Photos help identify items during quotes and on-site.",
        severity: :info,
        items: items,
        icon: "photo",
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

    # Suppliers with incomplete category coverage
    def check_incomplete_supplier_coverage
      coverage_issues = find_incomplete_category_coverage(limit: 20)

      build_result(
        name: "Suppliers with Incomplete Category Pricing",
        description: "Suppliers who have prices for some items in a category but not all. May indicate missing price updates.",
        severity: :info,
        items: coverage_issues,
        icon: "chart-pie",
        action_path: "/contacts/:id"
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
            category: item.try(:category)
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

    def find_incomplete_category_coverage(limit: 20)
      issues = []

      # Get all categories with their item counts
      categories = PricebookItem.active
                               .where.not(category: [ nil, "" ])
                               .group(:category)
                               .count

      # Get all suppliers who have any price history
      supplier_ids = PriceHistory.distinct.pluck(:supplier_id).compact

      Contact.where(id: supplier_ids).find_each do |supplier|
        # Get categories this supplier has priced
        # Note: PricebookItem table is named 'pricebook' not 'pricebook_items'
        priced_items = PriceHistory.joins(:pricebook_item)
                                   .where(supplier_id: supplier.id)
                                   .where(pricebook: { is_active: true })
                                   .distinct
                                   .pluck("pricebook.category", "pricebook.id")

        priced_by_category = priced_items.group_by(&:first)

        priced_by_category.each do |category, items|
          next if category.blank?

          total_in_category = categories[category] || 0
          priced_count = items.size
          coverage = total_in_category > 0 ? (priced_count.to_f / total_in_category * 100).round(1) : 0

          # Flag if partial coverage (10-90%)
          next unless coverage >= 10 && coverage < 90

          issues << {
            id: supplier.id,
            display: "#{supplier.display_name || supplier.company_name}: #{category} (#{coverage}%)",
            supplier_id: supplier.id,
            supplier_name: supplier.display_name || supplier.company_name,
            category: category,
            coverage_percentage: coverage,
            priced_count: priced_count,
            total_count: total_in_category
          }

          break if issues.size >= limit
        end

        break if issues.size >= limit
      end

      issues
    end
  end
end
