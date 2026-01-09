# Job to refresh materialized views for the data warehouse
# Can refresh all views or specific ones
class RefreshMaterializedViewsJob < ApplicationJob
  queue_as :low

  # Available materialized views
  # Note: Views with unique indexes can use CONCURRENTLY, others cannot
  VIEWS = {
    # Core views
    job_summary: { name: "mv_job_summary", concurrent: true },
    financial_summary: { name: "mv_financial_summary", concurrent: false },
    document_summary: { name: "mv_document_summary", concurrent: false },
    document_completeness: { name: "mv_document_completeness", concurrent: false },
    invoice_po_reconciliation: { name: "mv_invoice_po_reconciliation", concurrent: true },
    resource_utilization: { name: "mv_resource_utilization", concurrent: false },
    job_document_status: { name: "mv_job_document_status", concurrent: true },
    task_metrics: { name: "mv_task_metrics", concurrent: false },
    # Time-based rollup views
    financial_summary_weekly: { name: "mv_financial_summary_weekly", concurrent: false },
    financial_summary_quarterly: { name: "mv_financial_summary_quarterly", concurrent: false },
    financial_summary_yearly: { name: "mv_financial_summary_yearly", concurrent: false },
    job_summary_monthly: { name: "mv_job_summary_monthly", concurrent: false }
  }.freeze

  # Fast views that use CONCURRENTLY (no table locks, safe during business hours)
  FAST_VIEWS = %i[job_summary job_document_status invoice_po_reconciliation].freeze

  # Refresh one, multiple, or all materialized views
  # @param view_names [Symbol, String, Array, nil] - :all, :fast, :job_summary, or [:job_summary, :document_summary]
  def perform(view_names = :all)
    views_to_refresh = resolve_views(view_names)
    Rails.logger.info("[Warehouse] Starting refresh of #{views_to_refresh.keys.join(', ')}")

    results = {}

    views_to_refresh.each do |key, config|
      view = config[:name]
      use_concurrent = config[:concurrent]

      # Start logging the refresh
      log = start_refresh_log(view)

      begin
        refresh_view(view, concurrently: use_concurrent)

        # Complete the log entry
        complete_refresh_log(log)

        results[view] = {
          success: true,
          duration_ms: (log.duration_seconds * 1000).round,
          row_count: log.row_count
        }
        Rails.logger.info("[Warehouse] Refreshed #{view} in #{results[view][:duration_ms]}ms (#{log.row_count} rows)")
      rescue StandardError => e
        # Log the failure
        fail_refresh_log(log, e.message)

        results[view] = {
          success: false,
          error: e.message
        }
        Rails.logger.error("[Warehouse] Failed to refresh #{view}: #{e.message}")
      end
    end

    # Run data quality checks after refresh
    run_quality_checks(views_to_refresh.values.map { |c| c[:name] })

    results
  end

  private

  def resolve_views(view_names)
    case view_names
    when :all, "all"
      VIEWS
    when :fast, "fast"
      VIEWS.slice(*FAST_VIEWS)
    when Array
      # Accept array of view names
      selected = {}
      view_names.each do |name|
        key = name.to_sym
        raise ArgumentError, "Unknown view: #{name}. Available: #{VIEWS.keys.join(', ')}" unless VIEWS.key?(key)
        selected[key] = VIEWS[key]
      end
      selected
    else
      # Single view name
      key = view_names.to_sym
      view_config = VIEWS[key]
      raise ArgumentError, "Unknown view: #{view_names}. Available: #{VIEWS.keys.join(', ')}" unless view_config
      { key => view_config }
    end
  end

  def refresh_view(view_name, concurrently:)
    # Sanitize view name to prevent SQL injection
    safe_view_name = ActiveRecord::Base.connection.quote_table_name(view_name)
    sql = if concurrently
            "REFRESH MATERIALIZED VIEW CONCURRENTLY #{safe_view_name}"
    else
            "REFRESH MATERIALIZED VIEW #{safe_view_name}"
    end

    ActiveRecord::Base.connection.execute(sql)
  end

  def start_refresh_log(view_name)
    return nil unless defined?(MvRefreshLog)

    MvRefreshLog.start_refresh(view_name, triggered_by: "scheduled")
  rescue StandardError => e
    Rails.logger.warn("[Warehouse] Failed to start refresh log for #{view_name}: #{e.message}")
    nil
  end

  def complete_refresh_log(log)
    return unless log

    log.complete!
  rescue StandardError => e
    Rails.logger.warn("[Warehouse] Failed to complete refresh log: #{e.message}")
  end

  def fail_refresh_log(log, error_message)
    return unless log

    log.fail!(error_message)
  rescue StandardError => e
    Rails.logger.warn("[Warehouse] Failed to record refresh failure: #{e.message}")
  end

  def run_quality_checks(view_names)
    return unless defined?(DataQualityCheckJob)

    # Queue quality checks asynchronously to not block refresh completion
    DataQualityCheckJob.perform_later
  rescue StandardError => e
    Rails.logger.warn("[Warehouse] Failed to queue quality checks: #{e.message}")
  end
end
