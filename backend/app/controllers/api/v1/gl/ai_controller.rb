# frozen_string_literal: true

module Api
  module V1
    module Gl
      # Controller for AI-powered features
      class AiController < ApplicationController
        before_action :set_corporate_company

        # === Transaction Categorization ===

        # GET /api/v1/gl/ai/categories
        def categories
          categories = @corporate_company.gl_transaction_categories
                                         .includes(:default_account)
                                         .order(:name)

          categories = categories.active if params[:active_only] == "true"
          categories = categories.for_type(params[:type]) if params[:type].present?

          render json: {
            success: true,
            data: categories.as_json(include: { default_account: { only: [:id, :name, :code] } })
          }
        end

        # POST /api/v1/gl/ai/categories
        def create_category
          category = @corporate_company.gl_transaction_categories.build(category_params)

          if category.save
            render json: { success: true, data: category }, status: :created
          else
            render json: { success: false, error: category.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/ai/categories/:id
        def update_category
          category = @corporate_company.gl_transaction_categories.find(params[:id])

          if category.update(category_params)
            render json: { success: true, data: category }
          else
            render json: { success: false, error: category.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/ai/categories/seed
        def seed_categories
          ::Gl::TransactionCategory.seed_common!(@corporate_company)
          render json: { success: true, message: "Common categories seeded" }
        end

        # GET /api/v1/gl/ai/predictions
        def predictions
          predictions = @corporate_company.gl_categorization_predictions
                                          .includes(:bank_transaction, :predicted_category, :predicted_account)
                                          .recent

          predictions = predictions.pending if params[:pending_only] == "true"
          predictions = predictions.high_confidence if params[:high_confidence] == "true"
          predictions = predictions.limit(params[:limit] || 50)

          render json: {
            success: true,
            data: predictions.as_json(include: [:bank_transaction, :predicted_category, :predicted_account])
          }
        end

        # POST /api/v1/gl/ai/predictions/:id/accept
        def accept_prediction
          prediction = @corporate_company.gl_categorization_predictions.find(params[:id])
          prediction.accept!(current_user)

          render json: { success: true, data: prediction }
        end

        # POST /api/v1/gl/ai/predictions/:id/reject
        def reject_prediction
          prediction = @corporate_company.gl_categorization_predictions.find(params[:id])
          prediction.reject!(current_user, reason: params[:reason])

          render json: { success: true, data: prediction }
        end

        # POST /api/v1/gl/ai/predictions/:id/correct
        def correct_prediction
          prediction = @corporate_company.gl_categorization_predictions.find(params[:id])
          category = @corporate_company.gl_transaction_categories.find(params[:category_id])
          account = params[:account_id].present? ? @corporate_company.gl_accounts.find(params[:account_id]) : nil

          prediction.correct!(current_user, category: category, account: account)

          render json: { success: true, data: prediction }
        end

        # GET /api/v1/gl/ai/predictions/accuracy
        def prediction_accuracy
          stats = ::Gl::CategorizationPrediction.accuracy_stats(@corporate_company)
          render json: { success: true, data: stats }
        end

        # === Anomaly Detection ===

        # GET /api/v1/gl/ai/anomalies
        def anomalies
          anomalies = @corporate_company.gl_anomalies
                                        .includes(:anomalable, :assigned_to)
                                        .recent

          anomalies = anomalies.open if params[:open_only] == "true"
          anomalies = anomalies.for_type(params[:type]) if params[:type].present?
          anomalies = anomalies.where(severity: params[:severity]) if params[:severity].present?
          anomalies = anomalies.limit(params[:limit] || 100)

          render json: {
            success: true,
            data: anomalies.as_json(include: [:assigned_to])
          }
        end

        # GET /api/v1/gl/ai/anomalies/:id
        def show_anomaly
          anomaly = @corporate_company.gl_anomalies.find(params[:id])
          render json: { success: true, data: anomaly.as_json(include: [:anomalable, :assigned_to, :resolved_by]) }
        end

        # POST /api/v1/gl/ai/anomalies/:id/assign
        def assign_anomaly
          anomaly = @corporate_company.gl_anomalies.find(params[:id])
          user = User.find(params[:user_id])

          anomaly.assign!(user)
          render json: { success: true, data: anomaly }
        end

        # POST /api/v1/gl/ai/anomalies/:id/resolve
        def resolve_anomaly
          anomaly = @corporate_company.gl_anomalies.find(params[:id])
          anomaly.resolve!(current_user, notes: params[:notes])

          render json: { success: true, data: anomaly }
        end

        # POST /api/v1/gl/ai/anomalies/:id/dismiss
        def dismiss_anomaly
          anomaly = @corporate_company.gl_anomalies.find(params[:id])
          anomaly.dismiss!(current_user, reason: params[:reason])

          render json: { success: true, data: anomaly }
        end

        # GET /api/v1/gl/ai/anomalies/summary
        def anomaly_summary
          summary = ::Gl::Anomaly.summary(@corporate_company)
          render json: { success: true, data: summary }
        end

        # GET /api/v1/gl/ai/anomaly_rules
        def anomaly_rules
          rules = @corporate_company.gl_anomaly_rules.order(:name)
          rules = rules.active if params[:active_only] == "true"

          render json: { success: true, data: rules }
        end

        # POST /api/v1/gl/ai/anomaly_rules
        def create_anomaly_rule
          rule = @corporate_company.gl_anomaly_rules.build(anomaly_rule_params)

          if rule.save
            render json: { success: true, data: rule }, status: :created
          else
            render json: { success: false, error: rule.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/ai/anomaly_rules/:id
        def update_anomaly_rule
          rule = @corporate_company.gl_anomaly_rules.find(params[:id])

          if rule.update(anomaly_rule_params)
            render json: { success: true, data: rule }
          else
            render json: { success: false, error: rule.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/ai/anomaly_rules/seed
        def seed_anomaly_rules
          ::Gl::AnomalyRule.seed_defaults!(@corporate_company)
          render json: { success: true, message: "Default anomaly rules seeded" }
        end

        # === Duplicate Detection ===

        # GET /api/v1/gl/ai/duplicates
        def duplicates
          groups = @corporate_company.gl_duplicate_groups
                                     .includes(:members, :reviewed_by)
                                     .recent

          groups = groups.pending if params[:pending_only] == "true"
          groups = groups.for_entity(params[:entity]) if params[:entity].present?
          groups = groups.limit(params[:limit] || 50)

          render json: {
            success: true,
            data: groups.as_json(include: [:members, :reviewed_by])
          }
        end

        # GET /api/v1/gl/ai/duplicates/:id
        def show_duplicate
          group = @corporate_company.gl_duplicate_groups.find(params[:id])

          render json: {
            success: true,
            data: group.as_json(include: { members: { include: :duplicable } })
          }
        end

        # POST /api/v1/gl/ai/duplicates/:id/keep_first
        def keep_first_duplicate
          group = @corporate_company.gl_duplicate_groups.find(params[:id])
          group.keep_first!(current_user)

          render json: { success: true, data: group }
        end

        # POST /api/v1/gl/ai/duplicates/:id/keep_last
        def keep_last_duplicate
          group = @corporate_company.gl_duplicate_groups.find(params[:id])
          group.keep_last!(current_user)

          render json: { success: true, data: group }
        end

        # POST /api/v1/gl/ai/duplicates/:id/merge
        def merge_duplicates
          group = @corporate_company.gl_duplicate_groups.find(params[:id])
          group.merge!(current_user)

          render json: { success: true, data: group }
        end

        # POST /api/v1/gl/ai/duplicates/:id/not_duplicate
        def not_duplicate
          group = @corporate_company.gl_duplicate_groups.find(params[:id])
          group.mark_not_duplicate!(current_user)

          render json: { success: true, data: group }
        end

        # POST /api/v1/gl/ai/duplicates/scan
        def scan_duplicates
          entity_type = params[:entity_type] || "invoice"
          groups = ::Gl::DuplicateGroup.scan!(@corporate_company, entity_type)

          render json: {
            success: true,
            data: groups,
            message: "Found #{groups.count} potential duplicate groups"
          }
        end

        # === Late Payment Prediction ===

        # GET /api/v1/gl/ai/payment_predictions
        def payment_predictions
          predictions = @corporate_company.gl_payment_predictions
                                          .includes(:invoice, :contact)
                                          .recent

          predictions = predictions.high_risk if params[:high_risk_only] == "true"
          predictions = predictions.limit(params[:limit] || 50)

          render json: {
            success: true,
            data: predictions.as_json(include: [:invoice, :contact])
          }
        end

        # GET /api/v1/gl/ai/payment_predictions/for_invoice/:invoice_id
        def invoice_prediction
          invoice = @corporate_company.gl_invoices.find(params[:invoice_id])
          prediction = invoice.gl_payment_predictions.recent.first

          unless prediction
            prediction = ::Gl::PaymentPrediction.predict!(invoice)
          end

          render json: { success: true, data: prediction&.as_json(include: [:contact]) }
        end

        # GET /api/v1/gl/ai/payment_predictions/accuracy
        def prediction_accuracy_stats
          accuracy = ::Gl::PaymentPrediction.accuracy(@corporate_company)
          render json: { success: true, data: { accuracy: accuracy } }
        end

        # GET /api/v1/gl/ai/customer_stats
        def customer_stats
          stats = @corporate_company.gl_customer_payment_stats
                                    .includes(:contact)
                                    .order(payment_reliability_score: :desc)

          stats = stats.with_outstanding if params[:with_outstanding] == "true"
          stats = stats.at_risk(@corporate_company) if params[:at_risk] == "true"

          render json: {
            success: true,
            data: stats.as_json(include: { contact: { only: [:id, :name, :email] } })
          }
        end

        # GET /api/v1/gl/ai/customer_stats/:contact_id
        def show_customer_stats
          stats = @corporate_company.gl_customer_payment_stats.find_by!(contact_id: params[:contact_id])

          render json: { success: true, data: stats.as_json(include: :contact) }
        end

        # POST /api/v1/gl/ai/customer_stats/:contact_id/recalculate
        def recalculate_customer_stats
          stats = @corporate_company.gl_customer_payment_stats.find_or_initialize_by(contact_id: params[:contact_id])
          stats.recalculate!

          render json: { success: true, data: stats }
        end

        # GET /api/v1/gl/ai/dashboard
        def dashboard
          render json: {
            success: true,
            data: {
              categorization: ::Gl::CategorizationPrediction.accuracy_stats(@corporate_company),
              anomalies: ::Gl::Anomaly.summary(@corporate_company),
              duplicates: {
                pending: @corporate_company.gl_duplicate_groups.pending.count,
                resolved_this_week: @corporate_company.gl_duplicate_groups
                                                      .where(status: "resolved")
                                                      .where("resolved_at >= ?", 1.week.ago).count
              },
              payment_predictions: {
                high_risk_invoices: @corporate_company.gl_payment_predictions.high_risk.count,
                accuracy: ::Gl::PaymentPrediction.accuracy(@corporate_company)
              },
              at_risk_customers: @corporate_company.gl_customer_payment_stats.at_risk(@corporate_company).count
            }
          }
        end

        private

        def set_corporate_company
          @corporate_company = Corporate.find(params[:corporate_company_id])
        end

        def category_params
          params.require(:category).permit(
            :name, :category_type, :default_account_id, :default_tax_rate_id,
            :confidence_threshold, :active, keywords: [], patterns: []
          )
        end

        def anomaly_rule_params
          params.require(:rule).permit(
            :name, :rule_type, :entity_type, :severity, :active,
            conditions: {}
          )
        end
      end
    end
  end
end
