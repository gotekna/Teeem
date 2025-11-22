# frozen_string_literal: true

module Api
  module V1
    class SmHoldReasonsController < ApplicationController
      before_action :set_hold_reason, only: [:show, :update, :destroy]

      # GET /api/v1/sm_hold_reasons
      def index
        @hold_reasons = SmHoldReason.ordered

        # Filter by active status if specified
        @hold_reasons = @hold_reasons.active if params[:active_only] == 'true'

        render json: {
          success: true,
          hold_reasons: @hold_reasons.map { |hr| hold_reason_to_json(hr) }
        }
      end

      # GET /api/v1/sm_hold_reasons/:id
      def show
        render json: {
          success: true,
          hold_reason: hold_reason_to_json(@hold_reason)
        }
      end

      # POST /api/v1/sm_hold_reasons
      def create
        @hold_reason = SmHoldReason.new(hold_reason_params)

        # Set sequence order to be last + 1
        max_sequence = SmHoldReason.maximum(:sequence_order) || 0
        @hold_reason.sequence_order = max_sequence + 1

        if @hold_reason.save
          render json: {
            success: true,
            message: 'Hold reason created successfully',
            hold_reason: hold_reason_to_json(@hold_reason)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @hold_reason.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/sm_hold_reasons/:id
      def update
        if @hold_reason.update(hold_reason_params)
          render json: {
            success: true,
            hold_reason: hold_reason_to_json(@hold_reason)
          }
        else
          render json: {
            success: false,
            errors: @hold_reason.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_hold_reasons/:id
      def destroy
        # Check if any tasks are using this hold reason
        if SmTask.where(hold_reason_id: @hold_reason.id).exists?
          # Soft delete by marking inactive
          @hold_reason.update!(is_active: false)
          render json: {
            success: true,
            message: 'Hold reason deactivated (has associated tasks)'
          }
        else
          @hold_reason.destroy
          render json: {
            success: true,
            message: 'Hold reason deleted successfully'
          }
        end
      end

      # POST /api/v1/sm_hold_reasons/reorder
      def reorder
        unless params[:hold_reason_ids].is_a?(Array)
          return render json: {
            success: false,
            error: 'hold_reason_ids must be an array'
          }, status: :unprocessable_entity
        end

        SmHoldReason.transaction do
          params[:hold_reason_ids].each_with_index do |id, index|
            SmHoldReason.where(id: id).update_all(sequence_order: index)
          end
        end

        render json: {
          success: true,
          message: 'Hold reasons reordered successfully'
        }
      end

      # POST /api/v1/sm_hold_reasons/seed_defaults
      def seed_defaults
        SmHoldReason.seed_defaults!

        render json: {
          success: true,
          message: "Seeded #{SmHoldReason.count} hold reasons",
          hold_reasons: SmHoldReason.ordered.map { |hr| hold_reason_to_json(hr) }
        }
      end

      private

      def set_hold_reason
        @hold_reason = SmHoldReason.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: 'Hold reason not found'
        }, status: :not_found
      end

      def hold_reason_params
        # Accept both :hold_reason and :sm_hold_reason keys
        key = params.key?(:sm_hold_reason) ? :sm_hold_reason : :hold_reason
        params.require(key).permit(
          :name,
          :description,
          :color,
          :icon,
          :is_active,
          :sequence_order,
          :requires_notes,
          :auto_notify_days
        )
      end

      def hold_reason_to_json(hr)
        {
          id: hr.id,
          name: hr.name,
          description: hr.description,
          color: hr.color,
          icon: hr.icon,
          sequence_order: hr.sequence_order,
          is_active: hr.is_active,
          created_at: hr.created_at,
          updated_at: hr.updated_at
        }
      end
    end
  end
end
