# frozen_string_literal: true

module Api
  module V1
    module Gl
      class BankRulesLearningController < ApplicationController
        # GET /api/v1/gl/bank_rules_learning/suggestions
        def suggestions
          learner = ::Gl::BankRulesLearner.new(current_company)
          suggestions = learner.suggest_rules(limit: params[:limit]&.to_i || 10)

          render json: {
            success: true,
            data: {
              suggestions: suggestions,
              count: suggestions.count
            }
          }
        end

        # POST /api/v1/gl/bank_rules_learning/record
        def record
          bank_line = find_bank_line(params[:bank_line_id])
          account = ::Gl::Account.find(params[:account_id])

          learner = ::Gl::BankRulesLearner.new(current_company)
          learner.record_categorization(
            bank_line: bank_line,
            account: account,
            user: current_user
          )

          render json: {
            success: true,
            message: "Categorization recorded for learning"
          }
        end

        # POST /api/v1/gl/bank_rules_learning/create_rule
        def create_rule
          learner = ::Gl::BankRulesLearner.new(current_company)
          rule = learner.create_rule_from_suggestion(suggestion_params)

          render json: {
            success: true,
            data: rule_json(rule),
            message: "Rule created from suggestion"
          }
        end

        # GET /api/v1/gl/bank_rules_learning/stats
        def stats
          learner = ::Gl::BankRulesLearner.new(current_company)

          render json: {
            success: true,
            data: learner.stats
          }
        end

        private

        def find_bank_line(id)
          # Try reconciliation line first, then bank statement line
          ::Gl::ReconciliationLine.find_by(id: id) ||
            ::Gl::BankStatementLine.find(id)
        end

        def suggestion_params
          params.permit(
            :suggested_name, :match_type, :match_value,
            :account_id, :transaction_type, :confidence, :pattern_count
          ).to_h.symbolize_keys
        end

        def rule_json(rule)
          {
            id: rule.id,
            name: rule.name,
            match_type: rule.match_type,
            match_value: rule.match_value,
            account_name: rule.gl_account&.name,
            auto_created: rule.auto_created,
            confidence: rule.confidence
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
