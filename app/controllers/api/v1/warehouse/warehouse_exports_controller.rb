module Api
  module V1
    module Warehouse
      class WarehouseExportsController < ApplicationController
        # Allowed views for export (security: prevent arbitrary SQL execution)
        ALLOWED_VIEWS = %w[
          mv_job_summary
          mv_financial_summary
          mv_document_summary
          mv_document_completeness
          mv_invoice_po_reconciliation
          mv_resource_utilization
          mv_job_document_status
          mv_task_metrics
          fact_job_daily_snapshots
          email_warehouse
          external_invoices
        ].freeze

        # GET /api/v1/warehouse/export/:view_name.csv
        # GET /api/v1/warehouse/export/:view_name.xlsx
        def show
          view_name = params[:id]

          unless ALLOWED_VIEWS.include?(view_name)
            render json: { success: false, error: "View '#{view_name}' is not available for export" }, status: :bad_request
            return
          end

          # Get query parameters
          limit = [ params[:limit].to_i, 10_000 ].min.clamp(1, 10_000)  # Max 10k rows
          offset = [ params[:offset].to_i, 0 ].max

          # Fetch data
          data = fetch_data(view_name, limit, offset)
          total_count = safe_count(view_name)

          if data.empty?
            render json: { success: false, error: "No data found in #{view_name}" }, status: :not_found
            return
          end

          respond_to do |format|
            format.csv { send_csv(view_name, data) }
            format.xlsx { send_xlsx(view_name, data) }
            format.json { render json: { success: true, view: view_name, row_count: total_count, data: data } }
          end
        end

        # GET /api/v1/warehouse/export
        # List available views for export
        def index
          render json: {
            success: true,
            available_views: ALLOWED_VIEWS.map do |view|
              count = safe_count(view)
              {
                name: view,
                row_count: count,
                export_formats: %w[csv xlsx json],
                max_rows_per_export: 10_000
              }
            end
          }
        end

        private

        def fetch_data(view_name, limit, offset)
          # Ensure limit and offset are sanitized integers
          safe_limit = limit.to_i.clamp(1, 10_000)
          safe_offset = [ offset.to_i, 0 ].max

          sql = <<~SQL
            SELECT * FROM #{ActiveRecord::Base.connection.quote_table_name(view_name)}
            LIMIT #{safe_limit} OFFSET #{safe_offset}
          SQL

          ActiveRecord::Base.connection.execute(sql).to_a
        rescue StandardError => e
          Rails.logger.error("Failed to fetch data from #{view_name}: #{e.message}")
          []
        end

        def safe_count(table_name)
          ActiveRecord::Base.connection.execute(
            "SELECT COUNT(*) FROM #{ActiveRecord::Base.connection.quote_table_name(table_name)}"
          ).first["count"].to_i
        rescue StandardError
          0
        end

        def send_csv(view_name, data)
          return if data.empty?

          headers = data.first.keys
          csv_data = CSV.generate do |csv|
            csv << headers
            data.each { |row| csv << row.values }
          end

          send_data csv_data,
                    filename: "#{view_name}_#{Time.current.strftime('%Y%m%d_%H%M%S')}.csv",
                    type: "text/csv",
                    disposition: "attachment"
        end

        def send_xlsx(view_name, data)
          return if data.empty?

          headers = data.first.keys

          package = Axlsx::Package.new
          workbook = package.workbook

          workbook.add_worksheet(name: view_name.truncate(31)) do |sheet|
            # Header row with bold styling
            header_style = sheet.styles.add_style(b: true, bg_color: "DDDDDD")
            sheet.add_row headers, style: header_style

            # Data rows
            data.each do |row|
              sheet.add_row row.values
            end

            # Auto-fit columns (approximate)
            sheet.column_widths(*headers.map { |h| [ h.to_s.length * 1.2, 15 ].max })
          end

          # Add metadata worksheet
          workbook.add_worksheet(name: "Export Info") do |sheet|
            sheet.add_row [ "View Name", view_name ]
            sheet.add_row [ "Exported At", Time.current.iso8601 ]
            sheet.add_row [ "Row Count", data.size ]
            sheet.add_row [ "Exported By", current_user&.email || "System" ]
          end

          send_data package.to_stream.read,
                    filename: "#{view_name}_#{Time.current.strftime('%Y%m%d_%H%M%S')}.xlsx",
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    disposition: "attachment"
        end
      end
    end
  end
end
