class Api::V1::WHSInductionsController < ApplicationController
  before_action :set_whs_induction, only: [:show, :update, :destroy, :complete, :mark_expired]

  # GET /api/v1/whs_inductions
  def index
    inductions = if params[:user_id].present?
      WhsInduction.for_user(params[:user_id])
    elsif params[:construction_id].present?
      WhsInduction.for_construction(params[:construction_id])
    else
      WhsInduction.all
    end

    # Apply status filter
    inductions = inductions.where(status: params[:status]) if params[:status].present?

    # Apply expired filter
    inductions = inductions.expired if params[:expired] == 'true'

    # Apply expiring soon filter
    if params[:expiring_soon] == 'true'
      days = params[:expiring_soon_days]&.to_i || 30
      inductions = inductions.expiring_soon(days)
    end

    inductions = inductions.includes(:whs_induction_template, :user, :construction, :inducted_by_user)
                           .order(completion_date: :desc)

    # Following B01.003: API response format
    render json: {
      success: true,
      data: inductions.as_json(include: serialization_includes)
    }
  end

  # GET /api/v1/whs_inductions/:id
  def show
    render json: {
      success: true,
      data: @whs_induction.as_json(include: serialization_includes)
    }
  end

  # POST /api/v1/whs_inductions
  def create
    induction = WhsInduction.new(whs_induction_params)

    if induction.save
      render json: {
        success: true,
        data: induction.reload.as_json(include: serialization_includes)
      }, status: :created
    else
      render json: {
        success: false,
        error: induction.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/whs_inductions/:id
  def update
    if @whs_induction.update(whs_induction_params)
      render json: {
        success: true,
        data: @whs_induction.reload.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: @whs_induction.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/whs_inductions/:id
  def destroy
    if @whs_induction.destroy
      render json: {
        success: true,
        data: { message: 'Induction deleted successfully' }
      }
    else
      render json: {
        success: false,
        error: 'Failed to delete induction'
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_inductions/:id/complete
  def complete
    quiz_score = params[:quiz_score]&.to_i
    signature_data = params[:signature_data]

    updates = {
      status: 'valid',
      completion_date: CompanySetting.today
    }

    updates[:quiz_score] = quiz_score if quiz_score.present?
    updates[:signature_data] = signature_data if signature_data.present?

    # Check if quiz passed (if template requires quiz)
    if @whs_induction.whs_induction_template.has_quiz?
      min_score = @whs_induction.whs_induction_template.min_passing_score || 0
      if quiz_score.nil? || quiz_score < min_score
        return render json: {
          success: false,
          error: "Quiz score of #{quiz_score} is below minimum passing score of #{min_score}"
        }, status: :unprocessable_entity
      end
    end

    if @whs_induction.update(updates)
      render json: {
        success: true,
        data: @whs_induction.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: @whs_induction.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_inductions/:id/mark_expired
  def mark_expired
    if @whs_induction.update(status: 'expired')
      render json: {
        success: true,
        data: @whs_induction.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: 'Failed to mark induction as expired'
      }, status: :unprocessable_entity
    end
  end

  private

  def set_whs_induction
    @whs_induction = WhsInduction.find(params[:id])
  end

  def whs_induction_params
    params.require(:whs_induction).permit(
      :certificate_number, :whs_induction_template_id, :user_id,
      :construction_id, :inducted_by_user_id, :completion_date,
      :expiry_date, :status, :quiz_score, :passed, :signature_data,
      :notes
    )
  end

  def serialization_includes
    {
      whs_induction_template: { only: [:id, :name, :version, :has_quiz] },
      user: { only: [:id, :name, :email] },
      construction: { only: [:id, :name, :construction_number] },
      inducted_by_user: { only: [:id, :name, :email] }
    }
  end
end
