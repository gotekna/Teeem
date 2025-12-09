module Api
  module V1
    # DEPRECATED: This controller duplicates functionality from HealthChecks::PricebookCheck
    # Use the following endpoints instead:
    #   - GET /api/v1/foundations/205/health (or /api/v1/foundations/pricebook/health)
    #   - GET /api/v1/system/health
    #
    # This controller remains for backwards compatibility with the old frontend.
    # TODO: Remove after frontend migration is complete
    class HealthController < ApplicationController
      # GET /api/v1/health/system
      # System-wide health data formatted for the frontend system-health page
      def system
        health_data = HealthChecks::Registry.system_health

        # Group checks by check_type (table/module)
        checks_by_type = health_data[:checks].group_by { |c| c[:check_type] }

        # Map each type to the expected frontend format
        tables = checks_by_type.map do |type, checks|
          total_issues = checks.sum { |c| c[:count] || 0 }
          critical_count = checks.select { |c| c[:severity] == "critical" }.sum { |c| c[:count] || 0 }
          warning_count = checks.select { |c| c[:severity] == "warning" }.sum { |c| c[:count] || 0 }
          info_count = checks.select { |c| c[:severity] == "info" }.sum { |c| c[:count] || 0 }

          # Calculate health score for this table
          health_score = HealthChecks::BaseCheck.calculate_health_score(checks)

          # Format issues for frontend
          formatted_issues = checks.flat_map do |check|
            (check[:items] || []).map do |item|
              {
                id: item[:id] || SecureRandom.uuid,
                record_id: item[:id],
                record_name: item[:display] || item[:display_name] || "Unknown",
                issue_type: check[:name].parameterize.underscore,
                issue_description: check[:description] || check[:name],
                severity: check[:severity],
                fix_url: check[:action_path]&.gsub(":id", item[:id].to_s),
                created_at: Time.current.iso8601
              }
            end
          end.first(10) # Limit to first 10 issues per table

          {
            table_name: type.to_s,
            display_name: type.to_s.titleize,
            icon: get_icon_for_type(type),
            total_records: get_record_count_for_type(type),
            issues_count: total_issues,
            critical_count: critical_count,
            warning_count: warning_count,
            info_count: info_count,
            health_score: health_score,
            issues: formatted_issues
          }
        end

        render json: {
          overall_score: health_data[:overall_health],
          total_issues: health_data[:summary][:total],
          critical_issues: health_data[:summary][:critical],
          warning_issues: health_data[:summary][:warnings],
          tables: tables,
          last_checked: Time.current.iso8601
        }
      end

      # DEPRECATED: Use GET /api/v1/foundations/205/health instead
      def pricebook
        Rails.logger.warn "[DEPRECATED] GET /api/v1/health/pricebook - use /api/v1/foundations/205/health instead"
        # Get pricebook items without default supplier
        items_without_default_supplier_query = PricebookItem.active
          .where(default_supplier_id: nil)

        items_without_default_supplier_count = items_without_default_supplier_query.count
        items_without_default_supplier = items_without_default_supplier_query
          .select(:id, :item_code, :item_name, :category, :current_price)
          .order(:item_code)
          .limit(100)

        # Find suppliers with incomplete category coverage
        # A supplier has incomplete coverage if they have price history for SOME items in a category
        # but not ALL items in that category
        incomplete_suppliers_data = find_suppliers_with_incomplete_categories

        # Find items with default supplier but no price history
        items_with_missing_price_history = find_items_with_missing_price_history

        # Find items that require photo but have no image
        items_requiring_photo_query = PricebookItem.active
          .where(requires_photo: true)
          .where("image_url IS NULL OR image_url = ''")

        items_requiring_photo_count = items_requiring_photo_query.count
        items_requiring_photo_without_image = items_requiring_photo_query
          .select(:id, :item_code, :item_name, :category, :current_price)
          .order(:item_code)
          .limit(100)

        render json: {
          totalPricebookItems: PricebookItem.active.count,
          itemsWithoutDefaultSupplier: {
            count: items_without_default_supplier_count,
            items: items_without_default_supplier
          },
          suppliersWithIncompleteCategoryPricing: {
            count: incomplete_suppliers_data[:results].length,
            suppliersWithIssuesCount: incomplete_suppliers_data[:suppliers_with_issues_count],
            totalSuppliers: incomplete_suppliers_data[:total_suppliers],
            suppliers: incomplete_suppliers_data[:results]
          },
          itemsWithDefaultSupplierButNoPriceHistory: {
            count: items_with_missing_price_history.length,
            items: items_with_missing_price_history
          },
          itemsRequiringPhotoWithoutImage: {
            count: items_requiring_photo_count,
            items: items_requiring_photo_without_image
          }
        }
      end

      def missing_items
        supplier_id = params[:supplier_id]
        category = params[:category]

        if supplier_id.blank? || category.blank?
          render json: { error: "supplier_id and category are required" }, status: :bad_request
          return
        end

        # Get all active items in this category
        all_items_in_category = PricebookItem.active
          .where(category: category)
          .pluck(:id)

        # Get items this supplier has price history for
        items_with_price_history = PriceHistory
          .where(supplier_id: supplier_id)
          .joins(:pricebook_item)
          .where(pricebook: { category: category, is_active: true })
          .pluck(:pricebook_item_id)
          .uniq

        # Find missing item IDs
        missing_item_ids = all_items_in_category - items_with_price_history

        # Get the missing items with details
        missing_items = PricebookItem.active
          .where(id: missing_item_ids)
          .select(:id, :item_code, :item_name, :category, :current_price)
          .order(:item_code)

        render json: {
          items: missing_items
        }
      end

      private

      def find_suppliers_with_incomplete_categories
        results = []
        suppliers_with_issues = Set.new

        # Get all suppliers who have price history
        supplier_ids = PriceHistory.where.not(supplier_id: nil).distinct.pluck(:supplier_id)
        total_suppliers = supplier_ids.length

        supplier_ids.each do |supplier_id|
          supplier = Contact.find_by(id: supplier_id)
          next unless supplier

          # Get categories this supplier has price history for
          categories = PriceHistory
            .joins(:pricebook_item)
            .where(supplier_id: supplier_id)
            .where(pricebook: { is_active: true })
            .distinct
            .pluck("pricebook.category")
            .compact

          categories.each do |category|
            # Count total active items in this category
            total_items = PricebookItem.active.where(category: category).count

            # Count items this supplier has price history for in this category
            supplier_items = PriceHistory
              .joins(:pricebook_item)
              .where(supplier_id: supplier_id)
              .where(pricebook: { category: category, is_active: true })
              .distinct
              .count("pricebook.id")

            # If supplier has some but not all items, flag it
            if supplier_items > 0 && supplier_items < total_items
              suppliers_with_issues.add(supplier_id)
              results << {
                supplier: {
                  id: supplier.id,
                  name: supplier.display_name
                },
                category: category,
                items_with_pricing: supplier_items,
                total_items_in_category: total_items,
                coverage_percentage: ((supplier_items.to_f / total_items) * 100).round(1),
                missing_items_count: total_items - supplier_items
              }
            end
          end
        end

        # Sort by missing items count (descending) then by category
        sorted_results = results.sort_by { |r| [ -r[:missing_items_count], r[:category], r[:supplier][:name] ] }

        # Return the results, count of suppliers with issues, and total suppliers
        {
          results: sorted_results,
          suppliers_with_issues_count: suppliers_with_issues.length,
          total_suppliers: total_suppliers
        }
      end

      def find_items_with_missing_price_history
        items_with_issues = []

        # Get all active items that have a default supplier set
        PricebookItem.active.where.not(default_supplier_id: nil).includes(:default_supplier).find_each do |item|
          # Check if there's a price history entry for this item with the default supplier
          has_price_history = PriceHistory.exists?(
            pricebook_item_id: item.id,
            supplier_id: item.default_supplier_id
          )

          unless has_price_history
            items_with_issues << {
              id: item.id,
              item_code: item.item_code,
              item_name: item.item_name,
              category: item.category,
              current_price: item.current_price,
              default_supplier: {
                id: item.default_supplier&.id,
                name: item.default_supplier&.display_name
              }
            }
          end
        end

        # Sort by item_code
        items_with_issues.sort_by { |item| item[:item_code] }
      end

      def get_icon_for_type(type)
        case type.to_s
        when "jobs"
          "briefcase"
        when "contacts"
          "users"
        when "pricebook"
          "file-text"
        when "companies"
          "building"
        when "documents"
          "file"
        else
          "file-text"
        end
      end

      def get_record_count_for_type(type)
        case type.to_s
        when "jobs"
          Job.count
        when "contacts"
          Contact.where(deleted: [ false, nil ]).count
        when "pricebook"
          PricebookItem.active.count
        when "companies"
          CorporateCompany.count
        when "documents"
          CorporateCompanyDocument.count
        else
          0
        end
      rescue
        0
      end
    end
  end
end
