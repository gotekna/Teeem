module Api
  module V1
    class CsvImportsController < ApplicationController
      def import_job_with_pos
        # Validate required parameters
        unless params[:csv_file].present?
          render_error("CSV file is required", status: :unprocessable_entity)
          return
        end

        unless params[:site_supervisor_name].present?
          render_error("Site supervisor name is required", status: :unprocessable_entity)
          return
        end

        # Read CSV file
        csv_content = params[:csv_file].read

        # Parse CSV
        parser = EasybuildCsvParser.new(csv_content)
        parse_result = parser.parse

        unless parse_result[:success]
          render json: {
            success: false,
            error: parse_result[:error],
            details: parse_result[:errors]
          }, status: :unprocessable_entity
          return
        end

        # Import job and POs in a transaction
        ActiveRecord::Base.transaction do
          # Create Construction (job)
          # SSoT: Use contract_price as THE ONE
          construction = Job.create!(
            title: parse_result[:job_name],
            contract_price: params[:contract_value].presence || parse_result[:summary][:total_amount],
            status: params[:status].presence || "Active"
          )

          # SSoT: Assign supervisor via job_contacts (site_supervisor_name/phone columns removed Jan 2026)
          if params[:site_supervisor_name].present?
            supervisor_user = User.find_by("name ILIKE ?", params[:site_supervisor_name])
            if supervisor_user
              construction.job_contacts.create!(user: supervisor_user, role: "supervisor")
            end
          end

          # Create Purchase Orders
          created_pos = []
          skipped_pos = []

          parse_result[:purchase_orders].each do |po_data|
            begin
              po = construction.purchase_orders.create!(
                po_number: po_data[:po_number],
                supplier_name: po_data[:supplier_name] || "TBD",
                description: po_data[:description],
                sub_total: po_data[:subtotal] || po_data[:total],
                tax: po_data[:tax] || 0,
                total: po_data[:total],
                status: po_data[:status],
                notes: po_data[:notes]
              )
              created_pos << po
            rescue ActiveRecord::RecordInvalid => e
              skipped_pos << {
                po_number: po_data[:po_number],
                error: e.message
              }
            end
          end

          # Trigger OneDrive folder creation if requested
          if params[:create_onedrive_folders] == true || params[:create_onedrive_folders] == "true"
            construction.create_folders_if_needed!(params[:template_id])
          end

          render json: {
            success: true,
            construction: {
              id: construction.id,
              title: construction.title,
              status: construction.status
            },
            import_summary: {
              total_pos_in_csv: parse_result[:summary][:total_pos],
              pos_created: created_pos.length,
              pos_skipped: skipped_pos.length,
              total_amount: parse_result[:summary][:total_amount],
              suppliers_count: parse_result[:summary][:suppliers_count]
            },
            skipped_pos: skipped_pos,
            warnings: parser.warnings,
            onedrive_folders_queued: params[:create_onedrive_folders] == true || params[:create_onedrive_folders] == "true"
          }, status: :created
        end

      rescue ActiveRecord::RecordInvalid => e
        render json: {
          success: false,
          error: "Failed to create job",
          details: e.record.errors.full_messages
        }, status: :unprocessable_entity

      rescue => e
        Rails.logger.error "CSV Import Error: #{e.message}"
        Rails.logger.error e.backtrace.join("\n")

        render json: {
          success: false,
          error: "An error occurred while importing the CSV",
          details: e.message
        }, status: :internal_server_error
      end

      # POST /api/v1/csv_imports/databuild_preview
      # Preview a Databuild CSV import (auto-detects format)
      # Params: csv_file (multipart), job_id (required)
      def databuild_preview
        job = find_job_for_databuild
        return unless job

        csv_content = read_csv_file
        return unless csv_content

        service = Importers::DatabuildBoqImportService.new(job)
        result = service.preview(csv_content)

        render json: result
      rescue StandardError => e
        Rails.logger.error "Databuild preview error: #{e.message}"
        render_error("Preview failed: #{e.message}", status: :internal_server_error)
      end

      # POST /api/v1/csv_imports/databuild_import
      # Import a Databuild CSV (auto-detects format: cost centres, loads, or line items)
      # Params: csv_file (multipart), job_id (required)
      def databuild_import
        job = find_job_for_databuild
        return unless job

        csv_content = read_csv_file
        return unless csv_content

        service = Importers::DatabuildBoqImportService.new(job)
        result = service.import_auto(csv_content)

        render json: result
      rescue StandardError => e
        Rails.logger.error "Databuild import error: #{e.message}"
        render_error("Import failed: #{e.message}", status: :internal_server_error)
      end

      private

      def find_job_for_databuild
        unless params[:job_id].present?
          render_error("job_id is required", status: :unprocessable_entity)
          return nil
        end

        job = Job.find_by(id: params[:job_id])
        unless job
          render_error("Job not found", status: :not_found)
          return nil
        end

        job
      end

      def read_csv_file
        unless params[:csv_file].present?
          render_error("CSV file is required", status: :unprocessable_entity)
          return nil
        end

        params[:csv_file].read
      end
    end
  end
end
