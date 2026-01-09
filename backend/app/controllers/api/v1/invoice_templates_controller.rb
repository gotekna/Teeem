# frozen_string_literal: true

module Api
  module V1
    class InvoiceTemplatesController < ApplicationController
      before_action :set_template, only: [:show, :update, :destroy, :duplicate, :set_default]

      # GET /api/v1/invoice_templates
      def index
        templates = InvoiceTemplate.all
        templates = templates.active if params[:active_only] == "true"
        templates = templates.order(:name)

        render json: {
          success: true,
          data: templates.map { |t| template_json(t) }
        }
      end

      # GET /api/v1/invoice_templates/:id
      def show
        render json: {
          success: true,
          data: template_json(@template, include_sections: true)
        }
      end

      # POST /api/v1/invoice_templates
      def create
        @template = InvoiceTemplate.new(template_params)

        # Use default sections if none provided
        if @template.sections.blank?
          @template.sections = InvoiceTemplate.default_sections
        end

        if @template.save
          render json: { success: true, data: template_json(@template, include_sections: true) },
                 status: :created
        else
          render json: { success: false, error: @template.errors.full_messages.join(", ") },
                 status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/invoice_templates/:id
      def update
        if @template.update(template_params)
          render json: { success: true, data: template_json(@template, include_sections: true) }
        else
          render json: { success: false, error: @template.errors.full_messages.join(", ") },
                 status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/invoice_templates/:id
      def destroy
        if @template.is_default?
          return render json: { success: false, error: "Cannot delete the default template" },
                        status: :unprocessable_entity
        end

        @template.destroy
        render json: { success: true, data: { id: params[:id] } }
      end

      # POST /api/v1/invoice_templates/:id/duplicate
      def duplicate
        new_template = @template.dup
        new_template.name = "#{@template.name} (Copy)"
        new_template.is_default = false

        if new_template.save
          render json: { success: true, data: template_json(new_template, include_sections: true) },
                 status: :created
        else
          render json: { success: false, error: new_template.errors.full_messages.join(", ") },
                 status: :unprocessable_entity
        end
      end

      # POST /api/v1/invoice_templates/:id/set_default
      def set_default
        @template.update!(is_default: true)

        render json: {
          success: true,
          data: template_json(@template),
          message: "#{@template.name} is now the default template"
        }
      end

      # GET /api/v1/invoice_templates/default_sections
      # Returns the default section structure for creating new templates
      def default_sections
        render json: {
          success: true,
          data: {
            sections: InvoiceTemplate.default_sections,
            section_types: InvoiceTemplate::SECTION_TYPES,
            paper_sizes: InvoiceTemplate::PAPER_SIZES,
            orientations: InvoiceTemplate::ORIENTATIONS
          }
        }
      end

      private

      def set_template
        @template = InvoiceTemplate.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Template not found" }, status: :not_found
      end

      def template_params
        params.require(:invoice_template).permit(
          :name, :description, :is_active, :is_default,
          :logo_url, :primary_color, :accent_color, :font_family,
          :paper_size, :orientation, :output_naming_pattern,
          :default_terms, :default_notes, :footer_text,
          :bank_name, :bank_bsb, :bank_account_number, :bank_account_name,
          sections: [:type, :visible, :order, content: {}],
          margins: [:top, :right, :bottom, :left]
        )
      end

      def template_json(template, include_sections: false)
        json = {
          id: template.id,
          name: template.name,
          description: template.description,
          is_active: template.is_active,
          is_default: template.is_default,
          logo_url: template.logo_url,
          primary_color: template.primary_color,
          accent_color: template.accent_color,
          font_family: template.font_family,
          paper_size: template.paper_size,
          orientation: template.orientation,
          output_naming_pattern: template.output_naming_pattern,
          bank_details: template.bank_details,
          created_at: template.created_at,
          updated_at: template.updated_at
        }

        if include_sections
          json[:sections] = template.section_list
          json[:margins] = template.margins
          json[:default_terms] = template.default_terms
          json[:default_notes] = template.default_notes
          json[:footer_text] = template.footer_text
        end

        json
      end
    end
  end
end
