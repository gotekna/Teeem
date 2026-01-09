# frozen_string_literal: true

module Api
  module V1
    module Gl
      class PoInvoiceMatcherController < ApplicationController
        # GET /api/v1/gl/po_invoice_matcher/:bill_inbox_id/suggestions
        # Get AI-enhanced match suggestions for a bill
        def suggestions
          bill = BillInbox.find(params[:bill_inbox_id])
          matcher = ::Gl::AiPoInvoiceMatcher.new(bill, corporate_company: current_company)

          matches = matcher.all_matches

          render json: {
            success: true,
            data: {
              bill: bill_json(bill),
              suggestions: matches.map { |m| suggestion_json(m) },
              count: matches.count,
              best_confidence: matches.first&.dig(:confidence) || 0
            }
          }
        end

        # POST /api/v1/gl/po_invoice_matcher/:bill_inbox_id/confirm
        # Confirm a match suggestion
        def confirm
          bill = BillInbox.find(params[:bill_inbox_id])
          po = PurchaseOrder.find(params[:purchase_order_id])

          matcher = ::Gl::AiPoInvoiceMatcher.new(bill, corporate_company: current_company)
          matcher.record_confirmation(po, was_accepted: true, user: current_user)

          # Apply the match using existing BillMatchingService logic
          bill.update!(
            matched_purchase_order: po,
            match_status: "matched",
            status: "matched"
          )

          # Update PO
          po.update!(
            last_bill_inbox: bill,
            total_billed: po.total_billed.to_d + bill.total_amount.to_d
          )

          render json: {
            success: true,
            data: {
              bill: bill_json(bill.reload),
              matched_po: po_json(po)
            },
            message: "Match confirmed successfully"
          }
        end

        # POST /api/v1/gl/po_invoice_matcher/:bill_inbox_id/reject
        # Reject a match suggestion (for learning)
        def reject
          bill = BillInbox.find(params[:bill_inbox_id])
          po = PurchaseOrder.find(params[:purchase_order_id])

          matcher = ::Gl::AiPoInvoiceMatcher.new(bill, corporate_company: current_company)
          matcher.record_confirmation(po, was_accepted: false, user: current_user)

          render json: {
            success: true,
            message: "Rejection recorded for learning"
          }
        end

        # GET /api/v1/gl/po_invoice_matcher/stats
        # Get matching statistics
        def stats
          attempts = ::Gl::AiPoMatchAttempt.usage_stats(current_company)
          learnings = {
            total_feedback: ::Gl::AiPoMatchLearning.where(corporate_company: current_company).count,
            acceptance_rate: ::Gl::AiPoMatchLearning.acceptance_rate(current_company),
            accepted: ::Gl::AiPoMatchLearning.where(corporate_company: current_company).accepted.count,
            rejected: ::Gl::AiPoMatchLearning.where(corporate_company: current_company).rejected.count
          }

          render json: {
            success: true,
            data: {
              ai_attempts: attempts,
              learnings: learnings,
              ai_enabled: ENV["ANTHROPIC_API_KEY"].present?
            }
          }
        end

        # GET /api/v1/gl/po_invoice_matcher/unmatched
        # List bills that need matching
        def unmatched
          bills = BillInbox
            .where(corporate_company: current_company)
            .where(match_status: [nil, "unmatched"])
            .where.not(status: %w[error voided])
            .includes(:supplier)
            .order(created_at: :desc)
            .limit(params[:limit] || 50)

          render json: {
            success: true,
            data: {
              bills: bills.map { |b| bill_json(b) },
              count: bills.count
            }
          }
        end

        # POST /api/v1/gl/po_invoice_matcher/batch_suggest
        # Get suggestions for multiple bills at once
        def batch_suggest
          bill_ids = params[:bill_inbox_ids] || []
          bills = BillInbox.where(id: bill_ids, corporate_company: current_company)

          results = bills.map do |bill|
            matcher = ::Gl::AiPoInvoiceMatcher.new(bill, corporate_company: current_company)
            best_match = matcher.find_best_match

            {
              bill_id: bill.id,
              invoice_number: bill.invoice_number,
              supplier: bill.supplier_name_raw || bill.supplier&.display_name,
              amount: bill.total_amount,
              best_match: best_match ? {
                po_id: best_match[:po].id,
                po_number: best_match[:po].purchase_order_number,
                confidence: best_match[:confidence],
                reason: best_match[:reason],
                source: best_match[:source]
              } : nil
            }
          end

          render json: {
            success: true,
            data: {
              results: results,
              matched_count: results.count { |r| r[:best_match].present? },
              unmatched_count: results.count { |r| r[:best_match].nil? }
            }
          }
        end

        private

        def bill_json(bill)
          {
            id: bill.id,
            invoice_number: bill.invoice_number,
            supplier_name: bill.supplier_name_raw || bill.supplier&.display_name,
            supplier_id: bill.supplier_id,
            total_amount: bill.total_amount.to_f,
            invoice_date: bill.invoice_date,
            status: bill.status,
            match_status: bill.match_status,
            matched_po_id: bill.matched_purchase_order_id,
            matched_po_number: bill.matched_purchase_order&.purchase_order_number
          }
        end

        def po_json(po)
          {
            id: po.id,
            po_number: po.purchase_order_number,
            supplier_name: po.supplier&.display_name,
            supplier_id: po.supplier_id,
            total: po.total.to_f,
            job_name: po.job&.name,
            status: po.status,
            created_at: po.created_at
          }
        end

        def suggestion_json(match)
          {
            purchase_order: po_json(match[:po]),
            confidence: match[:confidence],
            reason: match[:reason],
            source: match[:source],
            variance: match[:variance]
          }
        end

        def current_company
          @current_company ||= CorporateCompany.find(
            params[:corporate_company_id] || current_user.corporate_company_id
          )
        end
      end
    end
  end
end
