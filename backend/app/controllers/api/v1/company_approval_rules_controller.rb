# frozen_string_literal: true

module Api
  module V1
    class CompanyApprovalRulesController < ApplicationController
      before_action :set_rule, only: [ :show, :update, :destroy ]

      # GET /api/v1/company_approval_rules
      def index
        rules = CompanyApprovalRule.includes(:corporate, :bpmn_process)

        # Filter by company
        if params[:corporate_id].present?
          rules = rules.where(company_id: params[:corporate_id])
        end

        # Filter by rule type
        rules = rules.where(rule_type: params[:rule_type]) if params[:rule_type].present?

        # Filter by active status
        rules = rules.where(is_active: params[:is_active]) if params[:is_active].present?

        rules = rules.order(priority: :asc, created_at: :desc)

        render json: rules.as_json(include: {
          corporate: {},
          bpmn_process: {}
        })
      end

      # GET /api/v1/company_approval_rules/:id
      def show
        render json: @rule.as_json(include: {
          corporate: {},
          bpmn_process: {}
        })
      end

      # POST /api/v1/company_approval_rules
      def create
        @rule = CompanyApprovalRule.new(rule_params)

        if @rule.save
          render json: @rule, status: :created
        else
          render json: { errors: @rule.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/company_approval_rules/:id
      def update
        if @rule.update(rule_params)
          render json: @rule
        else
          render json: { errors: @rule.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/company_approval_rules/:id
      def destroy
        @rule.destroy
        render json: { success: true }
      end

      private

      def set_rule
        @rule = CompanyApprovalRule.find(params[:id])
      end

      def rule_params
        params.permit(
          :corporate_id, :rule_type, :name,
          :min_amount, :max_amount, :variance_threshold_percent,
          :approver_type, :approver_id, :bpmn_process_id,
          :priority, :is_active
        )
      end
    end
  end
end
