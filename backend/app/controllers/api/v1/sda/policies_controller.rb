# frozen_string_literal: true

module Api
  module V1
    module Sda
      class PoliciesController < ApplicationController
        before_action :set_policy, only: [:show, :update, :destroy, :approve]

        # GET /api/v1/sda/policies
        def index
          policies = SdaPolicy
            .includes(:owner_user, :approved_by_user)
            .order(title: :asc)

          policies = apply_filters(policies)

          render_success(policies.as_json(include: {
            owner_user: { only: [:id, :name, :email] },
            approved_by_user: { only: [:id, :name, :email] }
          }))
        end

        # GET /api/v1/sda/policies/:id
        def show
          render_success(@policy.as_json(include: {
            owner_user: { only: [:id, :name, :email] },
            approved_by_user: { only: [:id, :name, :email] }
          }))
        end

        # POST /api/v1/sda/policies
        def create
          policy = SdaPolicy.new(policy_params)

          if policy.save
            render_success(policy, status: :created)
          else
            render_validation_errors(policy)
          end
        end

        # PATCH /api/v1/sda/policies/:id
        def update
          if @policy.update(policy_params)
            render_success(@policy)
          else
            render_validation_errors(@policy)
          end
        end

        # DELETE /api/v1/sda/policies/:id
        def destroy
          @policy.destroy
          render_success
        end

        # POST /api/v1/sda/policies/:id/approve
        def approve
          if @policy.update(
            approved_by_user: current_user,
            approved_date: Date.current,
            status: "active",
            effective_date: params[:effective_date].presence || Date.current,
            last_reviewed_date: Date.current,
            review_date: Date.current + (@policy.review_interval_months || 12).months
          )
            render_success(@policy)
          else
            render_validation_errors(@policy)
          end
        end

        # GET /api/v1/sda/policies/due_for_review
        def due_for_review
          policies = SdaPolicy
            .includes(:owner_user)
            .due_for_review
            .order(review_date: :asc)

          render_success(policies.as_json(include: {
            owner_user: { only: [:id, :name, :email] }
          }).map do |p|
            p.merge("daysOverdue" => (Date.current - Date.parse(p["review_date"])).to_i)
          end)
        end

        # GET /api/v1/sda/policies/dashboard
        def dashboard
          total = SdaPolicy.count
          active = SdaPolicy.active.count
          due_review = SdaPolicy.due_for_review.count
          ndis_required = SdaPolicy.ndis_required.count
          ndis_active = SdaPolicy.ndis_required.active.count

          by_category = SdaPolicy::CATEGORIES.index_with do |cat|
            {
              total: SdaPolicy.where(category: cat).count,
              active: SdaPolicy.where(category: cat).active.count
            }
          end.reject { |_, v| v[:total].zero? }

          render_success({
            total: total,
            active: active,
            dueForReview: due_review,
            ndisRequired: ndis_required,
            ndisCompliant: ndis_active,
            byCategory: by_category
          })
        end

        private

        def set_policy
          @policy = SdaPolicy.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render_error("Policy not found", status: :not_found)
        end

        def policy_params
          params.require(:sda_policy).permit(
            :policy_type, :category, :title, :reference_number,
            :status, :version, :effective_date, :review_date,
            :last_reviewed_date, :expiry_date, :review_interval_months,
            :summary, :content, :document_blob_id,
            :owner_user_id, :ndis_practice_standard, :ndis_required
          )
        end

        def apply_filters(scope)
          scope = scope.where(policy_type: params[:policy_type]) if params[:policy_type].present?
          scope = scope.where(category: params[:category]) if params[:category].present?
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where(ndis_required: true) if params[:ndis_required] == "true"
          scope
        end
      end
    end
  end
end
