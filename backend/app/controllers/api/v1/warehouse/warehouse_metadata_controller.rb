module Api
  module V1
    module Warehouse
      class WarehouseMetadataController < ApplicationController
      # GET /api/v1/warehouse/metadata
      # Returns data dictionary for all warehouse tables
      def index
        render json: {
          success: true,
          generated_at: Time.current.iso8601,
          materialized_views: materialized_views_metadata,
          fact_tables: fact_tables_metadata,
          warehouse_tables: warehouse_tables_metadata
        }
      end

      # GET /api/v1/warehouse/metadata/:view_name
      # Returns detailed metadata for a specific view
      def show
        view_name = params[:id]

        metadata = all_views[view_name]
        unless metadata
          render json: { success: false, error: "View '#{view_name}' not found" }, status: :not_found
          return
        end

        render json: {
          success: true,
          view: metadata.merge(
            columns: get_columns(view_name),
            sample_data: get_sample_data(view_name, 5)
          )
        }
      end

      private

      MATERIALIZED_VIEWS = {
        "mv_job_summary" => {
          description: "Per-job aggregated metrics including financials, tasks, documents, time entries",
          refresh_frequency: "hourly",
          has_unique_index: true,
          primary_key: "job_id"
        },
        "mv_financial_summary" => {
          description: "Monthly financial rollups by company including revenue, costs, margins",
          refresh_frequency: "hourly",
          has_unique_index: false,
          primary_key: "company_id, period_start"
        },
        "mv_document_summary" => {
          description: "Document metrics by type, source, verification status, and year",
          refresh_frequency: "hourly",
          has_unique_index: false,
          primary_key: "company_id, document_type, source"
        },
        "mv_document_completeness" => {
          description: "Document health and completeness scores per company",
          refresh_frequency: "hourly",
          has_unique_index: false,
          primary_key: "company_id"
        },
        "mv_invoice_po_reconciliation" => {
          description: "Invoice-to-PO matching and variance detection",
          refresh_frequency: "hourly",
          has_unique_index: true,
          primary_key: "invoice_id, po_id"
        },
        "mv_resource_utilization" => {
          description: "Resource hours by week for labor tracking",
          refresh_frequency: "hourly",
          has_unique_index: false,
          primary_key: "user_id, week_start"
        },
        "mv_job_document_status" => {
          description: "Document completeness status per job",
          refresh_frequency: "hourly",
          has_unique_index: true,
          primary_key: "job_id"
        },
        "mv_task_metrics" => {
          description: "Task completion metrics aggregated by job",
          refresh_frequency: "hourly",
          has_unique_index: false,
          primary_key: "job_id"
        }
      }.freeze

      FACT_TABLES = {
        "fact_job_daily_snapshots" => {
          description: "Daily snapshots of job metrics for trend analysis and historical reporting",
          granularity: "daily",
          retention: "unlimited",
          primary_key: "job_id, snapshot_date"
        }
      }.freeze

      WAREHOUSE_TABLES = {
        "email_warehouse" => {
          description: "Complete email storage with threading, full-text search, and job auto-matching",
          source: "Microsoft Outlook/Graph API",
          sync_type: "incremental"
        },
        "external_invoices" => {
          description: "Normalized invoice storage from external systems (Xero, MYOB, QuickBooks)",
          source: "Xero API",
          sync_type: "incremental"
        }
      }.freeze

      def materialized_views_metadata
        MATERIALIZED_VIEWS.map do |name, config|
          row_count = safe_count(name)
          last_refresh = get_last_refresh_time(name)

          {
            name: name,
            description: config[:description],
            refresh_frequency: config[:refresh_frequency],
            has_unique_index: config[:has_unique_index],
            primary_key: config[:primary_key],
            row_count: row_count,
            last_refreshed: last_refresh,
            columns: get_column_names(name)
          }
        end
      end

      def fact_tables_metadata
        FACT_TABLES.map do |name, config|
          {
            name: name,
            description: config[:description],
            granularity: config[:granularity],
            retention: config[:retention],
            primary_key: config[:primary_key],
            row_count: safe_count(name),
            columns: get_column_names(name)
          }
        end
      end

      def warehouse_tables_metadata
        WAREHOUSE_TABLES.map do |name, config|
          {
            name: name,
            description: config[:description],
            source: config[:source],
            sync_type: config[:sync_type],
            row_count: safe_count(name),
            columns: get_column_names(name)
          }
        end
      end

      def all_views
        @all_views ||= MATERIALIZED_VIEWS.merge(FACT_TABLES).merge(WAREHOUSE_TABLES)
      end

      def safe_count(table_name)
        ActiveRecord::Base.connection.execute(
          "SELECT COUNT(*) FROM #{ActiveRecord::Base.connection.quote_table_name(table_name)}"
        ).first["count"].to_i
      rescue StandardError => e
        Rails.logger.warn("Failed to count #{table_name}: #{e.message}")
        nil
      end

      def get_last_refresh_time(view_name)
        # Check if we have refresh logs
        if defined?(MvRefreshLog)
          log = MvRefreshLog.where(view_name: view_name, status: "success")
                           .order(completed_at: :desc)
                           .first
          return log.completed_at.iso8601 if log
        end

        # Fallback: check pg_stat_user_tables for last vacuum/analyze as proxy
        sanitized_name = ActiveRecord::Base.connection.quote(view_name)
        result = ActiveRecord::Base.connection.execute(<<~SQL)
          SELECT last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
          FROM pg_stat_user_tables
          WHERE relname = #{sanitized_name}
        SQL

        row = result.first
        return nil unless row

        times = [ row["last_vacuum"], row["last_autovacuum"], row["last_analyze"], row["last_autoanalyze"] ].compact
        times.max&.to_s
      rescue StandardError
        nil
      end

      def get_column_names(table_name)
        sanitized_name = ActiveRecord::Base.connection.quote(table_name)
        result = ActiveRecord::Base.connection.execute(<<~SQL)
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = #{sanitized_name}
          ORDER BY ordinal_position
        SQL

        result.map do |row|
          {
            name: row["column_name"],
            type: row["data_type"],
            nullable: row["is_nullable"] == "YES"
          }
        end
      rescue StandardError => e
        Rails.logger.warn("Failed to get columns for #{table_name}: #{e.message}")
        []
      end

      def get_columns(table_name)
        get_column_names(table_name)
      end

      def get_sample_data(table_name, limit = 5)
        result = ActiveRecord::Base.connection.execute(
          "SELECT * FROM #{ActiveRecord::Base.connection.quote_table_name(table_name)} LIMIT #{limit.to_i}"
        )
        result.to_a
      rescue StandardError => e
        Rails.logger.warn("Failed to get sample data for #{table_name}: #{e.message}")
        []
      end
      end
    end
  end
end
