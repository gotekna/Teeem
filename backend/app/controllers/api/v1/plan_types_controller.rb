module Api
  module V1
    class PlanTypesController < ApplicationController
      before_action :set_plan_type, only: [:show, :update, :destroy, :assign_categories]

      # GET /api/v1/plan_types
      def index
        @types = PlanType.includes(:plan_categories).ordered

        # Filter by category if provided
        if params[:plan_category_id].present?
          @types = @types.joins(:plan_categories)
                         .where(plan_categories: { id: params[:plan_category_id] })
        end

        render json: {
          success: true,
          data: @types.map { |t| serialize_type(t) }
        }
      end

      # GET /api/v1/plan_types/:id
      def show
        render json: {
          success: true,
          data: serialize_type(@type)
        }
      end

      # POST /api/v1/plan_types
      def create
        @type = PlanType.new(type_params)

        # Handle category assignments
        if params[:plan_type][:category_ids].present?
          @type.plan_category_ids = params[:plan_type][:category_ids]
        end

        if @type.save
          render json: {
            success: true,
            data: serialize_type(@type)
          }, status: :created
        else
          render json: {
            success: false,
            error: @type.errors.full_messages.join(', ')
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/plan_types/:id
      def update
        # Handle category assignments
        if params[:plan_type][:category_ids].present?
          @type.plan_category_ids = params[:plan_type][:category_ids]
        end

        if @type.update(type_params)
          render json: {
            success: true,
            data: serialize_type(@type)
          }
        else
          render json: {
            success: false,
            error: @type.errors.full_messages.join(', ')
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/plan_types/:id
      def destroy
        if @type.job_plans.exists?
          return render json: {
            success: false,
            error: 'Cannot delete plan type that is in use by jobs.'
          }, status: :unprocessable_entity
        end

        @type.destroy
        render json: { success: true }
      end

      # POST /api/v1/plan_types/reorder
      def reorder
        type_ids = params[:type_ids] || []

        type_ids.each_with_index do |id, index|
          PlanType.where(id: id).update_all(sequence_order: index)
        end

        render json: { success: true }
      end

      # GET /api/v1/plan_types/defaults
      # SSoT: Templates from SystemSetting (Admin > System > Plans)
      def defaults
        render json: {
          success: true,
          data: {
            short_name_template: PlanType.default_short_template,
            long_name_template: PlanType.default_long_template
          }
        }
      end

      # PATCH /api/v1/plan_types/defaults
      def update_defaults
        if params[:short_name_template].present?
          PlanType.set_default_short_template(params[:short_name_template])
        end

        if params[:long_name_template].present?
          PlanType.set_default_long_template(params[:long_name_template])
        end

        render json: {
          success: true,
          data: {
            short_name_template: PlanType.default_short_template,
            long_name_template: PlanType.default_long_template
          }
        }
      end

      # POST /api/v1/plan_types/:id/assign_categories
      def assign_categories
        category_ids = params[:category_ids] || []
        @type.plan_category_ids = category_ids

        render json: {
          success: true,
          data: serialize_type(@type)
        }
      end

      private

      def set_plan_type
        @type = PlanType.find(params[:id])
      end

      def type_params
        params.require(:plan_type).permit(
          :code,
          :name,
          :allows_variants,
          :notes,
          :sequence_order,
          :is_active,
          :short_name_template,
          :long_name_template
        )
      end

      def serialize_type(plan_type)
        {
          id: plan_type.id,
          code: plan_type.code,
          name: plan_type.name,
          display_name: plan_type.display_name,
          allows_variants: plan_type.allows_variants,
          notes: plan_type.notes,
          sequence_order: plan_type.sequence_order,
          is_active: plan_type.is_active,
          short_name_template: plan_type.short_name_template,
          long_name_template: plan_type.long_name_template,
          # Effective templates: plan type custom OR global default (for frontend use)
          effective_short_template: plan_type.short_name_template.presence || PlanType.default_short_template,
          effective_long_template: plan_type.long_name_template.presence || PlanType.default_long_template,
          short_name_preview: plan_type.short_name_preview,
          long_name_preview: plan_type.long_name_preview,
          job_plans_count: plan_type.job_plans.count,
          # Many-to-many: return array of categories
          category_ids: plan_type.plan_category_ids,
          category_names: plan_type.category_names,
          categories: plan_type.plan_categories.map { |c| { id: c.id, name: c.name, code: c.code } },
          created_at: plan_type.created_at,
          updated_at: plan_type.updated_at
        }
      end
    end
  end
end
