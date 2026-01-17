# frozen_string_literal: true

module Api
  module V1
    class OnboardingController < ApplicationController
      before_action :authenticate_user!

      # GET /api/v1/onboarding/status
      # Get onboarding status for current tenant
      def status
        tenant = current_tenant

        render json: {
          success: true,
          status: {
            tenant_name: tenant.name,
            has_contacts: Contact.count > 0,
            has_jobs: Job.count > 0,
            has_pricebook: pricebook_count > 0,
            has_trades: trades_count > 0,
            contacts_count: Contact.count,
            jobs_count: Job.count,
            pricebook_count: pricebook_count,
            trades_count: trades_count,
            onboarding_complete: onboarding_complete?
          }
        }
      end

      # GET /api/v1/onboarding/templates
      # Download all import templates as ZIP
      def templates
        zip_data = TemplateGeneratorService.generate_all_templates(current_tenant)

        send_data zip_data,
                  filename: "teeem_import_templates.zip",
                  type: "application/zip"
      end

      # GET /api/v1/onboarding/template/:type
      # Download a single import template
      def template
        template_type = params[:type].to_sym

        unless valid_template_type?(template_type)
          return render json: {
            success: false,
            error: "Invalid template type: #{template_type}"
          }, status: :unprocessable_entity
        end

        xlsx_data = TemplateGeneratorService.generate_template(template_type, current_tenant)

        send_data xlsx_data,
                  filename: "#{template_type}_import_template.xlsx",
                  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      end

      # POST /api/v1/onboarding/validate
      # Validate import files without actually importing
      def validate
        files = extract_files_from_params

        if files.empty?
          return render json: {
            success: false,
            error: "No files provided"
          }, status: :unprocessable_entity
        end

        service = DataImportService.new(current_tenant, files)
        result = service.validate_only!

        render json: {
          success: true,
          valid: result[:valid],
          would_import: result[:would_import],
          errors: result[:errors]
        }
      end

      # POST /api/v1/onboarding/import
      # Import data from uploaded files
      def import
        files = extract_files_from_params

        if files.empty?
          return render json: {
            success: false,
            error: "No files provided"
          }, status: :unprocessable_entity
        end

        service = DataImportService.new(current_tenant, files)
        result = service.import!

        if result[:success]
          render json: {
            success: true,
            message: "Data imported successfully",
            counts: result[:counts]
          }
        else
          render json: {
            success: false,
            error: "Import completed with errors",
            counts: result[:counts],
            errors: result[:errors]
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/onboarding/export/:type
      # Export current data as Excel for backup
      def export
        export_type = params[:type].to_sym

        unless valid_template_type?(export_type)
          return render json: {
            success: false,
            error: "Invalid export type: #{export_type}"
          }, status: :unprocessable_entity
        end

        xlsx_data = DataExportService.export(current_tenant, export_type)

        send_data xlsx_data,
                  filename: "#{current_tenant.slug}_#{export_type}_export.xlsx",
                  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      end

      private

      def current_tenant
        ActsAsTenant.current_tenant
      end

      def pricebook_count
        return 0 unless defined?(PricebookItem) && PricebookItem.table_exists?
        PricebookItem.count
      end

      def trades_count
        return 0 unless defined?(SmTrade) && SmTrade.table_exists?
        SmTrade.count
      end

      def onboarding_complete?
        Contact.count > 0 && Job.count > 0
      end

      def valid_template_type?(type)
        DataImportService::IMPORT_ORDER.include?(type.to_sym)
      end

      def extract_files_from_params
        files = {}

        DataImportService::IMPORT_ORDER.each do |table|
          file_key = "#{table}_file"
          files[table] = params[file_key] if params[file_key].present?
        end

        files
      end
    end
  end
end
