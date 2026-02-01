# frozen_string_literal: true

module Api
  module V1
    # CompanyDocumentsController - Document counts for corporate companies
    #
    # SSoT: WarehouseDocument is THE ONE table for document metadata (Jan 2026)
    # Documents are linked to companies via metadata->>'company_id'
    #
    class CompanyDocumentsController < ApplicationController
      # GET /api/v1/company_documents
      # Returns documents for a specific company from WarehouseDocument
      #
      # Params:
      #   company_id: The corporate company ID (required)
      #   tab: Filter by document type/tab (optional)
      #
      def index
        company_id = params[:company_id]

        unless company_id.present?
          return render json: { success: true, documents: [] }
        end

        # SSoT: Query WarehouseDocument for corporate documents with this company_id
        # Check both metadata and linkable association (catch-all)
        docs = WarehouseDocument
          .where(source_type: "corporate")
          .where(
            "metadata->>'company_id' = :id OR (linkable_type = 'Corporate' AND linkable_id = :id_int)",
            id: company_id.to_s, id_int: company_id.to_i
          )
          .includes(:storage_blob)
          .order(created_at: :desc)
          .limit(500)

        # Filter by tab/document_type if provided
        if params[:tab].present? && params[:tab] != "all"
          docs = docs.where("metadata->>'document_type' = ?", params[:tab])
        end

        documents = docs.map do |doc|
          {
            id: doc.id,
            display_name: doc.display_name,
            file_name: doc.storage_blob&.original_filename || doc.display_name,
            document_type: doc.metadata&.dig("document_type"),
            folder: doc.folder,
            source: "warehouse",
            file_size: doc.storage_blob&.file_size,
            content_type: doc.storage_blob&.content_type,
            created_at: doc.created_at,
            document_date: doc.metadata&.dig("document_date"),
            financial_years: doc.metadata&.dig("financial_years"),
            file_url: "/api/v1/company_documents/#{doc.id}/download",
            company_id: doc.metadata&.dig("company_id"),
            ai_verification_status: doc.metadata&.dig("ai_verification_status"),
            ai_suggested_name: doc.metadata&.dig("ai_suggested_name"),
            ai_suggested_folder: doc.metadata&.dig("ai_suggested_folder"),
            ai_suggested_type: doc.metadata&.dig("ai_suggested_type"),
            ai_confidence_score: doc.metadata&.dig("ai_confidence_score"),
            user_validated_at: doc.metadata&.dig("user_validated_at"),
            user_validated_by_id: doc.metadata&.dig("user_validated_by_id")
          }
        end

        render json: { success: true, documents: documents }
      end

      # GET /api/v1/company_documents/:id/preview
      # Returns a presigned URL for inline document preview
      def preview
        doc = WarehouseDocument.find(params[:id])

        url = doc.download_url(expires_in: 3600, disposition: :inline)

        if url.present?
          render json: { success: true, preview_url: url }
        else
          render json: { success: false, error: "Preview not available for this document" }
        end
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Document not found" }, status: :not_found
      end

      # GET /api/v1/company_documents/:id/download
      # Redirects to a presigned download URL
      def download
        doc = WarehouseDocument.find(params[:id])

        url = doc.download_url(expires_in: 3600, disposition: :inline)

        if url.present?
          redirect_to url, allow_other_host: true
        else
          render json: { success: false, error: "Download not available" }, status: :not_found
        end
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Document not found" }, status: :not_found
      end

      # GET /api/v1/company_documents/counts
      # Returns document counts grouped by document_type for a specific company
      #
      # Params:
      #   company_id: The corporate company ID (required)
      #
      # Response:
      #   { success: true, counts: { "Bank Statement": 5, "Invoice": 12, ... } }
      #
      def counts
        company_id = params[:company_id]

        unless company_id.present?
          return render json: { success: false, error: "company_id is required" }, status: :bad_request
        end

        # SSoT: Query WarehouseDocument for corporate documents with this company_id
        # Documents can be linked via:
        # 1. metadata->>'company_id' (newer documents)
        # 2. linkable_type='Corporate' and linkable_id (if using polymorphic link)
        counts = WarehouseDocument
          .where(source_type: "corporate")
          .where("metadata->>'company_id' = ?", company_id.to_s)
          .group("COALESCE(metadata->>'document_type', 'Other')")
          .count

        # Also check for documents linked via polymorphic association
        polymorphic_counts = WarehouseDocument
          .where(source_type: "corporate")
          .where(linkable_type: "Corporate", linkable_id: company_id)
          .group("COALESCE(metadata->>'document_type', 'Other')")
          .count

        # Merge both count sources
        merged_counts = counts.merge(polymorphic_counts) { |_key, v1, v2| v1 + v2 }

        render json: { success: true, counts: merged_counts }
      end
    end
  end
end
