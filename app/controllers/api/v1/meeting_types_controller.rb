class Api::V1::MeetingTypesController < ApplicationController
  before_action :set_meeting_type, only: [:show, :update, :destroy]

  # GET /api/v1/meeting_types
  def index
    meeting_types = if params[:active_only] == 'true'
      MeetingType.active
    elsif params[:category].present?
      MeetingType.by_category(params[:category])
    else
      MeetingType.all
    end

    meeting_types = meeting_types.order(:category, :name)

    render json: {
      success: true,
      data: meeting_types.map(&:to_template)
    }
  end

  # GET /api/v1/meeting_types/:id
  def show
    render json: {
      success: true,
      data: @meeting_type.to_template
    }
  end

  # POST /api/v1/meeting_types
  def create
    meeting_type = MeetingType.new(meeting_type_params)

    if meeting_type.save
      render json: {
        success: true,
        data: meeting_type.to_template
      }, status: :created
    else
      render json: {
        success: false,
        error: meeting_type.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/meeting_types/:id
  def update
    if @meeting_type.is_system_default && params[:meeting_type][:is_active] == false
      render json: {
        success: false,
        error: 'Cannot deactivate system default meeting type'
      }, status: :unprocessable_entity
      return
    end

    if @meeting_type.update(meeting_type_params)
      render json: {
        success: true,
        data: @meeting_type.to_template
      }
    else
      render json: {
        success: false,
        error: @meeting_type.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/meeting_types/:id
  def destroy
    if @meeting_type.is_system_default
      render json: {
        success: false,
        error: 'Cannot delete system default meeting type'
      }, status: :forbidden
      return
    end

    if @meeting_type.meetings.any?
      render json: {
        success: false,
        error: 'Cannot delete meeting type that is being used by existing meetings'
      }, status: :unprocessable_entity
      return
    end

    if @meeting_type.destroy
      render json: {
        success: true,
        data: { message: 'Meeting type deleted successfully' }
      }
    else
      render json: {
        success: false,
        error: 'Failed to delete meeting type'
      }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/meeting_types/categories
  def categories
    render json: {
      success: true,
      data: MeetingType.categories
    }
  end

  private

  def set_meeting_type
    @meeting_type = MeetingType.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: {
      success: false,
      error: 'Meeting type not found'
    }, status: :not_found
  end

  def meeting_type_params
    params.require(:meeting_type).permit(
      :name, :description, :category, :icon, :color,
      :default_duration_minutes, :minimum_participants, :maximum_participants,
      :is_active,
      required_participant_types: [],
      optional_participant_types: [],
      default_agenda_items: [:title, :duration_minutes],
      required_fields: [],
      optional_fields: [],
      custom_fields: [:name, :type, :label, :required, :options],
      required_documents: [],
      notification_settings: [:send_reminder, :reminder_hours]
    )
  end
end
