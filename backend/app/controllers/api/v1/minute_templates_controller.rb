module Api
  module V1
    class MinuteTemplatesController < ApplicationController
      before_action :set_minute_template, only: [ :show, :update, :destroy, :preview ]

      # GET /api/v1/minute_templates
      def index
        @templates = MinuteTemplate.all

        # Filter by template type
        if params[:template_type].present?
          @templates = @templates.where(template_type: params[:template_type])
        end

        # Filter by active status
        @templates = @templates.where(active: true) unless params[:include_inactive] == "true"

        @templates = @templates.order(:template_type, :name)

        render json: {
          success: true,
          data: @templates.map { |t| serialize_template(t) }
        }
      end

      # GET /api/v1/minute_templates/:id
      def show
        render json: {
          success: true,
          data: serialize_template(@minute_template, include_body: true)
        }
      end

      # POST /api/v1/minute_templates
      def create
        @minute_template = MinuteTemplate.new(minute_template_params)

        if @minute_template.save
          render json: {
            success: true,
            data: serialize_template(@minute_template, include_body: true)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @minute_template.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/minute_templates/:id
      def update
        if @minute_template.update(minute_template_params)
          render json: {
            success: true,
            data: serialize_template(@minute_template, include_body: true)
          }
        else
          render json: {
            success: false,
            errors: @minute_template.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/minute_templates/:id
      def destroy
        if @minute_template.company_minutes.any?
          return render json: {
            success: false,
            errors: [ "Cannot delete template with existing minutes" ]
          }, status: :unprocessable_entity
        end

        @minute_template.destroy
        render json: { success: true }
      end

      # POST /api/v1/minute_templates/:id/preview
      # Preview template with sample data
      def preview
        variables = params[:variables] || {}

        # Merge with sample data for missing variables
        sample_data = {
          "company_name" => "Sample Company Pty Ltd",
          "acn" => "123 456 789",
          "abn" => "12 345 678 901",
          "director_name" => "John Smith",
          "secretary_name" => "Jane Doe",
          "registered_office" => "123 Sample Street, Brisbane QLD 4000",
          "meeting_date" => Date.current.strftime("%d %B %Y"),
          "resolution_date" => Date.current.strftime("%d %B %Y"),
          "distribution_amount" => "$100,000.00",
          "trust_name" => "Sample Family Trust",
          "beneficiary_name" => "Sample Beneficiary"
        }

        merged_variables = sample_data.merge(variables.to_h)

        preview_content = render_template(@minute_template.body, merged_variables)

        render json: {
          success: true,
          data: {
            template: serialize_template(@minute_template),
            preview: preview_content,
            variables_used: extract_variables(@minute_template.body),
            variables_provided: merged_variables
          }
        }
      end

      private

      def set_minute_template
        @minute_template = MinuteTemplate.find(params[:id])
      end

      def minute_template_params
        params.require(:minute_template).permit(
          :name,
          :template_type,
          :body,
          :required_fields,
          :active
        )
      end

      def serialize_template(template, include_body: false)
        data = {
          id: template.id,
          name: template.name,
          template_type: template.template_type,
          required_fields: template.required_fields,
          active: template.active,
          minutes_count: template.company_minutes.count,
          created_at: template.created_at,
          updated_at: template.updated_at
        }

        if include_body
          data[:body] = template.body
          data[:variables] = extract_variables(template.body)
        end

        data
      end

      def extract_variables(body)
        return [] unless body.present?
        body.scan(/\{\{(\w+)\}\}/).flatten.uniq
      end

      def render_template(body, variables)
        return "" unless body.present?

        result = body.dup
        variables.each do |key, value|
          result.gsub!("{{#{key}}}", value.to_s)
        end
        result
      end
    end
  end
end
