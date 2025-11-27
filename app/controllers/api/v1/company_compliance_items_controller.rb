module Api
  module V1
    class CompanyComplianceItemsController < ApplicationController
      before_action :set_compliance_item, only: [:show, :update, :destroy, :mark_completed]

      # GET /api/v1/company_compliance_items
      def index
        @items = CompanyComplianceItem.includes(:company).all

        # Filter by company
        @items = @items.where(company_id: params[:company_id]) if params[:company_id].present?

        # Filter by status
        @items = @items.where(status: params[:status]) if params[:status].present?

        # Filter by type
        @items = @items.by_type(params[:compliance_type]) if params[:compliance_type].present?

        # Special filters
        @items = @items.overdue if params[:overdue] == 'true'
        @items = @items.due_soon(params[:days]&.to_i || 30) if params[:due_soon] == 'true'

        # Sort
        @items = @items.order(:due_date)

        render json: {
          success: true,
          compliance_items: @items.as_json(
            include: { company: { only: [:id, :name] } },
            methods: [:days_until_due, :formatted_compliance_type, :overdue?, :due_soon?]
          )
        }
      end

      # GET /api/v1/company_compliance_items/:id
      def show
        render json: {
          success: true,
          compliance_item: @item.as_json(
            include: { company: { only: [:id, :name] } },
            methods: [:days_until_due, :formatted_compliance_type, :reminder_days]
          )
        }
      end

      # POST /api/v1/company_compliance_items
      def create
        @item = CompanyComplianceItem.new(compliance_item_params)

        if @item.save
          render json: {
            success: true,
            message: 'Compliance item created successfully',
            compliance_item: @item.as_json(methods: [:formatted_compliance_type])
          }, status: :created
        else
          render json: {
            success: false,
            errors: @item.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/company_compliance_items/:id
      def update
        if @item.update(compliance_item_params)
          render json: {
            success: true,
            message: 'Compliance item updated successfully',
            compliance_item: @item.as_json(methods: [:formatted_compliance_type])
          }
        else
          render json: {
            success: false,
            errors: @item.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/company_compliance_items/:id
      def destroy
        @item.destroy
        render json: {
          success: true,
          message: 'Compliance item deleted successfully'
        }
      end

      # POST /api/v1/company_compliance_items/:id/mark_completed
      def mark_completed
        @item.mark_completed!

        render json: {
          success: true,
          message: 'Compliance item marked as completed',
          compliance_item: @item.as_json(methods: [:formatted_compliance_type])
        }
      end

      private

      def set_compliance_item
        @item = CompanyComplianceItem.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Compliance item not found' }, status: :not_found
      end

      def compliance_item_params
        params.require(:company_compliance_item).permit(
          :company_id, :compliance_type, :title, :description, :due_date, :completed_date,
          :status, :reminder_90_days, :reminder_60_days, :reminder_30_days, :reminder_7_days,
          :notification_recipients, :is_recurring, :recurrence_frequency
        )
      end
    end
  end
end
