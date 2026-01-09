# Create time-based rollup materialized views for faster dashboard queries
# These aggregate the monthly mv_financial_summary into weekly, quarterly, and yearly views
class CreateTimeRollupMaterializedViews < ActiveRecord::Migration[8.0]
  def up
    # ============================================
    # MV_FINANCIAL_SUMMARY_WEEKLY - Weekly financial rollups
    # ============================================
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_financial_summary_weekly AS
      SELECT
        company_id,
        DATE_TRUNC('week', transaction_date) as week_start,
        DATE_TRUNC('week', transaction_date) + INTERVAL '6 days' as week_end,
        EXTRACT(WEEK FROM transaction_date)::integer as week_number,
        EXTRACT(YEAR FROM transaction_date)::integer as year,
        transaction_type,
        category,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount,
        NOW() as refreshed_at
      FROM financial_transactions
      WHERE status = 'posted'
      GROUP BY
        company_id,
        DATE_TRUNC('week', transaction_date),
        EXTRACT(WEEK FROM transaction_date),
        EXTRACT(YEAR FROM transaction_date),
        transaction_type,
        category
      WITH DATA;

      CREATE INDEX ON mv_financial_summary_weekly(company_id, week_start);
      CREATE INDEX ON mv_financial_summary_weekly(week_start);
      CREATE INDEX ON mv_financial_summary_weekly(year, week_number);
      CREATE INDEX ON mv_financial_summary_weekly(transaction_type);
    SQL

    # ============================================
    # MV_FINANCIAL_SUMMARY_QUARTERLY - Quarterly financial rollups
    # ============================================
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_financial_summary_quarterly AS
      SELECT
        company_id,
        DATE_TRUNC('quarter', transaction_date) as quarter_start,
        DATE_TRUNC('quarter', transaction_date) + INTERVAL '3 months' - INTERVAL '1 day' as quarter_end,
        EXTRACT(QUARTER FROM transaction_date)::integer as quarter_number,
        EXTRACT(YEAR FROM transaction_date)::integer as year,
        'Q' || EXTRACT(QUARTER FROM transaction_date)::text || ' ' || EXTRACT(YEAR FROM transaction_date)::text as quarter_label,
        transaction_type,
        category,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount,
        -- Period-over-period comparison helpers
        COUNT(DISTINCT DATE_TRUNC('week', transaction_date)) as weeks_with_activity,
        COUNT(DISTINCT DATE_TRUNC('month', transaction_date)) as months_with_activity,
        NOW() as refreshed_at
      FROM financial_transactions
      WHERE status = 'posted'
      GROUP BY
        company_id,
        DATE_TRUNC('quarter', transaction_date),
        EXTRACT(QUARTER FROM transaction_date),
        EXTRACT(YEAR FROM transaction_date),
        transaction_type,
        category
      WITH DATA;

      CREATE INDEX ON mv_financial_summary_quarterly(company_id, quarter_start);
      CREATE INDEX ON mv_financial_summary_quarterly(quarter_start);
      CREATE INDEX ON mv_financial_summary_quarterly(year, quarter_number);
      CREATE INDEX ON mv_financial_summary_quarterly(quarter_label);
      CREATE INDEX ON mv_financial_summary_quarterly(transaction_type);
    SQL

    # ============================================
    # MV_FINANCIAL_SUMMARY_YEARLY - Yearly financial rollups
    # ============================================
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_financial_summary_yearly AS
      SELECT
        company_id,
        DATE_TRUNC('year', transaction_date) as year_start,
        DATE_TRUNC('year', transaction_date) + INTERVAL '1 year' - INTERVAL '1 day' as year_end,
        EXTRACT(YEAR FROM transaction_date)::integer as year,
        transaction_type,
        category,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount,
        -- Period activity metrics
        COUNT(DISTINCT DATE_TRUNC('quarter', transaction_date)) as quarters_with_activity,
        COUNT(DISTINCT DATE_TRUNC('month', transaction_date)) as months_with_activity,
        COUNT(DISTINCT DATE_TRUNC('week', transaction_date)) as weeks_with_activity,
        -- First and last transaction dates in period
        MIN(transaction_date) as first_transaction_date,
        MAX(transaction_date) as last_transaction_date,
        NOW() as refreshed_at
      FROM financial_transactions
      WHERE status = 'posted'
      GROUP BY
        company_id,
        DATE_TRUNC('year', transaction_date),
        EXTRACT(YEAR FROM transaction_date),
        transaction_type,
        category
      WITH DATA;

      CREATE INDEX ON mv_financial_summary_yearly(company_id, year_start);
      CREATE INDEX ON mv_financial_summary_yearly(year_start);
      CREATE INDEX ON mv_financial_summary_yearly(year);
      CREATE INDEX ON mv_financial_summary_yearly(transaction_type);
    SQL

    # ============================================
    # MV_JOB_SUMMARY_MONTHLY - Monthly job metrics rollup
    # ============================================
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_job_summary_monthly AS
      SELECT
        DATE_TRUNC('month', j.created_at) as month_start,
        EXTRACT(YEAR FROM j.created_at)::integer as year,
        EXTRACT(MONTH FROM j.created_at)::integer as month,
        jt.name as job_type,
        js.name as job_status,
        COUNT(DISTINCT j.id) as job_count,
        COUNT(DISTINCT j.id) FILTER (WHERE js.name = 'Completed') as completed_count,
        COUNT(DISTINCT j.id) FILTER (WHERE js.name = 'In Progress') as in_progress_count,
        -- Financial aggregates
        COALESCE(SUM(ft_income.total), 0) as total_income,
        COALESCE(SUM(ft_expense.total), 0) as total_expenses,
        -- Task aggregates
        COALESCE(SUM(task_counts.total_tasks), 0) as total_tasks,
        COALESCE(SUM(task_counts.completed_tasks), 0) as completed_tasks,
        -- Time tracking
        COALESCE(SUM(time_totals.total_hours), 0) as total_hours,
        NOW() as refreshed_at
      FROM jobs j
      LEFT JOIN job_types jt ON jt.id = j.job_type_id
      LEFT JOIN job_status js ON js.id = j.job_status_id
      LEFT JOIN LATERAL (
        SELECT SUM(amount) as total
        FROM financial_transactions
        WHERE job_id = j.id AND transaction_type = 'income' AND status = 'posted'
      ) ft_income ON true
      LEFT JOIN LATERAL (
        SELECT SUM(amount) as total
        FROM financial_transactions
        WHERE job_id = j.id AND transaction_type = 'expense' AND status = 'posted'
      ) ft_expense ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as total_tasks, COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks
        FROM tasks
        WHERE job_id = j.id
      ) task_counts ON true
      LEFT JOIN LATERAL (
        SELECT SUM(ste.total_hours) as total_hours
        FROM tasks t
        JOIN sm_time_entries ste ON ste.task_id = t.id
        WHERE t.job_id = j.id
      ) time_totals ON true
      GROUP BY
        DATE_TRUNC('month', j.created_at),
        EXTRACT(YEAR FROM j.created_at),
        EXTRACT(MONTH FROM j.created_at),
        jt.name,
        js.name
      WITH DATA;

      CREATE INDEX ON mv_job_summary_monthly(month_start);
      CREATE INDEX ON mv_job_summary_monthly(year, month);
      CREATE INDEX ON mv_job_summary_monthly(job_type);
      CREATE INDEX ON mv_job_summary_monthly(job_status);
    SQL
  end

  def down
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_job_summary_monthly CASCADE"
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_financial_summary_yearly CASCADE"
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_financial_summary_quarterly CASCADE"
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_financial_summary_weekly CASCADE"
  end
end
