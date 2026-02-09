# frozen_string_literal: true

module Api
  module V1
    module Contacts
      # Handles contact quality review operations
      # Extracted from ContactsController as part of controller decomposition
      # See: ADR-001-CONTACTS-CONTROLLER-DECOMPOSITION.md
      class QualityReviewsController < ApplicationController
        before_action :authorize_request

        # GET /api/v1/contacts/quality_reviews
        # Returns the review queue with filtering options
        def index
          reviews = ContactQualityReview.includes(:contact, :suggested_company)
                                        .order(confidence_score: :desc, created_at: :desc)

          # Filter by status (default: pending)
          status = params[:status] || "pending"
          reviews = reviews.where(status: status) unless status == "all"

          # Filter by issue_type if provided
          reviews = reviews.by_issue_type(params[:issue_type]) if params[:issue_type].present?

          # Pagination
          page = (params[:page] || 1).to_i
          per_page = (params[:per_page] || 50).to_i
          total_count = reviews.count
          reviews = reviews.offset((page - 1) * per_page).limit(per_page)

          render json: {
            success: true,
            data: reviews.map { |r| format_quality_review(r) },
            total_count: total_count,
            page: page,
            per_page: per_page,
            by_issue_type: ContactQualityReview.where(status: status == "all" ? ContactQualityReview::STATUSES : status)
                                               .group(:issue_type)
                                               .count,
            by_status: ContactQualityReview.group(:status).count
          }
        rescue => e
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        # POST /api/v1/contacts/quality_reviews/scan
        # Run the detection scan and populate review queue
        def scan
          scan_results = run_quality_scan

          render json: {
            success: true,
            message: "Quality scan completed",
            results: scan_results
          }
        rescue => e
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        # POST /api/v1/contacts/quality_reviews/:id/approve
        # Approve and execute the recommended action
        def approve
          review = ContactQualityReview.find(params[:id])

          if review.reviewed?
            return render json: {
              success: false,
              error: "Review has already been processed"
            }, status: :unprocessable_entity
          end

          ActiveRecord::Base.transaction do
            ContactQualityActionService.new(review).execute!
            review.approve!(current_user, notes: params[:notes])
          end

          render json: {
            success: true,
            data: format_quality_review(review.reload)
          }
        rescue ContactQualityActionService::ActionError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        rescue => e
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        # POST /api/v1/contacts/quality_reviews/:id/reject
        # Reject the review (no action taken)
        def reject
          review = ContactQualityReview.find(params[:id])

          if review.reviewed?
            return render json: {
              success: false,
              error: "Review has already been processed"
            }, status: :unprocessable_entity
          end

          review.reject!(current_user, notes: params[:notes])

          render json: {
            success: true,
            data: format_quality_review(review)
          }
        rescue => e
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        # POST /api/v1/contacts/quality_reviews/:id/skip
        # Skip the review for now
        def skip
          review = ContactQualityReview.find(params[:id])

          if review.reviewed?
            return render json: {
              success: false,
              error: "Review has already been processed"
            }, status: :unprocessable_entity
          end

          review.skip!(current_user, notes: params[:notes])

          render json: {
            success: true,
            data: format_quality_review(review)
          }
        rescue => e
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        # POST /api/v1/contacts/quality_reviews/bulk_approve
        # Approve multiple high-confidence reviews
        def bulk_approve
          review_ids = params[:review_ids]
          min_confidence = (params[:min_confidence] || 80).to_i

          unless review_ids.is_a?(Array) && review_ids.any?
            return render json: {
              success: false,
              error: "review_ids array is required"
            }, status: :bad_request
          end

          results = { approved: 0, failed: 0, errors: [] }

          ContactQualityReview.where(id: review_ids, status: "pending")
                             .where("confidence_score >= ?", min_confidence)
                             .find_each do |review|
            begin
              ActiveRecord::Base.transaction do
                ContactQualityActionService.new(review).execute!
                review.approve!(current_user, notes: "Bulk approved")
              end
              results[:approved] += 1
            rescue => e
              results[:failed] += 1
              results[:errors] << { review_id: review.id, error: e.message }
            end
          end

          render json: {
            success: true,
            results: results
          }
        rescue => e
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        # GET /api/v1/contacts/quality_reviews/:contact_id/analyze
        # Analyze a single contact for quality issues
        def analyze
          contact = Contact.find(params[:contact_id])
          service = ContactDataQualityService.new(contact)
          analysis = service.analyze

          render json: {
            success: true,
            data: analysis
          }
        rescue => e
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        private

        # Format a quality review for API response
        def format_quality_review(review)
          {
            id: review.id,
            contact_id: review.contact_id,
            contact: {
              id: review.contact.id,
              display_name: review.contact.display_name,
              email: review.contact.email,
              entity_type: review.contact.entity_type,
              abn: review.contact.abn
            },
            suggested_company: review.suggested_company ? {
              id: review.suggested_company.id,
              display_name: review.suggested_company.display_name,
              email: review.suggested_company.email,
              entity_type: review.suggested_company.entity_type
            } : nil,
            issue_type: review.issue_type,
            issue_type_label: review.issue_type_label,
            status: review.status,
            recommended_action: review.recommended_action,
            recommended_action_label: review.recommended_action_label,
            confidence_score: review.confidence_score,
            email_domain: review.email_domain,
            derived_company_name: review.derived_company_name,
            abr_data: review.abr_data,
            analysis_data: review.analysis_data,
            review_notes: review.review_notes,
            reviewed_by_id: review.reviewed_by_id,
            reviewed_at: review.reviewed_at,
            created_at: review.created_at,
            updated_at: review.updated_at
          }
        end

        # Run the quality scan and populate review queue
        def run_quality_scan
          results = { scanned: 0, issues_found: 0, by_issue_type: {} }

          # Clear stale pending reviews (older than 30 days)
          ContactQualityReview.pending.where("created_at < ?", 30.days.ago).destroy_all

          Contact.find_each do |contact|
            results[:scanned] += 1

            begin
              service = ContactDataQualityService.new(contact)
              analysis = service.analyze

              if analysis[:recommended_action] != :no_action && analysis[:issues].any?
                issue_type = analysis[:issues].first[:type] || "unknown"

                review = ContactQualityReview.find_or_initialize_by(
                  contact: contact,
                  issue_type: issue_type
                )

                # Only update if pending or new
                if review.new_record? || review.status == "pending"
                  review.assign_attributes(
                    suggested_company_id: analysis[:existing_company_match]&.id,
                    recommended_action: analysis[:recommended_action].to_s,
                    confidence_score: analysis[:confidence],
                    analysis_data: analysis,
                    abr_data: analysis[:abr_data],
                    email_domain: analysis[:domain_analysis]&.dig(:domain),
                    derived_company_name: analysis[:domain_analysis]&.dig(:derived_company_name),
                    status: "pending"
                  )
                  review.save!

                  results[:issues_found] += 1
                  results[:by_issue_type][issue_type] ||= 0
                  results[:by_issue_type][issue_type] += 1
                end
              end
            rescue StandardError => e
              Rails.logger.error "Quality scan error for contact #{contact.id}: #{e.message}"
            end
          end

          results
        end
      end
    end
  end
end
