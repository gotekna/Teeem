# frozen_string_literal: true

module Api
  module V1
    # CompanyDocumentsController - Document counts for corporate companies
    #
    # SSoT: WarehouseDocument is THE ONE table for document metadata (Jan 2026)
    # Documents are linked to companies via metadata->>'company_id'
    #
    class CompanyDocumentsController < ApplicationController
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
        # 2. linkable_type='CorporateCompany' and linkable_id (if using polymorphic link)
        counts = WarehouseDocument
          .where(source_type: "corporate")
          .where("metadata->>'company_id' = ?", company_id.to_s)
          .group("COALESCE(metadata->>'document_type', 'Other')")
          .count

        # Also check for documents linked via polymorphic association
        polymorphic_counts = WarehouseDocument
          .where(source_type: "corporate")
          .where(linkable_type: "CorporateCompany", linkable_id: company_id)
          .group("COALESCE(metadata->>'document_type', 'Other')")
          .count

        # Merge both count sources
        merged_counts = counts.merge(polymorphic_counts) { |_key, v1, v2| v1 + v2 }

        render json: { success: true, counts: merged_counts }
      end
    end
  end
end
