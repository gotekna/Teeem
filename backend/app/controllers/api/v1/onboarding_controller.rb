# frozen_string_literal: true

# OnboardingController - Client Onboarding System API
#
# Provides endpoints for the self-service onboarding hub:
# - Status: Get full onboarding progress
# - Steps: Manage individual onboarding steps
# - Import: Data import with preview/validation
# - Templates: Download import templates
#
module Api
  module V1
    class OnboardingController < ApplicationController
      include PresignedUploadHandler

      before_action :authenticate_user!

      # GET /api/v1/onboarding/status
      # Get full onboarding status for current tenant
      def status
        service = OnboardingStatusService.new(current_tenant)

        render json: {
          success: true,
          data: service.full_status
        }
      end

      # GET /api/v1/onboarding/steps/:key
      # Get details for a specific onboarding step
      def show_step
        step_key = params[:key].to_sym
        service = OnboardingStatusService.new(current_tenant)
        step = service.step_status(step_key)

        if step.nil?
          return render json: {
            success: false,
            error: "Unknown step: #{step_key}"
          }, status: :not_found
        end

        render json: {
          success: true,
          data: step
        }
      end

      # POST /api/v1/onboarding/steps/:key/assign
      # Assign a team member to an onboarding step
      def assign_step
        step_key = params[:key]
        user_id = params[:user_id]

        sm_task = find_onboarding_task(step_key)
        return render_task_not_found(step_key) unless sm_task

        user = User.find_by(id: user_id)
        unless user
          return render json: {
            success: false,
            error: "User not found"
          }, status: :not_found
        end

        sm_task.update!(assigned_user: user)

        render json: {
          success: true,
          message: "Step assigned to #{user.name}"
        }
      end

      # POST /api/v1/onboarding/steps/:key/skip
      # Skip an optional onboarding step
      def skip_step
        step_key = params[:key]
        service = OnboardingStatusService.new(current_tenant)
        step = service.step_status(step_key.to_sym)

        return render_step_not_found(step_key) unless step

        if step[:required]
          return render json: {
            success: false,
            error: "Cannot skip required step"
          }, status: :unprocessable_entity
        end

        sm_task = find_onboarding_task(step_key)
        if sm_task
          sm_task.update!(
            status: 'completed',
            skipped_at: Time.current,
            completed_at: Time.current
          )
        end

        render json: {
          success: true,
          message: "Step skipped"
        }
      end

      # POST /api/v1/onboarding/complete
      # Mark onboarding as complete
      def complete
        service = OnboardingStatusService.new(current_tenant)

        unless service.required_complete?
          return render json: {
            success: false,
            error: "Required steps not complete",
            incomplete_steps: service.full_status[:steps].select { |s| s[:required] && !s[:complete] }
          }, status: :unprocessable_entity
        end

        current_tenant.complete_onboarding!

        render json: {
          success: true,
          message: "Onboarding complete! Welcome to TEEEM."
        }
      end

      # GET /api/v1/onboarding/templates/:type
      # Download import template for a specific type
      def download_template
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

      # POST /api/v1/onboarding/import/preview
      # Preview import without executing
      def preview_import
        import_type = params[:type]&.to_sym
        file = params[:file]

        unless import_type && file
          return render json: {
            success: false,
            error: "type and file are required"
          }, status: :unprocessable_entity
        end

        rows = parse_file(file)
        validator = get_validator(import_type, rows, import_options)
        result = validator.preview

        render json: {
          success: true,
          data: result
        }
      end

      # POST /api/v1/onboarding/import
      # Execute import
      def execute_import
        import_type = params[:type]&.to_sym
        file = params[:file]

        unless import_type && file
          return render json: {
            success: false,
            error: "type and file are required"
          }, status: :unprocessable_entity
        end

        # Create audit log
        audit_log = ImportAuditLog.create!(
          tenant: current_tenant,
          user: current_user,
          import_type: import_type.to_s,
          filename: file.original_filename,
          file_size: file.size,
          options_used: import_options
        )

        audit_log.start!

        begin
          rows = parse_file(file)

          # Validate first
          validator = get_validator(import_type, rows, import_options)
          validation = validator.validate

          if !validation[:valid] && !import_options[:skip_invalid]
            audit_log.fail!("Validation failed: #{validation[:errors].first[:message]}")
            return render json: {
              success: false,
              error: "Validation failed",
              errors: validation[:errors]
            }, status: :unprocessable_entity
          end

          # Execute import
          importer = get_importer(import_type)
          result = importer.import(rows, import_options)

          audit_log.complete!(result)

          # Refresh onboarding status
          OnboardingStatusService.new(current_tenant).refresh!

          render json: {
            success: true,
            data: {
              rows_created: result[:created],
              rows_updated: result[:updated],
              rows_skipped: result[:skipped],
              errors_count: result[:errors],
              audit_log_id: audit_log.id
            }
          }
        rescue StandardError => e
          audit_log.fail!(e.message)
          raise
        end
      end

      # GET /api/v1/onboarding/import_history
      # Get import audit logs
      def import_history
        logs = current_tenant.import_audit_logs
                             .recent
                             .limit(50)
                             .includes(:user)

        render json: {
          success: true,
          data: logs.map do |log|
            {
              id: log.id,
              import_type: log.import_type,
              status: log.status,
              user_name: log.user&.name,
              filename: log.filename,
              rows_created: log.rows_created,
              rows_updated: log.rows_updated,
              rows_skipped: log.rows_skipped,
              errors_count: log.errors_count,
              created_at: log.created_at,
              duration_seconds: log.duration_seconds
            }
          end
        }
      end

      # =========================================================================
      # Legacy endpoints (kept for backwards compatibility)
      # =========================================================================

      # GET /api/v1/onboarding/templates
      # Download all import templates as ZIP
      def templates
        zip_data = TemplateGeneratorService.generate_all_templates(current_tenant)

        send_data zip_data,
                  filename: "teeem_import_templates.zip",
                  type: "application/zip"
      end

      # GET /api/v1/onboarding/template/:type
      # Download a single import template (legacy route)
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
      # Validate import files (legacy)
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

      # POST /api/v1/onboarding/import (legacy)
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

      def import_options
        {
          skip_invalid: params[:skip_invalid] != 'false',
          update_existing: params[:update_existing] == 'true',
          auto_create_lookups: params[:auto_create_lookups] != 'false'
        }
      end

      def find_onboarding_task(step_key)
        return nil unless current_tenant.onboarding_job_id

        SmTask.find_by(
          job_id: current_tenant.onboarding_job_id,
          "metadata->>'onboarding_step_key'" => step_key.to_s
        )
      end

      def render_task_not_found(step_key)
        render json: {
          success: false,
          error: "Onboarding task not found for step: #{step_key}"
        }, status: :not_found
      end

      def render_step_not_found(step_key)
        render json: {
          success: false,
          error: "Unknown step: #{step_key}"
        }, status: :not_found
      end

      def valid_template_type?(type)
        DataImportService::IMPORT_ORDER.include?(type.to_sym)
      end

      def parse_file(file)
        require 'roo'

        case File.extname(file.original_filename).downcase
        when '.xlsx'
          xlsx = Roo::Excelx.new(file.path)
          xlsx.parse(headers: true).drop(1)  # Skip header row
        when '.csv'
          require 'csv'
          CSV.parse(file.read, headers: true).map(&:to_h)
        else
          raise "Unsupported file type"
        end
      end

      def get_validator(import_type, rows, options)
        case import_type
        when :contacts
          ImportValidators::ContactValidator.new(rows, options)
        when :jobs
          ImportValidators::JobValidator.new(rows, options)
        when :pricebook_items
          ImportValidators::PricebookItemValidator.new(rows, options)
        when :price_histories
          ImportValidators::PriceHistoryValidator.new(rows, options)
        else
          ImportValidators::BaseValidator.new(rows, options)
        end
      end

      def get_importer(import_type)
        case import_type
        when :contacts
          ContactsImporter.new(current_tenant)
        when :jobs
          JobsImporter.new(current_tenant)
        when :pricebook_items
          PricebookImporter.new(current_tenant)
        when :price_histories
          PriceHistoryImporter.new(current_tenant)
        else
          raise "Unknown import type: #{import_type}"
        end
      end

      # SSoT: Extract files from either multipart upload or presigned URL storage keys
      def extract_files_from_params
        files = {}

        DataImportService::IMPORT_ORDER.each do |table|
          file_key = "#{table}_file"
          storage_key = "#{table}_storage_key"

          # Prefer direct file upload, fall back to storage key
          if params[file_key].present?
            files[table] = params[file_key]
          elsif params[storage_key].present?
            # SSoT: Use PresignedUploadHandler to download from S3
            downloaded = download_from_storage(params[storage_key])
            files[table] = downloaded if downloaded
          end
        end

        files
      end
    end
  end
end
