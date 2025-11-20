class Api::V1::WhsInspectionTemplatesController < ApplicationController
  before_action :set_whs_inspection_template, only: [:show, :update, :destroy]

  # GET /api/v1/whs_inspection_templates
  def index
    templates = WhsInspectionTemplate.all

    # Apply inspection_type filter
    templates = templates.by_type(params[:inspection_type]) if params[:inspection_type].present?

    # Apply active filter
    templates = templates.active if params[:active] == 'true'

    templates = templates.includes(:created_by).order(name: :asc)

    # Following B01.003: API response format
    render json: {
      success: true,
      data: templates.as_json(include: serialization_includes)
    }
  end

  # GET /api/v1/whs_inspection_templates/:id
  def show
    render json: {
      success: true,
      data: @whs_inspection_template.as_json(include: serialization_includes)
    }
  end

  # POST /api/v1/whs_inspection_templates
  def create
    template = WhsInspectionTemplate.new(whs_inspection_template_params)
    template.created_by = current_user

    if template.save
      render json: {
        success: true,
        data: template.reload.as_json(include: serialization_includes)
      }, status: :created
    else
      render json: {
        success: false,
        error: template.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/whs_inspection_templates/:id
  def update
    if @whs_inspection_template.update(whs_inspection_template_params)
      render json: {
        success: true,
        data: @whs_inspection_template.reload.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: @whs_inspection_template.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/whs_inspection_templates/:id
  def destroy
    if @whs_inspection_template.destroy
      render json: {
        success: true,
        data: { message: 'Inspection template deleted successfully' }
      }
    else
      render json: {
        success: false,
        error: 'Failed to delete inspection template'
      }, status: :unprocessable_entity
    end
  end

  private

  def set_whs_inspection_template
    @whs_inspection_template = WhsInspectionTemplate.find(params[:id])
  end

  def whs_inspection_template_params
    params.require(:whs_inspection_template).permit(
      :name, :description, :inspection_type, :active,
      :pass_threshold_percentage,
      checklist_items: [
        :description, :category, :photo_required, :notes_required, :weight
      ]
    )
  end

  def serialization_includes
    {
      created_by: { only: [:id, :name, :email] }
    }
  end
end
