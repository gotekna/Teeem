# frozen_string_literal: true

module Api
  module V1
    class TeeemSpreadsheetsController < ApplicationController
      before_action :set_spreadsheet, only: [:show, :update, :destroy, :export, :save_to_warehouse]

      # GET /api/v1/teeem_spreadsheets
      # Optional params:
      #   - job_id: filter by job (returns spreadsheets attached to this job)
      #   - unattached: if "true", returns only spreadsheets not attached to any job
      def index
        spreadsheets = current_user.teeem_spreadsheets.user_spreadsheets.recent

        # Filter by job if specified
        if params[:job_id].present?
          spreadsheets = spreadsheets.for_job(params[:job_id])
        elsif params[:unattached] == "true"
          spreadsheets = spreadsheets.unattached
        end

        render json: {
          success: true,
          data: spreadsheets.map { |s| spreadsheet_summary(s) }
        }
      end

      # GET /api/v1/teeem_spreadsheets/:id
      def show
        render json: {
          success: true,
          data: spreadsheet_detail(@spreadsheet)
        }
      end

      # POST /api/v1/teeem_spreadsheets
      def create
        spreadsheet = current_user.teeem_spreadsheets.build(spreadsheet_params)

        if spreadsheet.save
          render json: {
            success: true,
            data: spreadsheet_detail(spreadsheet)
          }, status: :created
        else
          render json: {
            success: false,
            error: spreadsheet.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/teeem_spreadsheets/:id
      def update
        if @spreadsheet.update(spreadsheet_params)
          render json: {
            success: true,
            data: spreadsheet_detail(@spreadsheet)
          }
        else
          render json: {
            success: false,
            error: @spreadsheet.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/teeem_spreadsheets/:id
      def destroy
        @spreadsheet.destroy
        render json: { success: true }
      end

      # POST /api/v1/teeem_spreadsheets/:id/save_to_warehouse
      # Saves spreadsheet to File Warehouse (S3) as XLSX
      def save_to_warehouse
        # Generate XLSX using same logic as export
        workbook = TeeemXl::Models::Workbook.new

        @spreadsheet.data["sheets"]&.each do |sheet_data|
          sheet = workbook.add_sheet(sheet_data["name"] || "Sheet1")
          cells = sheet_data["cells"] || {}
          rows = cells_to_rows(cells)
          rows.each { |row| sheet.add_row(row) }
        end

        temp_file = Tempfile.new(["spreadsheet", ".xlsx"])
        begin
          TeeemXl.write(workbook, temp_file.path)
          temp_file.rewind

          # Upload to S3 using SSoT warehouse_path
          organization = Organization.first
          provider = DocumentProviders::S3Compatible.for_organization(organization)

          folder_path = @spreadsheet.warehouse_folder_path
          filename = "#{@spreadsheet.safe_filename}.xlsx"

          result = provider.upload_file(
            folder_path,
            File.read(temp_file.path),
            filename,
            content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            overwrite: true
          )

          # TODO: Add migration to track storage_path on teeem_spreadsheets
          # @spreadsheet.update_columns(storage_path: "#{folder_path}/#{filename}")

          render json: {
            success: true,
            message: "Saved to File Warehouse",
            path: "#{folder_path}/#{filename}"
          }
        rescue StandardError => e
          Rails.logger.error "[TeeemSpreadsheet] Save to warehouse failed: #{e.message}"
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        ensure
          temp_file&.close
          temp_file&.unlink
        end
      end

      # GET /api/v1/teeem_spreadsheets/:id/export
      # Exports spreadsheet to XLSX format
      def export
        # Use TeeemXl to generate XLSX
        workbook = TeeemXl::Models::Workbook.new

        @spreadsheet.data["sheets"]&.each do |sheet_data|
          sheet = workbook.add_sheet(sheet_data["name"] || "Sheet1")

          # Convert cells hash to rows
          cells = sheet_data["cells"] || {}
          rows = cells_to_rows(cells)

          rows.each do |row|
            sheet.add_row(row)
          end
        end

        # Generate XLSX file
        temp_file = Tempfile.new(["spreadsheet", ".xlsx"])
        TeeemXl.write(workbook, temp_file.path)

        send_file temp_file.path,
          filename: "#{@spreadsheet.name.parameterize}.xlsx",
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          disposition: "attachment"
      ensure
        temp_file&.close
      end

      private

      def set_spreadsheet
        @spreadsheet = current_user.teeem_spreadsheets.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Spreadsheet not found" }, status: :not_found
      end

      def spreadsheet_params
        params.require(:teeem_spreadsheet).permit(:name, :is_template, :job_id, :description, data: {})
      end

      def spreadsheet_summary(spreadsheet)
        {
          id: spreadsheet.id,
          name: spreadsheet.name,
          description: spreadsheet.description,
          isTemplate: spreadsheet.is_template,
          sheetCount: spreadsheet.data["sheets"]&.length || 0,
          jobId: spreadsheet.job_id,
          jobName: spreadsheet.job&.name,
          updatedAt: spreadsheet.updated_at.iso8601,
          createdAt: spreadsheet.created_at.iso8601
        }
      end

      def spreadsheet_detail(spreadsheet)
        {
          id: spreadsheet.id,
          name: spreadsheet.name,
          description: spreadsheet.description,
          isTemplate: spreadsheet.is_template,
          data: spreadsheet.data,
          jobId: spreadsheet.job_id,
          jobName: spreadsheet.job&.name,
          updatedAt: spreadsheet.updated_at.iso8601,
          createdAt: spreadsheet.created_at.iso8601
        }
      end

      # Convert cells hash { "A1": { value: "x" }, "B2": { value: "y" } } to 2D array
      def cells_to_rows(cells)
        return [] if cells.empty?

        # Find dimensions
        max_row = 0
        max_col = 0

        cells.each_key do |ref|
          match = ref.to_s.match(/^([A-Z]+)(\d+)$/i)
          next unless match

          col = column_to_index(match[1])
          row = match[2].to_i
          max_row = [max_row, row].max
          max_col = [max_col, col].max
        end

        # Build 2D array
        rows = Array.new(max_row) { Array.new(max_col + 1) }

        cells.each do |ref, cell_data|
          match = ref.to_s.match(/^([A-Z]+)(\d+)$/i)
          next unless match

          col = column_to_index(match[1])
          row = match[2].to_i - 1  # Convert to 0-based

          value = cell_data.is_a?(Hash) ? cell_data["value"] : cell_data
          rows[row][col] = value if rows[row]
        end

        rows
      end

      def column_to_index(col)
        result = 0
        col.upcase.each_char do |char|
          result = result * 26 + (char.ord - 64)
        end
        result - 1
      end
    end
  end
end
