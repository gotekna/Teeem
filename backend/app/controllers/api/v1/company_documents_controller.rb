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

        # Filter by warehouse folder name (tab = folder name, e.g., "Company", "ASIC", "ATO")
        if params[:tab].present? && params[:tab] != "all"
          if params[:include_descendants] == 'true'
            # Include documents in this folder and all subfolders
            docs = docs.where("folder_path LIKE ?", "%/#{params[:tab]}%")
          else
            # Exact folder match - folder_path ends with the tab name
            docs = docs.where("folder_path LIKE ?", "%/#{params[:tab]}")
          end
        end

        # Preload companies for the company object
        company_ids = docs.filter_map { |d| d.metadata&.dig("company_id") }.uniq
        companies_by_id = Corporate.where(id: company_ids).index_by(&:id) if company_ids.any?
        companies_by_id ||= {}

        documents = docs.map do |doc|
          company = companies_by_id[doc.metadata&.dig("company_id")&.to_i]

          {
            id: doc.id,
            display_name: doc.ui_name,
            download_name: doc.download_filename,
            file_name: doc.storage_blob&.original_filename || doc.ui_name,
            document_type: doc.metadata&.dig("document_type")&.downcase,
            folder: doc.folder_path&.split("/")&.last&.upcase,
            folder_path: doc.folder_path,
            source: "warehouse",
            file_size: doc.storage_blob&.file_size,
            content_type: doc.storage_blob&.content_type,
            created_at: doc.created_at,
            document_date: doc.metadata&.dig("document_date"),
            financial_years: doc.metadata&.dig("financial_years"),
            file_url: "/api/v1/company_documents/#{doc.id}/download",
            company_id: company&.id,
            company: company ? { id: company.id, name: company.name, code: company.company_code } : nil,
            ai_verification_status: doc.metadata&.dig("ai_verification_status"),
            ai_suggested_name: doc.metadata&.dig("ai_suggested_name"),
            ai_suggested_folder: doc.metadata&.dig("ai_suggested_folder"),
            ai_suggested_type: doc.metadata&.dig("ai_suggested_type"),
            ai_confidence_score: doc.metadata&.dig("ai_confidence_score"),
            user_validated_at: doc.metadata&.dig("user_validated_at"),
            user_validated_by_id: doc.metadata&.dig("user_validated_by_id"),
            user_validated_by_name: doc.metadata&.dig("user_validated_by_name")
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
          render_error("Preview not available for this document")
        end
      rescue ActiveRecord::RecordNotFound
        render_error("Document not found", status: :not_found)
      end

      # GET /api/v1/company_documents/:id/content
      # Streams the actual file bytes through the backend (bypasses CORS for PDF.js)
      def content
        doc = WarehouseDocument.find(params[:id])

        unless doc.storage_blob
          return render_error("No file content available", status: :not_found)
        end

        send_data doc.storage_blob.download,
                  filename: doc.storage_blob.original_filename || doc.ui_name || "document",
                  type: doc.storage_blob.content_type || "application/octet-stream",
                  disposition: "inline"
      rescue ActiveRecord::RecordNotFound
        render_error("Document not found", status: :not_found)
      end

      # GET /api/v1/company_documents/:id/download
      # Redirects to a presigned download URL
      def download
        doc = WarehouseDocument.find(params[:id])

        url = doc.download_url(expires_in: 3600, disposition: :inline)

        if url.present?
          redirect_to url, allow_other_host: true
        else
          render_error("Download not available", status: :not_found)
        end
      rescue ActiveRecord::RecordNotFound
        render_error("Document not found", status: :not_found)
      end

      # POST /api/v1/company_documents/:id/validate
      # Stamps the document as human-validated (user reviewed and confirmed classification)
      def validate
        doc = WarehouseDocument.find(params[:id])

        doc.metadata = (doc.metadata || {}).merge(
          "user_validated_at" => Time.current.iso8601,
          "user_validated_by_id" => current_user&.id,
          "user_validated_by_name" => current_user&.name
        )
        doc.save!

        render json: {
          success: true,
          validated_at: doc.metadata["user_validated_at"],
          validated_by: current_user&.name
        }
      rescue ActiveRecord::RecordNotFound
        render_error("Document not found", status: :not_found)
      end

      # GET /api/v1/company_documents/:id/classification
      # Returns OCR and AI classification breakdown for a document
      # Used by the DocumentPreviewModal to show 3-column comparison
      #
      # Response:
      #   {
      #     success: true,
      #     has_classification: true,
      #     winner: "content_match",
      #     ocr: { document_type: "...", confidence: 85, signals: [...], ... },
      #     ai: { document_type: "...", confidence: 92, signals: [...], ... },
      #     name_match: { document_type: "...", confidence: 70, signals: [...], ... },
      #     classified_at: "2026-02-14T10:30:00Z"
      #   }
      #
      def classification
        doc = WarehouseDocument.find(params[:id])

        # Try to find the associated DocumentInbox via metadata
        inbox_id = doc.metadata&.dig("document_inbox_id")
        inbox = inbox_id ? DocumentInbox.find_by(id: inbox_id) : nil

        # Extract classification_result JSONB from DocumentInbox
        classification = inbox&.classification_result || {}
        methods = classification.is_a?(Hash) ? (classification["methods"] || classification[:methods] || {}) : {}

        # Build OCR breakdown from content_match method
        content_match = methods["content_match"] || methods[:content_match] || {}
        ocr_data = {
          document_type: content_match["document_type"] || content_match[:document_type],
          confidence: ((content_match["confidence"] || content_match[:confidence] || 0).to_f * 100).round,
          signals: content_match["signals"] || content_match[:signals] || content_match["matched_terms"] || content_match[:matched_terms] || [],
          text_preview: content_match["text_preview"] || content_match[:text_preview],
          status: content_match["status"] || content_match[:status] || "not_available",
          duration_ms: content_match["duration_ms"] || content_match[:duration_ms]
        }

        # Build AI breakdown from ai_match method
        ai_match = methods["ai_match"] || methods[:ai_match] || {}
        ai_data = {
          document_type: ai_match["document_type"] || ai_match[:document_type],
          confidence: ((ai_match["confidence"] || ai_match[:confidence] || 0).to_f * 100).round,
          signals: ai_match["signals"] || ai_match[:signals] || [],
          status: ai_match["status"] || ai_match[:status] || "not_available",
          duration_ms: ai_match["duration_ms"] || ai_match[:duration_ms],
          suggested_folder: doc.metadata&.dig("ai_suggested_folder"),
          suggested_name: doc.metadata&.dig("ai_suggested_name")
        }

        # Name match data
        name_match = methods["name_match"] || methods[:name_match] || {}
        name_data = {
          document_type: name_match["document_type"] || name_match[:document_type],
          confidence: ((name_match["confidence"] || name_match[:confidence] || 0).to_f * 100).round,
          signals: name_match["signals"] || name_match[:signals] || [],
          status: name_match["status"] || name_match[:status] || "not_available"
        }

        render json: {
          success: true,
          has_classification: inbox.present? && classification.present?,
          winner: classification["winner"] || classification[:winner],
          ocr: ocr_data,
          ai: ai_data,
          name_match: name_data,
          classified_at: classification["classified_at"] || classification[:classified_at]
        }
      rescue ActiveRecord::RecordNotFound
        render_error("Document not found", status: :not_found)
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
          return render_error("company_id is required", status: :bad_request)
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
