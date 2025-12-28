# frozen_string_literal: true

module HealthChecks
  # Base class for all health check services
  # Provides common interface and utilities for health checks
  #
  # Usage:
  #   class PricebookHealthCheck < HealthChecks::BaseCheck
  #     def self.check_type
  #       'pricebook'
  #     end
  #
  #     def items_without_supplier
  #       build_result(
  #         name: 'Items Without Default Supplier',
  #         severity: :warning,
  #         items: PricebookItem.active.where(default_supplier_id: nil)
  #       )
  #     end
  #   end
  #
  class BaseCheck
    # Severity levels and their point penalties for health score
    SEVERITY_WEIGHTS = {
      critical: { penalty_per_issue: 10, max_penalty: 50 },
      warning: { penalty_per_issue: 2, max_penalty: 30 },
      info: { penalty_per_issue: 0, max_penalty: 0 }
    }.freeze

    SEVERITY_ORDER = { "critical" => 0, "warning" => 1, "info" => 2 }.freeze

    class << self
      # Override in subclass to define check type
      def check_type
        raise NotImplementedError, "Subclass must define .check_type"
      end

      # Get all available check methods for this service
      def available_checks
        public_instance_methods(false).select { |m| m.to_s.start_with?("check_") }
      end

      # Run all checks and return combined results
      def run_all
        new.run_all
      end

      # Run a specific check
      def run(check_name)
        new.run(check_name)
      end
    end

    # Run all available checks
    def run_all
      self.class.available_checks.map { |check| send(check) }
    end

    # Run a specific check by name
    def run(check_name)
      method_name = check_name.to_s.start_with?("check_") ? check_name : "check_#{check_name}"
      return nil unless respond_to?(method_name)

      send(method_name)
    end

    protected

    # Build a standardized result hash
    # @param name [String] Display name of the check
    # @param description [String] Description of what this check does
    # @param severity [Symbol] :critical, :warning, or :info
    # @param items [ActiveRecord::Relation, Array] Items that failed the check
    # @param limit [Integer] Max items to include in response (default 10)
    # @param icon [String] Heroicon name for UI
    # @param action_path [String] Path template for fixing items (use :id as placeholder)
    # @param check_name [String] Machine-readable check name (e.g., 'duplicate_emails')
    # @param auto_fixable [Boolean] Whether this issue can be auto-fixed (default false)
    # @param fix_type [String] The type of fix to apply (e.g., 'name_casing', 'website_prefix')
    def build_result(name:, severity:, items:, description: nil, limit: 10, icon: nil, action_path: nil, check_name: nil, auto_fixable: false, fix_type: nil)
      # Get count efficiently - use count(:all) for relations to avoid issues with custom select
      count = if items.is_a?(Array)
                items.size
      elsif items.respond_to?(:count)
                begin
                  items.count(:all)
                rescue StandardError => e
                  Rails.logger.debug "[HealthCheck] count(:all) failed, falling back to to_a.size: #{e.message}"
                  items.to_a.size
                end
      else
                items.to_a.size
      end

      items_array = items.respond_to?(:limit) ? items.limit(limit).to_a : Array(items).first(limit)

      {
        check_type: self.class.check_type,
        check_name: check_name,
        name: name,
        description: description,
        severity: severity.to_s,
        icon: icon,
        action_path: action_path,
        count: count,
        items: format_items(items_array),
        auto_fixable: auto_fixable,
        fix_type: fix_type,
        success: true
      }
    rescue StandardError => e
      Rails.logger.error "[HealthCheck] Error in #{name}: #{e.message}"
      {
        check_type: self.class.check_type,
        check_name: check_name,
        name: name,
        description: description,
        severity: severity.to_s,
        count: 0,
        items: [],
        auto_fixable: false,
        fix_type: nil,
        success: false,
        error: e.message
      }
    end

    # Format items for API response - override in subclass for custom formatting
    def format_items(items)
      items.map do |item|
        if item.is_a?(Hash)
          item
        elsif item.respond_to?(:id)
          { id: item.id, display: item_display_name(item) }
        else
          { display: item.to_s }
        end
      end
    end

    # Get display name for an item - override in subclass
    def item_display_name(item)
      DisplayValueResolver.resolve(item)
    end

    # Calculate health score from check results
    # @param results [Array<Hash>] Array of check results
    # @return [Integer] Health score 0-100
    def self.calculate_health_score(results)
      score = 100

      results.each do |result|
        severity = result[:severity]&.to_sym || :info
        weight = SEVERITY_WEIGHTS[severity] || SEVERITY_WEIGHTS[:info]
        count = result[:count] || 0

        penalty = [ count * weight[:penalty_per_issue], weight[:max_penalty] ].min
        score -= penalty
      end

      [ score, 0 ].max
    end

    # Sort results by severity (critical first)
    def self.sort_by_severity(results)
      results.sort_by { |r| SEVERITY_ORDER[r[:severity]] || 99 }
    end
  end
end
