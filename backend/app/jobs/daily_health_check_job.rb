# frozen_string_literal: true

# DailyHealthCheckJob - Daily data quality check and self-healing
#
# Runs at 6am Brisbane time daily to:
# 1. Run all health checks across the system
# 2. Auto-fix formatting issues (self-healing)
# 3. Cache health scores for fast dashboard loading
# 4. Award System kudos for auto-fixes
# 5. Generate alerts for critical issues
#
# The System earns kudos for auto-fixes, competing with humans
# on the leaderboard to motivate data quality fixes.
#
# Run via solid_queue recurring schedule
class DailyHealthCheckJob < ApplicationJob
  queue_as :low

  def perform
    # SSoT: Use CorporateCompanySetting for timezone
    Rails.logger.info "[DailyHealthCheck] Starting daily health check at #{CorporateCompanySetting.now}"

    start_time = Time.current
    results = {
      auto_fixes: 0,
      system_kudos: 0,
      health_checks_run: 0,
      issues_found: 0,
      critical_issues: 0
    }

    begin
      # 1. Run self-healing on all contacts with formatting issues
      results[:auto_fixes] += run_contact_self_healing
      results[:auto_fixes] += run_company_self_healing

      # 2. Run all health checks and cache results
      # Cache system-wide health
      system_health = HealthChecks::Registry.system_health
      HealthCheckCache.cache_system_health(system_health)
      results[:health_checks_run] = system_health[:summary][:total_checks]
      results[:issues_found] = system_health[:summary][:total_issues]
      results[:critical_issues] = system_health[:summary][:critical_issues]
      Rails.logger.info "[DailyHealthCheck] Cached system-wide health (score: #{system_health[:overall_health]})"

      # Cache individual foundation health checks
      # SSoT: Use slugs, not hardcoded numeric IDs (which differ per environment)
      foundation_slugs = %w[jobs pricebook-items contacts corporate_companies company_documents]
      foundations_cached = 0
      Foundation.where(slug: foundation_slugs).find_each do |foundation|
        begin
          result = HealthChecks::Registry.run_all(
            foundation_id: foundation.id,
            table_name: foundation.database_table_name
          )

          HealthCheckCache.cache_foundation_health(foundation.id, result)
          foundations_cached += 1

          Rails.logger.info "[DailyHealthCheck] Cached health for #{foundation.name} (ID: #{foundation.id}, score: #{result[:overall_health]})"
        rescue StandardError => e
          Rails.logger.error "[DailyHealthCheck] Error caching health for foundation #{foundation.id}: #{e.message}"
          Sentry.capture_exception(e) if defined?(Sentry)
        end
      end

      results[:foundations_cached] = foundations_cached

      # 3. Calculate system kudos earned
      results[:system_kudos] = HealthKudosEvent.by_system.today.sum(:points)

      # 4. Log summary
      duration = Time.current - start_time
      Rails.logger.info "[DailyHealthCheck] Complete in #{duration.round(2)}s. " \
                       "Auto-fixes: #{results[:auto_fixes]}, " \
                       "System Kudos: #{results[:system_kudos]}, " \
                       "Issues: #{results[:issues_found]} (#{results[:critical_issues]} critical)"

      # 5. Create alert if critical issues are high
      if results[:critical_issues] > 50
        Rails.logger.warn "[DailyHealthCheck] High critical issues: #{results[:critical_issues]}"
        # Could create a notification here
      end

      results
    rescue StandardError => e
      Rails.logger.error "[DailyHealthCheck] Error: #{e.message}"
      Rails.logger.error e.backtrace.first(10).join("\n")
      raise
    end
  end

  private

  # Run self-healing on contacts with formatting issues
  def run_contact_self_healing
    fixed_count = 0

    # Find contacts with name casing issues
    Contact.unscoped.where.not(first_name: nil).find_each(batch_size: 500) do |contact|
      next unless needs_name_fix?(contact)

      begin
        # The SelfHealing concern will auto-fix on save and award kudos
        contact.save(validate: false)
        fixed_count += 1
      rescue StandardError => e
        Rails.logger.error "[DailyHealthCheck] Failed to fix contact #{contact.id}: #{e.message}"
      end
    end

    Rails.logger.info "[DailyHealthCheck] Fixed #{fixed_count} contact name casing issues"
    fixed_count
  end

  # Run self-healing on companies with formatting issues
  def run_company_self_healing
    fixed_count = 0

    # Find companies with ABN/ACN formatting issues
    CorporateCompany.find_each(batch_size: 500) do |company|
      next unless needs_company_fix?(company)

      begin
        # The SelfHealing concern will auto-fix on save and award kudos
        company.save(validate: false)
        fixed_count += 1
      rescue StandardError => e
        Rails.logger.error "[DailyHealthCheck] Failed to fix company #{company.id}: #{e.message}"
      end
    end

    Rails.logger.info "[DailyHealthCheck] Fixed #{fixed_count} company formatting issues"
    fixed_count
  end

  def needs_name_fix?(contact)
    [ contact.first_name, contact.last_name ].compact.any? do |name|
      name.present? && (name == name.upcase || name == name.downcase)
    end
  end

  def needs_company_fix?(company)
    # Check ABN formatting (should be XX XXX XXX XXX)
    if company.abn.present?
      digits_only = company.abn.gsub(/\D/, "")
      return true if digits_only.length == 11 && company.abn != "#{digits_only[0..1]} #{digits_only[2..4]} #{digits_only[5..7]} #{digits_only[8..10]}"
    end

    # Check ACN formatting (should be XXX XXX XXX)
    if company.acn.present?
      digits_only = company.acn.gsub(/\D/, "")
      return true if digits_only.length == 9 && company.acn != "#{digits_only[0..2]} #{digits_only[3..5]} #{digits_only[6..8]}"
    end

    false
  end
end
