# Job to refresh materialized views for the data warehouse
# Can refresh all views or specific ones
class RefreshMaterializedViewsJob < ApplicationJob
  queue_as :low

  # Available materialized views
  # Note: Views with unique indexes can use CONCURRENTLY, others cannot
  VIEWS = {
    # Core views
    job_summary: { name: 'mv_job_summary', concurrent: true },
    financial_summary: { name: 'mv_financial_summary', concurrent: false },
    document_summary: { name: 'mv_document_summary', concurrent: false },
    document_completeness: { name: 'mv_document_completeness', concurrent: false },
    invoice_po_reconciliation: { name: 'mv_invoice_po_reconciliation', concurrent: true },
    resource_utilization: { name: 'mv_resource_utilization', concurrent: false },
    job_document_status: { name: 'mv_job_document_status', concurrent: true },
    task_metrics: { name: 'mv_task_metrics', concurrent: false },
    # Time-based rollup views
    financial_summary_weekly: { name: 'mv_financial_summary_weekly', concurrent: false },
    financial_summary_quarterly: { name: 'mv_financial_summary_quarterly', concurrent: false },
    financial_summary_yearly: { name: 'mv_financial_summary_yearly', concurrent: false },
    job_summary_monthly: { name: 'mv_job_summary_monthly', concurrent: false }
  }.freeze

  # Refresh one or all materialized views
  # @param view_name [Symbol, String, nil] - :all, :job_summary, :financial_summary, :document_summary, :document_completeness
  def perform(view_name = :all)
    views_to_refresh = case view_name.to_sym
                       when :all then VIEWS
                       else
                         view_config = VIEWS[view_name.to_sym]
                         raise ArgumentError, "Unknown view: #{view_name}. Available: #{VIEWS.keys.join(', ')}" unless view_config
                         { view_name.to_sym => view_config }
                       end

    results = {}

    views_to_refresh.each do |key, config|
      view = config[:name]
      use_concurrent = config[:concurrent]
      start_time = Time.current
      begin
        refresh_view(view, concurrently: use_concurrent)
        results[view] = {
          success: true,
          duration_ms: ((Time.current - start_time) * 1000).round
        }
        Rails.logger.info("[Warehouse] Refreshed #{view} in #{results[view][:duration_ms]}ms")
      rescue StandardError => e
        results[view] = {
          success: false,
          error: e.message
        }
        Rails.logger.error("[Warehouse] Failed to refresh #{view}: #{e.message}")
      end
    end

    results
  end

  private

  def refresh_view(view_name, concurrently:)
    sql = if concurrently
            "REFRESH MATERIALIZED VIEW CONCURRENTLY #{view_name}"
          else
            "REFRESH MATERIALIZED VIEW #{view_name}"
          end

    ActiveRecord::Base.connection.execute(sql)
  end
end
