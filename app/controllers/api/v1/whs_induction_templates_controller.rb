class Api::V1::WhsInductionTemplatesController < ApplicationController
  before_action :set_whs_induction_template, only: [:show, :update, :destroy]

  # GET /api/v1/whs_induction_templates
  def index
    templates = WhsInductionTemplate.all

    # Apply active filter
    templates = templates.active if params[:active] == 'true'

    # Apply construction_specific filter
    templates = templates.construction_specific if params[:construction_specific] == 'true'

    # Apply company_wide filter
    templates = templates.company_wide if params[:company_wide] == 'true'

    templates = templates.includes(:created_by).order(name: :asc)

    # Following B01.003: API response format
    render json: {
      success: true,
      data: templates.as_json(include: serialization_includes)
    }
  end

  # GET /api/v1/whs_induction_templates/:id
  def show
    render json: {
      success: true,
      data: @whs_induction_template.as_json(include: serialization_includes)
    }
  end

  # POST /api/v1/whs_induction_templates
  def create
    template = WhsInductionTemplate.new(whs_induction_template_params)
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

  # PATCH /api/v1/whs_induction_templates/:id
  def update
    if @whs_induction_template.update(whs_induction_template_params)
      render json: {
        success: true,
        data: @whs_induction_template.reload.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: @whs_induction_template.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/whs_induction_templates/:id
  def destroy
    if @whs_induction_template.destroy
      render json: {
        success: true,
        data: { message: 'Induction template deleted successfully' }
      }
    else
      render json: {
        success: false,
        error: 'Failed to delete induction template'
      }, status: :unprocessable_entity
    end
  end

  private

  def set_whs_induction_template
    @whs_induction_template = WhsInductionTemplate.find(params[:id])
  end

  def whs_induction_template_params
    params.require(:whs_induction_template).permit(
      :name, :description, :version, :active, :construction_specific,
      :company_wide, :expiry_months, :has_quiz, :min_passing_score,
      content_sections: [
        :title, :content, :video_url,
        quiz_questions: [
          :question, :question_type, answers: [], :correct_answer
        ]
      ]
    )
  end

  def serialization_includes
    {
      created_by: { only: [:id, :name, :email] }
    }
  end
end
