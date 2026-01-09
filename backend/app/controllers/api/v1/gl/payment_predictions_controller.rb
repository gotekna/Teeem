# frozen_string_literal: true

module Api
  module V1
    module Gl
      class PaymentPredictionsController < ApplicationController
        # GET /api/v1/gl/payment_predictions
        # Get all at-risk invoices sorted by risk score
        def index
          predictor = ::Gl::LatePaymentPredictor.new(current_company)

          at_risk = predictor.at_risk_invoices(
            limit: params[:limit]&.to_i || 50,
            min_risk: params[:min_risk]&.to_i || 40
          )

          render json: {
            success: true,
            data: {
              at_risk_invoices: at_risk,
              count: at_risk.count
            }
          }
        end

        # GET /api/v1/gl/payment_predictions/:invoice_id
        # Get prediction for a specific invoice
        def show
          invoice = find_invoice(params[:invoice_id])

          unless invoice
            return render json: {
              success: false,
              error: "Invoice not found"
            }, status: :not_found
          end

          predictor = ::Gl::LatePaymentPredictor.new(current_company)
          prediction = predictor.predict_for_invoice(invoice)

          render json: {
            success: true,
            data: {
              invoice: invoice_json(invoice),
              prediction: prediction
            }
          }
        end

        # GET /api/v1/gl/payment_predictions/summary
        # Get summary statistics
        def summary
          predictor = ::Gl::LatePaymentPredictor.new(current_company)
          stats = predictor.summary_stats

          render json: {
            success: true,
            data: stats
          }
        end

        # GET /api/v1/gl/payment_predictions/contact_behaviors
        # Get payment behavior analysis for all contacts
        def contact_behaviors
          predictor = ::Gl::LatePaymentPredictor.new(current_company)
          behaviors = predictor.contact_payment_behaviors(
            limit: params[:limit]&.to_i || 100
          )

          render json: {
            success: true,
            data: {
              contact_behaviors: behaviors,
              count: behaviors.count
            }
          }
        end

        # GET /api/v1/gl/payment_predictions/contact/:contact_id
        # Get detailed payment history for a specific contact
        def contact_history
          contact = Contact.find(params[:contact_id])
          predictor = ::Gl::LatePaymentPredictor.new(current_company)
          history = predictor.contact_payment_history(contact)

          # Get current unpaid invoices for this contact
          unpaid = ::Gl::Invoice
            .where(corporate_company: current_company, contact: contact, invoice_type: "sales_invoice")
            .where.not(status: %w[paid voided deleted draft])
            .order(due_date: :asc)

          render json: {
            success: true,
            data: {
              contact: {
                id: contact.id,
                name: contact.display_name,
                email: contact.primary_email
              },
              payment_history: history,
              unpaid_invoices: unpaid.map { |inv| invoice_json(inv) }
            }
          }
        end

        # GET /api/v1/gl/payment_predictions/high_risk
        # Get only high-risk invoices (risk >= 70)
        def high_risk
          predictor = ::Gl::LatePaymentPredictor.new(current_company)
          at_risk = predictor.at_risk_invoices(
            limit: params[:limit]&.to_i || 100,
            min_risk: 70
          )

          total_at_risk = at_risk.sum { |inv| inv[:amount_at_risk] || 0 }

          render json: {
            success: true,
            data: {
              high_risk_invoices: at_risk,
              count: at_risk.count,
              total_amount_at_risk: total_at_risk.round(2)
            }
          }
        end

        # POST /api/v1/gl/payment_predictions/batch
        # Batch predict for multiple invoice IDs
        def batch
          invoice_ids = params[:invoice_ids] || []
          predictor = ::Gl::LatePaymentPredictor.new(current_company)

          results = invoice_ids.map do |invoice_id|
            invoice = find_invoice(invoice_id)
            next nil unless invoice

            prediction = predictor.predict_for_invoice(invoice)
            {
              invoice_id: invoice.id,
              invoice_type: invoice.class.name,
              prediction: prediction
            }
          end.compact

          render json: {
            success: true,
            data: {
              predictions: results,
              count: results.count
            }
          }
        end

        private

        def find_invoice(id)
          # Try GL invoices first
          invoice = ::Gl::Invoice.find_by(id: id, corporate_company: current_company)
          return invoice if invoice

          # Fall back to external invoices
          ExternalInvoice.find_by(id: id, corporate_company: current_company)
        end

        def invoice_json(invoice)
          {
            id: invoice.id,
            type: invoice.class.name,
            invoice_number: invoice.try(:invoice_number) || invoice.try(:reference),
            contact_id: invoice.contact_id,
            contact_name: invoice.contact&.display_name || invoice.try(:contact_name),
            total: invoice.try(:total) || invoice.try(:amount),
            amount_due: invoice.try(:amount_due),
            due_date: invoice.due_date,
            invoice_date: invoice.invoice_date,
            status: invoice.status,
            days_overdue: invoice.due_date ? [(Date.current - invoice.due_date).to_i, 0].max : 0
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
