# Create Materialized Views for Data Warehouse (Gold Layer)
# These views pre-compute analytics for fast dashboard queries
class CreateMaterializedViews < ActiveRecord::Migration[8.0]
  def up
    # ============================================
    # MV_JOB_SUMMARY - Per-job metrics
    # Note: Jobs don't have company_id - they're standalone entities
    # ============================================
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_job_summary AS
      SELECT
        j.id as job_id,
        j.title as job_title,
        js.name as job_status,
        jt.name as job_type,
        -- Financial metrics
        COUNT(DISTINCT ft.id) as transaction_count,
        COALESCE(SUM(CASE WHEN ft.transaction_type = 'income' THEN ft.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN ft.transaction_type = 'expense' THEN ft.amount ELSE 0 END), 0) as total_expenses,
        -- Task metrics
        COUNT(DISTINCT t.id) as task_count,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed') as completed_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'in_progress') as in_progress_tasks,
        -- Time entry metrics
        COALESCE(SUM(ste.total_hours), 0) as total_hours_logged,
        COALESCE(SUM(ste.total_hours) FILTER (WHERE ste.approved_at IS NOT NULL), 0) as approved_hours,
        -- Email metrics
        COUNT(DISTINCT ew.id) as email_count,
        -- Purchase order metrics
        COUNT(DISTINCT po.id) as po_count,
        COALESCE(SUM(po.total), 0) as total_po_value,
        -- Invoice metrics
        COUNT(DISTINCT ei.id) as invoice_count,
        COALESCE(SUM(ei.total), 0) as total_invoiced,
        -- Last activity dates
        MAX(ft.transaction_date) as last_transaction_date,
        MAX(ste.entry_date) as last_time_entry_date,
        MAX(ew.received_at) as last_email_date,
        -- Refresh timestamp
        NOW() as refreshed_at
      FROM jobs j
      LEFT JOIN job_status js ON js.id = j.job_status_id
      LEFT JOIN job_types jt ON jt.id = j.job_type_id
      LEFT JOIN financial_transactions ft ON ft.job_id = j.id
      LEFT JOIN tasks t ON t.job_id = j.id
      LEFT JOIN sm_time_entries ste ON ste.task_id = t.id
      LEFT JOIN email_warehouse ew ON ew.job_id = j.id
      LEFT JOIN purchase_orders po ON po.job_id = j.id
      LEFT JOIN external_invoices ei ON ei.job_id = j.id
      GROUP BY j.id, j.title, js.name, jt.name
      WITH DATA;

      -- Unique index required for CONCURRENTLY refresh
      CREATE UNIQUE INDEX ON mv_job_summary(job_id);
      CREATE INDEX ON mv_job_summary(job_status);
      CREATE INDEX ON mv_job_summary(job_type);
    SQL

    # ============================================
    # MV_FINANCIAL_SUMMARY - Financial metrics by period
    # ============================================
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_financial_summary AS
      SELECT
        company_id,
        DATE_TRUNC('month', transaction_date) as period,
        transaction_type,
        category,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        NOW() as refreshed_at
      FROM financial_transactions
      WHERE status = 'posted'
      GROUP BY company_id, DATE_TRUNC('month', transaction_date), transaction_type, category
      WITH DATA;

      CREATE INDEX ON mv_financial_summary(company_id, period);
      CREATE INDEX ON mv_financial_summary(period);
      CREATE INDEX ON mv_financial_summary(transaction_type);
    SQL

    # ============================================
    # MV_DOCUMENT_SUMMARY - Document metrics
    # ============================================
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_document_summary AS
      SELECT
        cd.company_id,
        cd.company_code,
        cd.document_type,
        dt.category as document_category,
        dt.primary_tab,
        cd.folder,
        cd.source,
        cd.ai_verification_status,
        EXTRACT(YEAR FROM cd.document_date)::integer as document_year,
        COUNT(*) as document_count,
        COUNT(*) FILTER (WHERE cd.file_url IS NOT NULL OR cd.onedrive_file_id IS NOT NULL) as with_file_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'verified') as verified_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'mismatch') as mismatch_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'pending' OR cd.ai_verification_status IS NULL) as pending_count,
        MAX(cd.created_at) as latest_upload,
        COALESCE(SUM(cd.file_size), 0) as total_file_size_bytes,
        NOW() as refreshed_at
      FROM company_documents cd
      LEFT JOIN document_types dt ON dt.id = cd.document_type_id
      GROUP BY
        cd.company_id,
        cd.company_code,
        cd.document_type,
        dt.category,
        dt.primary_tab,
        cd.folder,
        cd.source,
        cd.ai_verification_status,
        EXTRACT(YEAR FROM cd.document_date)
      WITH DATA;

      CREATE INDEX ON mv_document_summary(company_id);
      CREATE INDEX ON mv_document_summary(company_code);
      CREATE INDEX ON mv_document_summary(document_type);
      CREATE INDEX ON mv_document_summary(document_year);
      CREATE INDEX ON mv_document_summary(document_category);
      CREATE INDEX ON mv_document_summary(ai_verification_status);
    SQL
  end

  def down
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_document_summary CASCADE"
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_financial_summary CASCADE"
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_job_summary CASCADE"
  end
end
