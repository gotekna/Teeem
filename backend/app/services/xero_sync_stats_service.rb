# frozen_string_literal: true

# SSoT: Xero sync stats computation service
#
# Problem: sync_stats endpoint runs 15N+13 queries for N credentials,
# which becomes 2.45M queries at 15,000 connections.
#
# Solution: Batch all queries into 5-7 aggregate queries regardless of N.
# This reduces query count from O(n) to O(1).
#
# Usage:
#   stats = XeroSyncStatsService.compute_all_stats(credential_ids)
#   # stats[:links][tenant_id] => link stats for that tenant
#   # stats[:invoices][tenant_id] => invoice stats for that tenant
#   # etc.
#
# Part of "Scale Xero Sync to 15k" plan
class XeroSyncStatsService
  class << self
    # Compute all stats for the given credential tenant IDs
    # Returns a hash with all pre-computed stats grouped by tenant_id
    def compute_all_stats(credentials)
      return empty_stats if credentials.empty?

      tenant_ids = credentials.map(&:tenant_id)

      {
        links: compute_link_stats(tenant_ids),
        invoices: compute_invoice_stats(tenant_ids),
        matches: compute_match_breakdown(tenant_ids),
        cross_tenant: compute_cross_tenant_stats(tenant_ids),
        unlinked: compute_unlinked_stats(tenant_ids),
        sync_health: compute_sync_health_batch(tenant_ids),
        rate_limits: compute_rate_limits_batch(tenant_ids)
      }
    end

    # Build tenant stats hash from pre-computed stats
    def build_tenant_stats(credential, stats)
      tenant_id = credential.tenant_id
      link_stat = stats[:links][tenant_id] || {}
      inv_stat = stats[:invoices][tenant_id] || {}
      match_stat = stats[:matches][tenant_id] || {}
      cross_count = stats[:cross_tenant][tenant_id] || 0
      unlinked_count = stats[:unlinked][tenant_id] || 0
      sync_health = stats[:sync_health][tenant_id] || default_sync_health
      rate_usage = stats[:rate_limits][tenant_id]

      {
        tenant_id: tenant_id,
        tenant_name: credential.tenant_name,
        status: credential.status,
        is_primary: credential.is_primary,
        sync_health: sync_health[:sync_types],
        overall_sync_health: sync_health[:overall_health],
        contacts: {
          total_links: link_stat[:total_links] || 0,
          sync_enabled: link_stat[:enabled_count] || 0,
          pending_review: link_stat[:pending_review] || 0,
          with_errors: link_stat[:with_errors] || 0,
          unlinked: unlinked_count,
          cross_tenant_matches: cross_count,
          last_synced_at: link_stat[:last_contact_sync]
        },
        documents: {
          invoices: inv_stat[:invoices] || 0,
          bills: inv_stat[:bills] || 0,
          quotes: inv_stat[:quotes] || 0,
          credit_notes: inv_stat[:credit_notes] || 0,
          total: (inv_stat[:invoices] || 0) + (inv_stat[:bills] || 0) +
                 (inv_stat[:quotes] || 0) + (inv_stat[:credit_notes] || 0),
          last_synced_at: inv_stat[:last_invoice_sync]
        },
        match_breakdown: {
          exact_abn: match_stat["exact_abn"] || 0,
          exact_email: match_stat["exact_email"] || 0,
          fuzzy_name: match_stat["fuzzy_name"] || 0,
          manual: match_stat["manual"] || 0
        },
        rate_limits: rate_usage ? {
          daily_percentage: rate_usage.dig(:daily, :percentage)&.round(1) || 0,
          minute_percentage: rate_usage.dig(:minute, :percentage)&.round(1) || 0,
          is_limited: (rate_usage.dig(:daily, :percentage) || 0) >= 80
        } : nil
      }
    end

    # Compute global statistics (across all tenants)
    def compute_global_stats(credentials)
      all_xero_links = ContactExternalLink.xero
      all_invoices = ExternalInvoice.xero.active.where.not(status: "draft")

      # Total pending reviews
      total_pending_reviews = all_xero_links.pending_review.count

      # Contacts linked to multiple Xero tenants
      multi_tenant_contact_ids = all_xero_links.group(:contact_id)
                                               .having("COUNT(DISTINCT xero_org_id) > 1")
                                               .pluck(:contact_id)

      # Global match type breakdown
      global_match_breakdown = all_xero_links.group(:match_type).count

      # Total unique contacts with any Xero link
      total_contacts_with_links = all_xero_links.distinct.count(:contact_id)

      # Total invoices/bills across all tenants
      invoice_counts = all_invoices.group(:invoice_type).count

      # Recent sync activity (last 24 hours)
      recent_contact_syncs = all_xero_links.where("last_synced_at > ?", 24.hours.ago).count
      recent_invoice_syncs = all_invoices.where("last_synced_at > ?", 24.hours.ago).count

      # Get pending review items with details
      pending_review_items = fetch_pending_review_items(credentials, all_xero_links)

      {
        pending_reviews: {
          count: total_pending_reviews,
          items: pending_review_items
        },
        cross_tenant: {
          contacts_linked_to_multiple_tenants: multi_tenant_contact_ids.count,
          multi_tenant_contact_ids: multi_tenant_contact_ids.first(100)
        },
        match_breakdown: {
          exact_abn: global_match_breakdown["exact_abn"] || 0,
          exact_email: global_match_breakdown["exact_email"] || 0,
          fuzzy_name: global_match_breakdown["fuzzy_name"] || 0,
          manual: global_match_breakdown["manual"] || 0,
          total: all_xero_links.count
        },
        totals: {
          contacts_with_links: total_contacts_with_links,
          total_links: all_xero_links.count,
          invoices: invoice_counts["sales_invoice"] || 0,
          bills: invoice_counts["bill"] || 0,
          quotes: invoice_counts["quote"] || 0,
          credit_notes: invoice_counts["credit_note"] || 0,
          all_documents: all_invoices.count
        },
        recent_activity: {
          contact_syncs_24h: recent_contact_syncs,
          invoice_syncs_24h: recent_invoice_syncs
        }
      }
    end

    private

    def empty_stats
      {
        links: {},
        invoices: {},
        matches: {},
        cross_tenant: {},
        unlinked: {},
        sync_health: {},
        rate_limits: {}
      }
    end

    # Single query for ALL contact link stats
    def compute_link_stats(tenant_ids)
      return {} if tenant_ids.empty?

      results = ContactExternalLink.xero
                                   .where(xero_org_id: tenant_ids)
                                   .group(:xero_org_id)
                                   .select(
                                     :xero_org_id,
                                     "COUNT(*) as total_links",
                                     "COUNT(*) FILTER (WHERE sync_enabled = true) as enabled_count",
                                     "COUNT(*) FILTER (WHERE needs_review = true) as pending_review",
                                     "COUNT(*) FILTER (WHERE sync_error IS NOT NULL) as with_errors",
                                     "MAX(last_synced_at) as last_contact_sync"
                                   )

      results.index_by(&:xero_org_id).transform_values do |row|
        {
          total_links: row.total_links,
          enabled_count: row.enabled_count,
          pending_review: row.pending_review,
          with_errors: row.with_errors,
          last_contact_sync: row.last_contact_sync
        }
      end
    end

    # Single query for ALL invoice stats
    def compute_invoice_stats(tenant_ids)
      return {} if tenant_ids.empty?

      results = ExternalInvoice.xero.active
                               .where(xero_org_id: tenant_ids)
                               .where.not(status: "draft")
                               .group(:xero_org_id)
                               .select(
                                 :xero_org_id,
                                 "COUNT(*) FILTER (WHERE invoice_type = 'sales_invoice') as invoices",
                                 "COUNT(*) FILTER (WHERE invoice_type = 'bill') as bills",
                                 "COUNT(*) FILTER (WHERE invoice_type = 'quote') as quotes",
                                 "COUNT(*) FILTER (WHERE invoice_type = 'credit_note') as credit_notes",
                                 "MAX(last_synced_at) as last_invoice_sync"
                               )

      results.index_by(&:xero_org_id).transform_values do |row|
        {
          invoices: row.invoices,
          bills: row.bills,
          quotes: row.quotes,
          credit_notes: row.credit_notes,
          last_invoice_sync: row.last_invoice_sync
        }
      end
    end

    # Single query for ALL match breakdowns
    def compute_match_breakdown(tenant_ids)
      return {} if tenant_ids.empty?

      results = ContactExternalLink.xero
                                   .where(xero_org_id: tenant_ids)
                                   .group(:xero_org_id, :match_type)
                                   .count

      # Transform from {[tenant_id, match_type] => count} to {tenant_id => {match_type => count}}
      results.each_with_object({}) do |((tenant_id, match_type), count), hash|
        hash[tenant_id] ||= {}
        hash[tenant_id][match_type] = count
      end
    end

    # Single query for cross-tenant contact counts
    def compute_cross_tenant_stats(tenant_ids)
      return {} if tenant_ids.empty?

      # For each tenant, count contacts that also exist in OTHER tenants
      sql = <<-SQL.squish
        SELECT
          cel.xero_org_id,
          COUNT(DISTINCT cel.contact_id) as cross_tenant_count
        FROM contact_external_links cel
        INNER JOIN contact_external_links cel2
          ON cel2.contact_id = cel.contact_id
          AND cel2.xero_org_id != cel.xero_org_id
          AND cel2.source = 'xero'
        WHERE cel.source = 'xero'
          AND cel.xero_org_id IN (#{tenant_ids.map { |id| ActiveRecord::Base.connection.quote(id) }.join(',')})
        GROUP BY cel.xero_org_id
      SQL

      ActiveRecord::Base.connection.execute(sql).each_with_object({}) do |row, hash|
        hash[row["xero_org_id"]] = row["cross_tenant_count"].to_i
      end
    end

    # Single query for unlinked counts (contacts that are inactive/deleted in TEEEM)
    def compute_unlinked_stats(tenant_ids)
      return {} if tenant_ids.empty?

      results = ContactExternalLink.xero
                                   .where(xero_org_id: tenant_ids)
                                   .joins("LEFT JOIN contacts c ON contact_external_links.contact_id = c.id AND (c.is_active = true OR c.is_active IS NULL)")
                                   .where("c.id IS NULL")
                                   .group(:xero_org_id)
                                   .count

      results
    end

    # Batch compute sync health for all tenants
    def compute_sync_health_batch(tenant_ids)
      return {} if tenant_ids.empty?

      # Load all sync status records for these tenants
      statuses = XeroSyncStatus.where(tenant_id: tenant_ids)
                               .order(last_synced_at: :desc)
                               .to_a

      # Group by tenant_id
      statuses_by_tenant = statuses.group_by(&:tenant_id)

      tenant_ids.each_with_object({}) do |tenant_id, hash|
        tenant_statuses = statuses_by_tenant[tenant_id] || []
        hash[tenant_id] = compute_health_for_statuses(tenant_statuses)
      end
    end

    # Compute health summary for a set of statuses (adapted from XeroSyncStatus.health_summary)
    def compute_health_for_statuses(statuses)
      sync_thresholds = {
        "invoices" => { stale: 10.minutes, critical: 15.minutes },
        "contacts" => { stale: 30.minutes, critical: 45.minutes },
        "pdfs" => { stale: 4.hours, critical: 6.hours },
        "bank_transactions" => { stale: 12.hours, critical: 18.hours }
      }

      result = {}
      health_statuses = []

      XeroSyncStatus::SYNC_TYPES.each do |sync_type|
        status = statuses.find { |s| s.sync_type == sync_type }
        thresholds = sync_thresholds[sync_type] || { stale: 45.minutes, critical: 90.minutes }

        if status
          last_synced = status.last_synced_at
          age_seconds = last_synced ? (Time.current - last_synced).to_i : nil
          age_minutes = age_seconds ? (age_seconds / 60.0).round(1) : nil

          health_status = if age_seconds.nil?
            "red"
          elsif age_seconds <= thresholds[:stale]
            "green"
          elsif age_seconds <= thresholds[:critical]
            "yellow"
          else
            "red"
          end

          is_stale = age_seconds.nil? || age_seconds > thresholds[:stale]
          health_statuses << health_status

          result[sync_type] = {
            status: status.status,
            health_status: health_status,
            stale: is_stale,
            last_synced_at: status.last_synced_at&.iso8601,
            age_seconds: age_seconds,
            age_minutes: age_minutes,
            next_sync_at: status.next_sync_at&.iso8601,
            records_synced: status.records_synced,
            last_error: status.last_error,
            message: is_stale ? "Sync stale: #{age_minutes || '∞'} min ago" : "Healthy"
          }
        else
          health_statuses << "red"
          result[sync_type] = {
            status: nil,
            health_status: "red",
            stale: true,
            last_synced_at: nil,
            age_seconds: nil,
            age_minutes: nil,
            next_sync_at: nil,
            records_synced: nil,
            last_error: nil,
            message: "No sync status record found"
          }
        end
      end

      overall_health = if health_statuses.include?("red")
        "red"
      elsif health_statuses.include?("yellow")
        "yellow"
      else
        "green"
      end

      {
        sync_types: result,
        overall_health: overall_health
      }
    end

    def default_sync_health
      {
        sync_types: {},
        overall_health: "red"
      }
    end

    # Batch compute rate limits for all tenants
    def compute_rate_limits_batch(tenant_ids)
      return {} if tenant_ids.empty?

      tenant_ids.each_with_object({}) do |tenant_id, hash|
        hash[tenant_id] = XeroRateLimitTracker.usage_for(tenant_id) rescue nil
      end
    end

    # Fetch pending review items with details (limited to 10)
    def fetch_pending_review_items(credentials, all_xero_links)
      all_xero_links.pending_review
                    .includes(:contact)
                    .limit(10)
                    .map do |link|
        tenant = credentials.find { |c| c.tenant_id == link.xero_org_id }
        xero_name = link.external_name ||
                    link.metadata&.dig("name") ||
                    ExternalInvoice.where(external_contact_id: link.external_contact_id, xero_org_id: link.xero_org_id)
                                   .where.not(contact_name: nil)
                                   .limit(1)
                                   .pick(:contact_name) ||
                    link.external_contact_id

        {
          id: link.id,
          contact_id: link.contact_id,
          contact_name: link.contact&.display_name,
          tenant_id: link.xero_org_id,
          tenant_name: tenant&.tenant_name || link.tenant_name,
          external_contact_id: link.external_contact_id,
          external_contact_name: xero_name,
          match_type: link.match_type,
          match_confidence: link.match_confidence,
          created_at: link.created_at
        }
      end
    end
  end
end
