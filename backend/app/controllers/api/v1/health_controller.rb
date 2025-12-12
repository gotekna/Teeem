module Api
  module V1
    # Unified health controller for the TEEEM Health Check system
    # Provides a single SSoT endpoint for all health data
    #
    # NEW UNIFIED ENDPOINTS:
    #   - GET /api/v1/health/unified - Main unified health endpoint
    #   - POST /api/v1/health/fix - Fix health issues (auto or manual)
    #   - GET /api/v1/health/leaderboard - Get kudos leaderboard
    #
    # LEGACY ENDPOINTS (kept for backwards compatibility):
    #   - GET /api/v1/health/system
    #   - GET /api/v1/health/pricebook
    #
    class HealthController < ApplicationController
      # GET /api/v1/health/unified
      # Returns unified health data for the new gamified dashboard
      # Supports caching with optional ?refresh=true parameter to force fresh calculation
      def unified
        # Check if user wants to force refresh
        force_refresh = params[:refresh] == "true"

        # Try to get cached results first (unless forcing refresh)
        unless force_refresh
          cached = HealthCheckCache.system_wide.first
          if cached&.fresh?
            Rails.logger.info "[Health] Serving cached system health (age: #{cached.age_in_hours}h)"
            return render json: cached.results.merge(
              cached: true,
              cached_at: cached.last_run_at.iso8601
            )
          end
        end

        # Run fresh health check
        Rails.logger.info "[Health] Running fresh system health check (forced: #{force_refresh})"

        # Get data health from HealthChecks::Registry
        data_health = HealthChecks::Registry.system_health

        # Get infrastructure status
        infrastructure = build_infrastructure_status

        # Get integrations status
        integrations = build_integrations_status

        # Get AI pipeline status (placeholder for now)
        ai_pipeline = build_ai_pipeline_status

        # Get leaderboard data
        leaderboard = HealthKudosEvent.leaderboard(timeframe: :this_week)

        # Get quick wins from health data
        quick_wins = build_quick_wins(data_health, integrations)

        # Calculate overall score
        overall_score = data_health[:overall_health] || 0

        result = {
          success: true,
          overall_score: overall_score,
          status: determine_health_status(overall_score),
          last_checked: Time.current.iso8601,

          # Quick wins for the dashboard
          quick_wins: quick_wins,

          # Data health by category
          data_health: {
            overall_health: data_health[:overall_health],
            status: data_health[:status],
            summary: data_health[:summary],
            categories: data_health[:checks]
          },

          # Integration statuses
          integrations: integrations,

          # AI Pipeline status
          ai_pipeline: ai_pipeline,

          # Infrastructure metrics
          infrastructure: infrastructure,

          # Leaderboard
          leaderboard: leaderboard,

          # Stats
          stats: {
            jobs_count: Job.count,
            contacts_count: Contact.count,
            pricebook_items_count: PricebookItem.count,
            companies_count: CorporateCompany.count,
            pending_jobs: get_pending_jobs_count,
            failed_jobs: get_failed_jobs_count
          },

          cached: false
        }

        # Cache the fresh results
        HealthCheckCache.cache_system_health(result)

        render json: result
      end

      # POST /api/v1/health/fix
      # Fix health issues - can be auto or manual
      def fix
        fix_type = params[:fix_type]
        item_ids = params[:item_ids] || []
        auto = params[:auto] == true || params[:auto] == "true"

        unless fix_type.present?
          return render json: { success: false, error: "fix_type is required" }, status: :bad_request
        end

        result = perform_fix(fix_type, item_ids, auto)

        if result[:success]
          render json: {
            success: true,
            fixed_count: result[:fixed_count],
            points_earned: result[:points_earned],
            message: result[:message]
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/health/leaderboard
      # Get kudos leaderboard
      def leaderboard
        timeframe = params[:timeframe]&.to_sym || :this_week
        timeframe = :this_week unless %i[today this_week all].include?(timeframe)

        data = HealthKudosEvent.leaderboard(timeframe: timeframe)

        render json: {
          success: true,
          timeframe: timeframe.to_s,
          **data
        }
      end

      # GET /api/v1/health/system
      # LEGACY: System-wide health data formatted for the frontend system-health page
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

      # ========================================
      # New unified health endpoint helpers
      # ========================================

      def build_infrastructure_status
        [
          {
            id: "database",
            name: "Database",
            status: check_database_status,
            message: "Connected"
          },
          {
            id: "jobs_queue",
            name: "Jobs Queue",
            status: check_jobs_queue_status,
            value: get_pending_jobs_count,
            message: "#{get_pending_jobs_count} pending, #{get_failed_jobs_count} failed"
          },
          {
            id: "memory",
            name: "Memory",
            status: "healthy",
            value: "#{get_memory_usage}MB",
            max_value: "2GB",
            percentage: [ (get_memory_usage / 2048.0 * 100).round, 100 ].min,
            message: "OK"
          },
          {
            id: "workers",
            name: "Workers",
            status: "healthy",
            value: get_active_workers.to_s,
            max_value: "4",
            percentage: 100,
            message: "All active"
          }
        ]
      end

      def build_integrations_status
        integrations = []

        # Xero
        xero_status = get_xero_status
        integrations << {
          id: "xero",
          name: "Xero",
          status: xero_status[:connected] ? "connected" : "disconnected",
          status_message: xero_status[:connected] ? (xero_status[:organisation_name] || "Connected") : "Not connected",
          last_synced: xero_status[:last_synced],
          action_label: xero_status[:connected] ? "View" : "Connect",
          action_type: xero_status[:connected] ? "view" : "connect",
          href: "/settings/integrations/xero"
        }

        # OneDrive (placeholder - check for actual status)
        integrations << {
          id: "onedrive",
          name: "OneDrive",
          status: "connected",
          status_message: "Connected",
          action_label: "View",
          action_type: "view",
          href: "/settings/integrations"
        }

        # Email (placeholder)
        integrations << {
          id: "email",
          name: "Email",
          status: "connected",
          status_message: "Synced",
          action_label: "View",
          action_type: "view",
          href: "/settings/integrations"
        }

        # ABN Lookup
        integrations << {
          id: "abn",
          name: "ABN Lookup",
          status: "connected",
          status_message: "Available"
        }

        integrations
      end

      def build_ai_pipeline_status
        # Placeholder - will be implemented with actual AI queue data
        {
          queue_count: 8,
          average_confidence: 78,
          failed_today: 2,
          status: "healthy"
        }
      end

      def build_quick_wins(data_health, integrations)
        wins = []

        # Add quick wins from health data
        wins += HealthKudosEvent.quick_wins_from_health(data_health)

        # Add Xero reconnect if disconnected
        xero = integrations.find { |i| i[:id] == "xero" }
        if xero && xero[:status] == "disconnected"
          wins.unshift({
            id: "xero-connect",
            title: "Connect Xero",
            description: "Sync your accounting data",
            count: 1,
            points: 50,
            fix_type: "connect",
            check_type: "xero"
          })
        end

        wins.first(5)
      end

      def perform_fix(fix_type, item_ids, auto)
        case fix_type.to_s
        when "name_casing", "all_caps_names", "lowercase_names"
          fix_name_casing(item_ids, auto)
        when "website_prefix"
          fix_website_prefix(item_ids, auto)
        when "phone_format"
          fix_phone_format(item_ids, auto)
        when "email_lowercase"
          fix_email_lowercase(item_ids, auto)
        when "abn_format"
          fix_abn_format(item_ids, auto)
        when "acn_format"
          fix_acn_format(item_ids, auto)
        else
          { success: false, error: "Unknown fix type: #{fix_type}" }
        end
      rescue StandardError => e
        Rails.logger.error "[HealthController#fix] Error: #{e.message}"
        { success: false, error: e.message }
      end

      def fix_name_casing(item_ids, auto)
        fixed_count = 0
        points_earned = 0

        if item_ids.present?
          # Fix specific contacts
          contacts = Contact.where(id: item_ids)
          contacts.each do |contact|
            if fix_contact_name_casing(contact)
              fixed_count += 1
              points_earned += HealthKudosEvent::POINTS[:name_casing]
            end
          end
        else
          # Find and fix all contacts with name casing issues
          Contact.where.not(first_name: nil).find_each do |contact|
            next unless needs_name_casing_fix?(contact)
            if fix_contact_name_casing(contact)
              fixed_count += 1
              points_earned += HealthKudosEvent::POINTS[:name_casing]
            end
          end
        end

        if fixed_count > 0
          HealthKudosEvent.record_bulk_fix(
            user: auto ? nil : current_user,
            fix_type: "name_casing",
            record_type: "Contact",
            record_ids: item_ids.presence || [],
            points_per_record: HealthKudosEvent::POINTS[:name_casing]
          )
        end

        {
          success: true,
          fixed_count: fixed_count,
          points_earned: points_earned,
          message: "Fixed #{fixed_count} name casing issues"
        }
      end

      def needs_name_casing_fix?(contact)
        [ contact.first_name, contact.last_name ].compact.any? do |name|
          name.present? && (name == name.upcase || name == name.downcase)
        end
      end

      def fix_contact_name_casing(contact)
        changed = false

        if contact.first_name.present? && (contact.first_name == contact.first_name.upcase || contact.first_name == contact.first_name.downcase)
          contact.first_name = contact.first_name.titleize
          changed = true
        end

        if contact.last_name.present? && (contact.last_name == contact.last_name.upcase || contact.last_name == contact.last_name.downcase)
          contact.last_name = contact.last_name.titleize
          changed = true
        end

        if changed
          contact.save(validate: false)
          true
        else
          false
        end
      end

      def fix_website_prefix(item_ids, auto)
        fixed_count = 0
        points_earned = 0
        fixed_ids = []

        if item_ids.present?
          contacts = Contact.where(id: item_ids)
        else
          # Find contacts with websites missing http/https prefix
          contacts = Contact.where.not(website: [ nil, "" ])
                           .where.not("website LIKE 'http://%' OR website LIKE 'https://%'")
        end

        contacts.find_each do |contact|
          next unless contact.website.present? && !contact.website.start_with?("http")

          contact.website = "https://#{contact.website}"
          if contact.save(validate: false)
            fixed_count += 1
            fixed_ids << contact.id
            points_earned += HealthKudosEvent::POINTS[:website_prefix]
          end
        end

        if fixed_count > 0
          HealthKudosEvent.record_bulk_fix(
            user: auto ? nil : current_user,
            fix_type: "website_prefix",
            record_type: "Contact",
            record_ids: fixed_ids,
            points_per_record: HealthKudosEvent::POINTS[:website_prefix]
          )
        end

        {
          success: true,
          fixed_count: fixed_count,
          points_earned: points_earned,
          message: "Fixed #{fixed_count} website URLs with https:// prefix"
        }
      end

      def fix_phone_format(item_ids, auto)
        fixed_count = 0
        points_earned = 0
        fixed_ids = []

        if item_ids.present?
          contacts = Contact.where(id: item_ids)
        else
          # Find contacts with Australian phone numbers that need formatting
          # Australian numbers: 0X XXXX XXXX (10 digits) or +61 X XXXX XXXX
          contacts = Contact.where.not(mobile_phone: [ nil, "" ])
        end

        contacts.find_each do |contact|
          next unless contact.mobile_phone.present?

          # Remove all non-digit characters
          digits = contact.mobile_phone.gsub(/\D/, "")

          # Skip if not a valid Australian phone number length
          next unless [ 10, 11, 12 ].include?(digits.length)

          formatted = format_australian_phone(digits)
          next if formatted == contact.mobile_phone

          contact.mobile_phone = formatted
          if contact.save(validate: false)
            fixed_count += 1
            fixed_ids << contact.id
            points_earned += HealthKudosEvent::POINTS[:phone_format]
          end
        end

        if fixed_count > 0
          HealthKudosEvent.record_bulk_fix(
            user: auto ? nil : current_user,
            fix_type: "phone_format",
            record_type: "Contact",
            record_ids: fixed_ids,
            points_per_record: HealthKudosEvent::POINTS[:phone_format]
          )
        end

        {
          success: true,
          fixed_count: fixed_count,
          points_earned: points_earned,
          message: "Formatted #{fixed_count} phone numbers"
        }
      end

      def fix_email_lowercase(item_ids, auto)
        fixed_count = 0
        points_earned = 0
        fixed_ids = []

        if item_ids.present?
          contacts = Contact.where(id: item_ids)
        else
          # Find contacts with uppercase characters in email
          contacts = Contact.where.not(email: [ nil, "" ])
                           .where("email != LOWER(email)")
        end

        contacts.find_each do |contact|
          next unless contact.email.present? && contact.email != contact.email.downcase

          contact.email = contact.email.downcase
          if contact.save(validate: false)
            fixed_count += 1
            fixed_ids << contact.id
            points_earned += HealthKudosEvent::POINTS[:email_lowercase]
          end
        end

        if fixed_count > 0
          HealthKudosEvent.record_bulk_fix(
            user: auto ? nil : current_user,
            fix_type: "email_lowercase",
            record_type: "Contact",
            record_ids: fixed_ids,
            points_per_record: HealthKudosEvent::POINTS[:email_lowercase]
          )
        end

        {
          success: true,
          fixed_count: fixed_count,
          points_earned: points_earned,
          message: "Converted #{fixed_count} emails to lowercase"
        }
      end

      def fix_abn_format(item_ids, auto)
        fixed_count = 0
        points_earned = 0
        fixed_ids = []

        if item_ids.present?
          companies = CorporateCompany.where(id: item_ids)
        else
          # Find companies with ABN that needs formatting (should be XX XXX XXX XXX)
          companies = CorporateCompany.where.not(abn: [ nil, "" ])
        end

        companies.find_each do |company|
          next unless company.abn.present?

          digits = company.abn.gsub(/\D/, "")
          next unless digits.length == 11

          formatted = "#{digits[0..1]} #{digits[2..4]} #{digits[5..7]} #{digits[8..10]}"
          next if formatted == company.abn

          company.abn = formatted
          if company.save(validate: false)
            fixed_count += 1
            fixed_ids << company.id
            points_earned += HealthKudosEvent::POINTS[:abn_format]
          end
        end

        if fixed_count > 0
          HealthKudosEvent.record_bulk_fix(
            user: auto ? nil : current_user,
            fix_type: "abn_format",
            record_type: "CorporateCompany",
            record_ids: fixed_ids,
            points_per_record: HealthKudosEvent::POINTS[:abn_format]
          )
        end

        {
          success: true,
          fixed_count: fixed_count,
          points_earned: points_earned,
          message: "Formatted #{fixed_count} ABN numbers (XX XXX XXX XXX)"
        }
      end

      def fix_acn_format(item_ids, auto)
        fixed_count = 0
        points_earned = 0
        fixed_ids = []

        if item_ids.present?
          companies = CorporateCompany.where(id: item_ids)
        else
          # Find companies with ACN that needs formatting (should be XXX XXX XXX)
          companies = CorporateCompany.where.not(acn: [ nil, "" ])
        end

        companies.find_each do |company|
          next unless company.acn.present?

          digits = company.acn.gsub(/\D/, "")
          next unless digits.length == 9

          formatted = "#{digits[0..2]} #{digits[3..5]} #{digits[6..8]}"
          next if formatted == company.acn

          company.acn = formatted
          if company.save(validate: false)
            fixed_count += 1
            fixed_ids << company.id
            points_earned += HealthKudosEvent::POINTS[:acn_format]
          end
        end

        if fixed_count > 0
          HealthKudosEvent.record_bulk_fix(
            user: auto ? nil : current_user,
            fix_type: "acn_format",
            record_type: "CorporateCompany",
            record_ids: fixed_ids,
            points_per_record: HealthKudosEvent::POINTS[:acn_format]
          )
        end

        {
          success: true,
          fixed_count: fixed_count,
          points_earned: points_earned,
          message: "Formatted #{fixed_count} ACN numbers (XXX XXX XXX)"
        }
      end

      def format_australian_phone(digits)
        case digits.length
        when 10
          # 0X XXXX XXXX format (landline or mobile)
          "#{digits[0..1]} #{digits[2..5]} #{digits[6..9]}"
        when 11
          # +61 X XXXX XXXX (assuming starts with 61)
          if digits.start_with?("61")
            "+61 #{digits[2]} #{digits[3..6]} #{digits[7..10]}"
          else
            digits # Return as-is if not valid Australian format
          end
        when 12
          # Possibly +614 XXXX XXXX
          if digits.start_with?("614")
            "+61 4#{digits[3..6]} #{digits[7..10]}"
          else
            digits
          end
        else
          digits
        end
      end

      def check_database_status
        ActiveRecord::Base.connection.active? ? "healthy" : "critical"
      rescue StandardError
        "critical"
      end

      def check_jobs_queue_status
        failed = get_failed_jobs_count
        return "critical" if failed > 50
        return "warning" if failed > 10
        "healthy"
      end

      def get_pending_jobs_count
        SolidQueue::Job.pending.count
      rescue StandardError
        0
      end

      def get_failed_jobs_count
        SolidQueue::Job.failed.count
      rescue StandardError
        0
      end

      def get_memory_usage
        if RUBY_PLATFORM =~ /darwin/
          `ps -o rss= -p #{Process.pid}`.to_i / 1024
        else
          `ps -o rss= -p #{Process.pid}`.to_i / 1024
        end
      rescue StandardError
        0
      end

      def get_active_workers
        # Placeholder - would check actual SolidQueue workers
        4
      end

      def get_xero_status
        credential = XeroCredential.current
        return { connected: false } unless credential

        # Use the SSoT status field from XeroCredential model
        # status: 'connected', 'degraded', or 'disconnected'
        is_connected = credential.status == "connected"
        is_degraded = credential.status == "degraded"

        {
          connected: is_connected || is_degraded, # Show connected if usable
          status: credential.status,
          health_status: credential.health_status.to_s,
          organisation_name: credential.tenant_name,
          last_synced: credential.last_successful_api_call_at&.iso8601,
          needs_attention: is_degraded || credential.status == "disconnected"
        }
      rescue StandardError => e
        Rails.logger.error("Health check Xero status error: #{e.message}")
        { connected: false, error: e.message }
      end

      def determine_health_status(score)
        if score >= 90
          "healthy"
        elsif score >= 70
          "warning"
        else
          "critical"
        end
      end
    end
  end
end
