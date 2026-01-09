# Create additional analytics views for Schedule Management and Job Document Status
# Sprint 5 & 6: Financial enhancements, Resource utilization, Job document status
class CreateWarehouseAnalyticsViews < ActiveRecord::Migration[8.0]
  def up
    # ============================================
    # MV_RESOURCE_UTILIZATION - Resource hours by week
    # Tracks time entries and allocations per resource
    # ============================================
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_resource_utilization AS
      SELECT
        sr.id as resource_id,
        sr.name as resource_name,
        sr.resource_type,
        sr.trade,
        sr.hourly_rate,
        sr.is_active,
        t.job_id,
        j.title as job_title,
        DATE_TRUNC('week', ste.entry_date)::date as week_start,
        COUNT(DISTINCT ste.id) as entry_count,
        COALESCE(SUM(ste.total_hours), 0) as hours_logged,
        COALESCE(SUM(ste.total_hours) FILTER (WHERE ste.approved_at IS NOT NULL), 0) as approved_hours,
        COALESCE(SUM(ste.total_hours) FILTER (WHERE ste.approved_at IS NULL), 0) as pending_hours,
        COUNT(DISTINCT ste.task_id) as tasks_worked,
        COALESCE(SUM(ste.total_hours * sr.hourly_rate), 0) as labor_cost,
        NOW() as refreshed_at
      FROM sm_resources sr
      LEFT JOIN sm_time_entries ste ON ste.resource_id = sr.id
      LEFT JOIN tasks t ON t.id = ste.task_id
      LEFT JOIN jobs j ON j.id = t.job_id
      WHERE ste.entry_date IS NOT NULL
      GROUP BY
        sr.id,
        sr.name,
        sr.resource_type,
        sr.trade,
        sr.hourly_rate,
        sr.is_active,
        t.job_id,
        j.title,
        DATE_TRUNC('week', ste.entry_date)
      WITH DATA;

      CREATE INDEX ON mv_resource_utilization(resource_id);
      CREATE INDEX ON mv_resource_utilization(job_id);
      CREATE INDEX ON mv_resource_utilization(week_start);
      CREATE INDEX ON mv_resource_utilization(resource_type);
      CREATE INDEX ON mv_resource_utilization(trade);
    SQL

    # ============================================
    # MV_JOB_DOCUMENT_STATUS - Document completeness per job
    # Shows contracts, POs, invoices, emails per job
    # Note: company_documents links to jobs via documentable polymorphic (Job) or via PO/Invoice
    # ============================================
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_job_document_status AS
      SELECT
        j.id as job_id,
        j.title as job_title,
        js.name as job_status,
        jt.name as job_type,
        -- Job-level documents (via polymorphic documentable = Job)
        COUNT(DISTINCT cd_job.id) as job_document_count,
        COUNT(DISTINCT cd_job.id) FILTER (WHERE cd_job.ai_verification_status = 'verified') as verified_document_count,
        -- PO document status
        COUNT(DISTINCT cd_po.id) as po_document_count,
        -- Invoice document status
        COUNT(DISTINCT cd_inv.id) as invoice_document_count,
        -- PO metrics
        COUNT(DISTINCT po.id) as po_count,
        COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'approved') as approved_po_count,
        COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'sent') as sent_po_count,
        COALESCE(SUM(DISTINCT po.total), 0) as total_po_value,
        -- Invoice metrics
        COUNT(DISTINCT ei.id) as invoice_count,
        COUNT(DISTINCT ei.id) FILTER (WHERE ei.invoice_type = 'sales_invoice') as sales_invoice_count,
        COUNT(DISTINCT ei.id) FILTER (WHERE ei.invoice_type = 'bill') as bill_count,
        COALESCE(SUM(ei.total), 0) as total_invoiced,
        COALESCE(SUM(ei.amount_paid), 0) as total_paid,
        -- Email metrics
        COUNT(DISTINCT ew.id) as email_count,
        MAX(ew.received_at) as last_email_date,
        -- Overall completeness indicators
        CASE
          WHEN (COUNT(DISTINCT cd_job.id) + COUNT(DISTINCT cd_po.id) + COUNT(DISTINCT cd_inv.id)) > 0 AND COUNT(DISTINCT po.id) > 0 THEN 'complete'
          WHEN (COUNT(DISTINCT cd_job.id) + COUNT(DISTINCT cd_po.id) + COUNT(DISTINCT cd_inv.id)) > 0 OR COUNT(DISTINCT po.id) > 0 THEN 'partial'
          ELSE 'missing'
        END as documentation_status,
        NOW() as refreshed_at
      FROM jobs j
      LEFT JOIN job_status js ON js.id = j.job_status_id
      LEFT JOIN job_types jt ON jt.id = j.job_type_id
      -- Job-level documents (via polymorphic documentable = 'Job')
      LEFT JOIN company_documents cd_job ON cd_job.documentable_type = 'Job' AND cd_job.documentable_id = j.id
      -- PO documents (via polymorphic)
      LEFT JOIN purchase_orders po ON po.job_id = j.id
      LEFT JOIN company_documents cd_po ON cd_po.documentable_type = 'PurchaseOrder' AND cd_po.documentable_id = po.id
      -- Invoice documents (via polymorphic)
      LEFT JOIN external_invoices ei ON ei.job_id = j.id
      LEFT JOIN company_documents cd_inv ON cd_inv.documentable_type = 'ExternalInvoice' AND cd_inv.documentable_id = ei.id
      -- Emails
      LEFT JOIN email_warehouse ew ON ew.job_id = j.id
      GROUP BY
        j.id,
        j.title,
        js.name,
        jt.name
      WITH DATA;

      CREATE UNIQUE INDEX ON mv_job_document_status(job_id);
      CREATE INDEX ON mv_job_document_status(job_status);
      CREATE INDEX ON mv_job_document_status(job_type);
      CREATE INDEX ON mv_job_document_status(documentation_status);
    SQL

    # ============================================
    # MV_TASK_METRICS - Task completion metrics by job
    # ============================================
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_task_metrics AS
      SELECT
        t.job_id,
        j.title as job_title,
        js.name as job_status,
        DATE_TRUNC('week', t.start_date)::date as week_start,
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE t.status = 'completed') as completed_tasks,
        COUNT(*) FILTER (WHERE t.status = 'in_progress') as in_progress_tasks,
        COUNT(*) FILTER (WHERE t.status = 'pending' OR t.status IS NULL) as pending_tasks,
        COUNT(*) FILTER (WHERE t.is_hold_task = true) as hold_tasks,
        -- Duration metrics
        AVG(t.duration_days) as avg_duration_days,
        SUM(t.duration_days) as total_duration_days,
        -- Time entry metrics
        COALESCE(SUM(ste.total_hours), 0) as total_hours_logged,
        COALESCE(SUM(ste.total_hours) FILTER (WHERE ste.approved_at IS NOT NULL), 0) as approved_hours,
        -- Completion rate
        CASE
          WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE t.status = 'completed')::numeric / COUNT(*) * 100, 1)
          ELSE 0
        END as completion_rate,
        NOW() as refreshed_at
      FROM tasks t
      INNER JOIN jobs j ON j.id = t.job_id
      LEFT JOIN job_status js ON js.id = j.job_status_id
      LEFT JOIN sm_time_entries ste ON ste.task_id = t.id
      GROUP BY
        t.job_id,
        j.title,
        js.name,
        DATE_TRUNC('week', t.start_date)
      WITH DATA;

      CREATE INDEX ON mv_task_metrics(job_id);
      CREATE INDEX ON mv_task_metrics(week_start);
      CREATE INDEX ON mv_task_metrics(job_status);
    SQL
  end

  def down
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_task_metrics CASCADE"
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_job_document_status CASCADE"
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_resource_utilization CASCADE"
  end
end
