# frozen_string_literal: true

module Api
  module V1
    # TakeoffTemplatesController - API for measurement templates
    #
    # Templates allow users to save and reuse common measurement patterns
    # e.g., "Door" template = count + linear for frame
    # e.g., "Room" template = area (floor) + perimeter (baseboards) + walls
    #
    class TakeoffTemplatesController < ApplicationController
      before_action :authenticate_user!
      before_action :set_template, only: [:show, :update, :destroy, :duplicate]

      # GET /api/v1/pdf_takeoff/templates
      # List all templates for the current tenant
      def index
        scope = TakeoffTemplate.active.ordered

        # Optional filters
        scope = scope.by_category(params[:category]) if params[:category].present?
        scope = scope.system_templates if params[:system_only] == "true"
        scope = scope.user_templates if params[:user_only] == "true"

        templates = scope.map { |t| template_json(t) }

        render json: {
          success: true,
          data: {
            templates: templates,
            categories: TakeoffTemplate::CATEGORIES
          }
        }
      end

      # GET /api/v1/pdf_takeoff/templates/:id
      def show
        render json: {
          success: true,
          data: template_json(@template, include_steps: true)
        }
      end

      # POST /api/v1/pdf_takeoff/templates
      # Create a new template
      def create
        template = TakeoffTemplate.new(template_params)
        template.tenant = current_tenant
        template.created_by = current_user

        if template.save
          render json: {
            success: true,
            data: template_json(template, include_steps: true)
          }, status: :created
        else
          render json: { success: false, errors: template.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/pdf_takeoff/templates/:id
      def update
        # Don't allow editing system templates directly
        if @template.is_system?
          return render json: { success: false, error: "Cannot edit system templates. Duplicate to customize." }, status: :forbidden
        end

        if @template.update(template_params)
          render json: {
            success: true,
            data: template_json(@template, include_steps: true)
          }
        else
          render json: { success: false, errors: @template.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/pdf_takeoff/templates/:id
      def destroy
        # Don't allow deleting system templates
        if @template.is_system?
          return render json: { success: false, error: "Cannot delete system templates" }, status: :forbidden
        end

        @template.update(is_active: false)  # Soft delete
        render json: { success: true }
      end

      # POST /api/v1/pdf_takeoff/templates/:id/duplicate
      # Create a copy of a template for customization
      def duplicate
        copy = @template.duplicate_for(current_user)
        copy.tenant = current_tenant

        if copy.save
          render json: {
            success: true,
            data: template_json(copy, include_steps: true)
          }, status: :created
        else
          render json: { success: false, errors: copy.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/pdf_takeoff/templates/:id/record_usage
      # Track template usage (called when template is applied)
      def record_usage
        set_template
        @template.record_usage!
        render json: { success: true }
      end

      # GET /api/v1/pdf_takeoff/templates/system_defaults
      # Get/create default system templates
      def system_defaults
        ensure_system_templates_exist!

        templates = TakeoffTemplate.system_templates.active.ordered.map do |t|
          template_json(t, include_steps: true)
        end

        render json: {
          success: true,
          data: { templates: templates }
        }
      end

      private

      def set_template
        @template = TakeoffTemplate.find(params[:id])
      end

      def template_params
        params.require(:template).permit(
          :name, :description, :category,
          configuration: {}
        )
      end

      def template_json(template, include_steps: false)
        data = {
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          is_system: template.is_system,
          step_count: template.step_count,
          usage_count: template.usage_count,
          created_at: template.created_at
        }

        data[:steps] = template.steps if include_steps
        data
      end

      def ensure_system_templates_exist!
        return if TakeoffTemplate.system_templates.exists?

        # Create default system templates
        default_templates.each do |attrs|
          TakeoffTemplate.create!(
            tenant: current_tenant,
            is_system: true,
            **attrs
          )
        end
      end

      def default_templates
        [
          {
            name: "Door",
            description: "Count doors and measure frame perimeter",
            category: "doors",
            configuration: {
              "steps" => [
                { "type" => "count", "label" => "Door Count", "color" => "#3B82F6", "prompt" => "Click on each door location" },
                { "type" => "linear", "label" => "Door Frame", "color" => "#22C55E", "prompt" => "Trace around the door frame" }
              ]
            }
          },
          {
            name: "Window",
            description: "Count windows and measure opening size",
            category: "windows",
            configuration: {
              "steps" => [
                { "type" => "count", "label" => "Window Count", "color" => "#06B6D4", "prompt" => "Click on each window location" },
                { "type" => "area", "label" => "Window Opening", "color" => "#06B6D4", "prompt" => "Draw rectangle around window" }
              ]
            }
          },
          {
            name: "Room - Flooring",
            description: "Measure floor area with deductions for fixtures",
            category: "rooms",
            configuration: {
              "steps" => [
                { "type" => "area", "label" => "Floor Area", "color" => "#A855F7", "prompt" => "Draw polygon around room perimeter" },
                { "type" => "area", "label" => "Deduct Fixtures", "color" => "#EF4444", "prompt" => "Draw areas to deduct (optional)", "is_optional" => true }
              ]
            }
          },
          {
            name: "Room - Full",
            description: "Complete room: floor, walls, ceiling, baseboards",
            category: "rooms",
            configuration: {
              "steps" => [
                { "type" => "area", "label" => "Floor Area (m²)", "color" => "#A855F7", "prompt" => "Draw polygon around room floor" },
                { "type" => "perimeter", "label" => "Baseboards (m)", "color" => "#EAB308", "prompt" => "Trace along wall base (exclude doors)" },
                { "type" => "area", "label" => "Ceiling Area (m²)", "color" => "#6B7280", "prompt" => "Draw polygon around ceiling (same as floor if flat)" },
                { "type" => "linear", "label" => "Wall Height", "color" => "#22C55E", "prompt" => "Draw line from floor to ceiling" }
              ]
            }
          },
          {
            name: "Linear Run",
            description: "Measure continuous linear elements (pipes, cables, etc.)",
            category: "custom",
            configuration: {
              "steps" => [
                { "type" => "linear", "label" => "Linear Run", "color" => "#F97316", "prompt" => "Trace along the linear element" }
              ]
            }
          },
          {
            name: "Electrical Outlets",
            description: "Count power points and switches",
            category: "electrical",
            configuration: {
              "steps" => [
                { "type" => "count", "label" => "Power Points", "color" => "#EAB308", "prompt" => "Click on each power point" },
                { "type" => "count", "label" => "Light Switches", "color" => "#F97316", "prompt" => "Click on each light switch" },
                { "type" => "count", "label" => "Down Lights", "color" => "#FBBF24", "prompt" => "Click on each down light" }
              ]
            }
          },
          {
            name: "Plumbing Fixtures",
            description: "Count bathroom and kitchen fixtures",
            category: "plumbing",
            configuration: {
              "steps" => [
                { "type" => "count", "label" => "Toilets", "color" => "#60A5FA", "prompt" => "Click on each toilet" },
                { "type" => "count", "label" => "Basins", "color" => "#34D399", "prompt" => "Click on each basin/sink" },
                { "type" => "count", "label" => "Showers", "color" => "#A78BFA", "prompt" => "Click on each shower" },
                { "type" => "count", "label" => "Taps/Mixers", "color" => "#F87171", "prompt" => "Click on each tap point" }
              ]
            }
          }
        ]
      end
    end
  end
end
