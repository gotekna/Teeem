# frozen_string_literal: true

module Api
  module V1
    # Admin controller for document standardization operations
    # Handles batch rename operations for documents to match naming conventions
    #
    # Endpoints:
    #   GET  /api/v1/document_standardization/preview - Preview what would be renamed
    #   POST /api/v1/document_standardization/execute - Execute batch rename
    #   POST /api/v1/document_standardization/rename/:id - Rename single document
    #
    class DocumentStandardizationController < ApplicationController
      before_action :require_admin_role, except: [:preview]

      # GET /api/v1/document_standardization/preview
      # Preview documents that need renaming
      # Params:
      #   - scope: "job", "corporate", or "all" (default: "all")
      #   - job_id: specific job ID (optional)
      #   - document_type_id: filter by document type (optional)
      #   - limit: max results (default: 100)
      def preview
        documents = fetch_documents_needing_rename
        preview_data = DocumentRenameService.preview(documents)

        render json: {
          success: true,
          data: {
            total_affected: preview_data.size,
            preview: preview_data.first(params[:limit]&.to_i || 100),
            filters_applied: {
              scope: params[:scope] || "all",
              job_id: params[:job_id],
              document_type_id: params[:document_type_id]
            }
          }
        }
      end

      # POST /api/v1/document_standardization/execute
      # Execute batch rename for documents
      # Params:
      #   - scope: "job", "corporate", or "all"
      #   - job_id: specific job ID (optional)
      #   - document_type_id: filter by document type (optional)
      #   - document_ids: array of specific document IDs (optional)
      #   - dry_run: if true, only preview (default: false)
      def execute
        if params[:dry_run]
          documents = fetch_documents_needing_rename
          preview_data = DocumentRenameService.preview(documents)

          return render json: {
            success: true,
            data: {
              dry_run: true,
              total_affected: preview_data.size,
              preview: preview_data
            }
          }
        end

        documents = fetch_documents_for_rename
        stats = DocumentRenameService.batch_rename(
          documents,
          use_ai_names: true,
          approved_by: current_user
        )

        render json: {
          success: true,
          data: {
            executed: true,
            stats: stats
          }
        }
      end

      # POST /api/v1/document_standardization/rename/:id
      # Rename a single document
      # Params:
      #   - new_name: the new filename (optional if using AI name)
      #   - use_ai_name: if true, use ai_proposed_name (default: false)
      def rename
        document = JobDocument.find(params[:id])

        service = DocumentRenameService.new(document)

        if params[:use_ai_name]
          result = service.rename_to_ai_proposed!(approved_by: current_user)
        elsif params[:new_name].present?
          result = service.rename!(params[:new_name], approved_by: current_user)
        else
          return render json: {
            success: false,
            error: "Must provide new_name or set use_ai_name: true"
          }, status: :unprocessable_entity
        end

        if result[:success]
          render json: { success: true, data: result }
        else
          render json: { success: false, error: result[:error] }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/document_standardization/stats
      # Get statistics about documents needing standardization
      def stats
        all_docs = JobDocument.where.not(ai_proposed_name: [nil, ""])

        # Calculate stats by comparing names (case-insensitive, normalized)
        needs_rename = all_docs.select do |doc|
          doc.file_name.downcase.gsub(/\s+/, " ").strip !=
            doc.ai_proposed_name.downcase.gsub(/\s+/, " ").strip
        end

        by_job = needs_rename.group_by(&:job_id).transform_values(&:count)
        by_type = needs_rename.group_by(&:document_type_id).transform_values(&:count)

        render json: {
          success: true,
          data: {
            total_analyzed: all_docs.count,
            needs_rename: needs_rename.count,
            already_correct: all_docs.count - needs_rename.count,
            by_job: by_job,
            by_document_type: by_type
          }
        }
      end

      private

      def require_admin_role
        unless current_user&.admin?
          render json: { success: false, error: "Admin access required" }, status: :forbidden
        end
      end

      def fetch_documents_needing_rename
        documents = base_document_query

        # Filter to only those with AI proposed names that differ from current
        documents.where.not(ai_proposed_name: [nil, ""])
      end

      def fetch_documents_for_rename
        if params[:document_ids].present?
          JobDocument.where(id: params[:document_ids])
        else
          fetch_documents_needing_rename
        end
      end

      def base_document_query
        scope = JobDocument.all

        case params[:scope]
        when "job"
          scope = scope.where.not(job_id: nil)
        when "corporate"
          scope = scope.where.not(company_id: nil)
        end

        scope = scope.where(job_id: params[:job_id]) if params[:job_id].present?
        scope = scope.where(document_type_id: params[:document_type_id]) if params[:document_type_id].present?

        scope
      end
    end
  end
end
