# frozen_string_literal: true

module Api
  module V1
    module Gl
      class DuplicateBillsController < ApplicationController
        # GET /api/v1/gl/duplicate_bills
        # Scan for potential duplicate bills
        def index
          options = {
            from_date: params[:from_date]&.to_date,
            to_date: params[:to_date]&.to_date,
            tenant_id: params[:tenant_id],
            limit: params[:limit]&.to_i || 1000
          }.compact

          detector = ::Gl::DuplicateBillDetector.new(current_company)
          results = detector.scan_all(options)

          # Filter out already-reviewed pairs
          if params[:include_reviewed] != "true"
            results[:duplicates] = results[:duplicates].reject do |dup|
              ::Gl::DuplicateBillReview.reviewed?(
                dup[:bill1][:id],
                dup[:bill2][:id]
              )
            end
            results[:potential_duplicates] = results[:duplicates].count
          end

          render json: {
            success: true,
            data: results
          }
        end

        # GET /api/v1/gl/duplicate_bills/:bill_id
        # Check a specific bill for duplicates
        def show
          bill = ExternalInvoice.find(params[:bill_id])

          unless bill.bill?
            return render json: {
              success: false,
              error: "Not a bill (invoice_type: #{bill.invoice_type})"
            }, status: :unprocessable_entity
          end

          detector = ::Gl::DuplicateBillDetector.new(current_company)
          duplicates = detector.check_bill(bill)

          # Filter out reviewed pairs if requested
          if params[:include_reviewed] != "true"
            duplicates = duplicates.reject do |dup|
              ::Gl::DuplicateBillReview.reviewed?(
                bill.id,
                dup[:duplicate_bill][:id]
              )
            end
          end

          render json: {
            success: true,
            data: {
              bill: bill_json(bill),
              potential_duplicates: duplicates.count,
              duplicates: duplicates
            }
          }
        end

        # POST /api/v1/gl/duplicate_bills/check
        # Check bill data before saving (real-time duplicate warning)
        def check
          bill_data = {
            id: params[:id],
            contact_id: params[:contact_id],
            invoice_number: params[:invoice_number],
            total: params[:total],
            invoice_date: params[:invoice_date],
            reference: params[:reference]
          }.compact

          detector = ::Gl::DuplicateBillDetector.new(current_company)
          duplicates = detector.check_before_save(bill_data)

          render json: {
            success: true,
            data: {
              has_duplicates: duplicates.any?,
              duplicates: duplicates
            }
          }
        end

        # POST /api/v1/gl/duplicate_bills/mark_not_duplicate
        # Mark a pair as reviewed (not actually a duplicate)
        def mark_not_duplicate
          review = ::Gl::DuplicateBillReview.find_or_initialize_by(
            bill1_id: [params[:bill1_id], params[:bill2_id]].min,
            bill2_id: [params[:bill1_id], params[:bill2_id]].max
          )

          review.assign_attributes(
            status: "not_duplicate",
            reviewed_by: current_user,
            reviewed_at: Time.current,
            notes: params[:notes],
            detection_score: params[:score],
            match_type: params[:match_type]
          )

          if review.save
            render json: {
              success: true,
              data: review_json(review),
              message: "Marked as not duplicate"
            }
          else
            render json: {
              success: false,
              error: review.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/duplicate_bills/confirm_duplicate
        # Confirm a pair as duplicate and take action
        def confirm_duplicate
          review = ::Gl::DuplicateBillReview.find_or_initialize_by(
            bill1_id: [params[:bill1_id], params[:bill2_id]].min,
            bill2_id: [params[:bill1_id], params[:bill2_id]].max
          )

          # Validate action
          action = params[:action_taken] || "void"
          unless %w[void delete link ignore].include?(action)
            return render json: {
              success: false,
              error: "Invalid action: #{action}"
            }, status: :unprocessable_entity
          end

          review.assign_attributes(
            status: "confirmed_duplicate",
            reviewed_by: current_user,
            reviewed_at: Time.current,
            action_taken: action,
            kept_bill_id: params[:keep_id],
            voided_bill_id: params[:void_id],
            notes: params[:notes],
            detection_score: params[:score],
            match_type: params[:match_type]
          )

          # Take action on the duplicate bill
          if params[:void_id].present? && action.in?(%w[void delete])
            duplicate_bill = ExternalInvoice.find(params[:void_id])
            new_status = action == "void" ? "voided" : "deleted"
            duplicate_bill.update!(status: new_status, sync_enabled: false)
          end

          if review.save
            render json: {
              success: true,
              data: review_json(review),
              message: "Confirmed duplicate - #{action} action taken"
            }
          else
            render json: {
              success: false,
              error: review.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/duplicate_bills/reviews
        # List all duplicate reviews
        def reviews
          scope = ::Gl::DuplicateBillReview.includes(:bill1, :bill2, :reviewed_by)
                                           .order(created_at: :desc)

          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.limit(params[:limit] || 100)

          render json: {
            success: true,
            data: scope.map { |r| review_json(r) }
          }
        end

        # GET /api/v1/gl/duplicate_bills/stats
        # Statistics on duplicate detection
        def stats
          total_reviews = ::Gl::DuplicateBillReview.count
          confirmed = ::Gl::DuplicateBillReview.confirmed.count
          not_duplicates = ::Gl::DuplicateBillReview.not_duplicates.count
          pending = ::Gl::DuplicateBillReview.pending.count

          # Recent detection results
          detector = ::Gl::DuplicateBillDetector.new(current_company)
          scan_results = detector.scan_all(limit: 500)

          render json: {
            success: true,
            data: {
              reviews: {
                total: total_reviews,
                confirmed_duplicates: confirmed,
                not_duplicates: not_duplicates,
                pending: pending
              },
              scan: {
                bills_scanned: scan_results[:total_bills_scanned],
                potential_duplicates: scan_results[:potential_duplicates],
                high_risk: scan_results[:duplicates].count { |d| d[:score] >= 90 },
                medium_risk: scan_results[:duplicates].count { |d| d[:score] >= 70 && d[:score] < 90 }
              }
            }
          }
        end

        private

        def bill_json(bill)
          {
            id: bill.id,
            invoice_number: bill.invoice_number,
            contact_id: bill.contact_id,
            contact_name: bill.contact&.display_name || bill.contact_name,
            total: bill.total.to_f,
            invoice_date: bill.invoice_date,
            due_date: bill.due_date,
            status: bill.status,
            reference: bill.reference,
            description: bill.description,
            source: bill.source
          }
        end

        def review_json(review)
          {
            id: review.id,
            bill1: bill_json(review.bill1),
            bill2: bill_json(review.bill2),
            status: review.status,
            action_taken: review.action_taken,
            kept_bill_id: review.kept_bill_id,
            voided_bill_id: review.voided_bill_id,
            reviewed_by: review.reviewed_by&.name,
            reviewed_at: review.reviewed_at,
            notes: review.notes,
            detection_score: review.detection_score,
            match_type: review.match_type,
            detection_reasoning: review.detection_reasoning,
            created_at: review.created_at
          }
        end

        def current_company
          @current_company ||= Corporate.find(
            params[:corporate_id] || current_user.corporate_id
          )
        end
      end
    end
  end
end
