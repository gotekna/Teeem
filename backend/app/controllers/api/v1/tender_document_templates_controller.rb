# frozen_string_literal: true

class Api::V1::TenderDocumentTemplatesController < ApplicationController
  before_action :set_template, only: [ :update, :destroy ]

  # GET /api/v1/tender_document_templates
  def index
    templates = TenderDocumentTemplate.active.order(:name)

    render json: {
      success: true,
      data: templates.map { |t| template_json(t) }
    }
  end

  # GET /api/v1/tender_document_templates/default
  def default
    template = TenderDocumentTemplate.default_template.first

    render json: {
      success: true,
      data: template ? template_json(template) : nil
    }
  end

  # POST /api/v1/tender_document_templates
  def create
    template = TenderDocumentTemplate.new(template_params)

    if template.save
      render json: {
        success: true,
        data: template_json(template)
      }, status: :created
    else
      render_validation_errors(template)
    end
  end

  # PATCH /api/v1/tender_document_templates/:id
  def update
    if @template.update(template_params)
      render json: {
        success: true,
        data: template_json(@template)
      }
    else
      render_validation_errors(@template)
    end
  end

  # DELETE /api/v1/tender_document_templates/:id
  def destroy
    @template.update!(is_active: false)

    render json: {
      success: true,
      data: { message: "Template deactivated" }
    }
  end

  private

  def set_template
    @template = TenderDocumentTemplate.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render_error("Tender document template not found", status: :not_found)
  end

  def template_params
    params.require(:tender_document_template).permit(
      :name,
      :cover_letter_html,
      :terms_and_conditions_html,
      :base_specification_html,
      :acceptance_page_html,
      :notes_html,
      :validity_days,
      :is_default
    )
  end

  def template_json(template)
    {
      id: template.id,
      name: template.name,
      coverLetterHtml: template.cover_letter_html,
      termsAndConditionsHtml: template.terms_and_conditions_html,
      baseSpecificationHtml: template.base_specification_html,
      acceptancePageHtml: template.acceptance_page_html,
      notesHtml: template.notes_html,
      validityDays: template.validity_days,
      isDefault: template.is_default,
      isActive: template.is_active,
      createdAt: template.created_at,
      updatedAt: template.updated_at
    }
  end
end
