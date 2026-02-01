# Job to capture daily snapshots of job metrics for historical trend analysis
# Designed to run once per day (overnight via recurring job)
# Uses mv_job_summary and mv_job_document_status materialized views for efficiency
class DailyJobSnapshotJob < ApplicationJob
  queue_as :low

  # Capture snapshots for all active jobs (or specific job)
  # @param job_id [Integer, nil] - Optional: capture snapshot for specific job only
  # @param snapshot_date [Date] - Date for the snapshot (default: today)
  def perform(job_id: nil, snapshot_date: Date.current)
    results = { captured: 0, skipped: 0, errors: [] }

    # Refresh materialized views first to ensure fresh data
    RefreshMaterializedViewsJob.new.perform(:job_summary)
    RefreshMaterializedViewsJob.new.perform(:job_document_status)

    # Get jobs to snapshot
    jobs_scope = job_id.present? ? Job.where(id: job_id) : Job.all

    jobs_scope.find_each do |job|
      begin
        # Skip if already captured for this date
        if FactJobDailySnapshot.exists?(job_id: job.id, snapshot_date: snapshot_date)
          results[:skipped] += 1
          next
        end

        capture_snapshot(job, snapshot_date)
        results[:captured] += 1
      rescue StandardError => e
        results[:errors] << { job_id: job.id, error: e.message }
        Rails.logger.error("[DailySnapshot] Error capturing job #{job.id}: #{e.message}")
      end
    end

    Rails.logger.info("[DailySnapshot] Complete for #{snapshot_date}: #{results.slice(:captured, :skipped)}")
    results
  end

  private

  def capture_snapshot(job, snapshot_date)
    # Get pre-computed metrics from materialized views
    job_summary = MvJobSummary.find_by(job_id: job.id)

    # Calculate financial metrics
    total_income = job_summary&.total_income.to_d || 0
    total_expenses = job_summary&.total_expenses.to_d || 0
    profit = total_income - total_expenses
    profit_margin = total_income > 0 ? (profit / total_income * 100).round(2) : nil

    # Task completion rate from mv_job_summary
    task_count = job_summary&.task_count.to_i || 0
    completed_tasks = job_summary&.completed_tasks.to_i || 0
    completion_rate = task_count > 0 ? (completed_tasks.to_f / task_count * 100).round(1) : nil

    FactJobDailySnapshot.create!(
      snapshot_date: snapshot_date,
      job_id: job.id,

      # Financial
      total_income: total_income,
      total_expenses: total_expenses,
      profit: profit,
      profit_margin: profit_margin,

      # POs
      po_count: job_summary&.po_count.to_i || 0,
      po_total_value: job_summary&.total_po_value.to_d || 0,
      po_invoiced_amount: 0, # Would need additional query

      # Invoices
      invoice_count: job_summary&.invoice_count.to_i || 0,
      invoiced_total: job_summary&.total_invoiced.to_d || 0,
      paid_total: doc_status&.total_paid.to_d || 0,

      # Documents
      document_count: (doc_status&.job_document_count.to_i || 0) +
                      (doc_status&.po_document_count.to_i || 0) +
                      (doc_status&.invoice_document_count.to_i || 0),
      verified_document_count: doc_status&.verified_document_count.to_i || 0,
      email_count: job_summary&.email_count.to_i || doc_status&.email_count.to_i || 0,

      # Tasks
      task_count: task_count,
      completed_task_count: completed_tasks,
      in_progress_task_count: job_summary&.in_progress_tasks.to_i || 0,
      hours_logged: job_summary&.total_hours_logged.to_d || 0,
      approved_hours: job_summary&.approved_hours.to_d || 0,
      completion_rate: completion_rate,

      # Status
      job_status: job_summary&.job_status || doc_status&.job_status,
      job_type: job_summary&.job_type || doc_status&.job_type
    )
  end
end
