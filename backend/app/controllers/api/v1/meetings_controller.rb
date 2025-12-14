class Api::V1::MeetingsController < ApplicationController
  before_action :set_meeting, only: [ :show, :update, :destroy, :start, :complete, :cancel ]

  # GET /api/v1/meetings
  def index
    meetings = if params[:job_id].present?
      Meeting.for_construction(params[:job_id])
    elsif params[:user_id].present?
      Meeting.for_user(params[:user_id])
    else
      Meeting.all
    end

    meetings = meetings.includes(:construction, :created_by, :meeting_participants, :meeting_agenda_items)
                       .order(start_time: :desc)

    # Following B01.003: API response format
    render json: {
      success: true,
      data: meetings.as_json(include: serialization_includes)
    }
  end

  # GET /api/v1/meetings/:id
  def show
    render json: {
      success: true,
      data: @meeting.as_json(include: serialization_includes)
    }
  end

  # POST /api/v1/meetings
  def create
    meeting = Meeting.new(meeting_params)
    meeting.created_by = current_user

    if meeting.save
      # Create participants if provided
      create_participants(meeting, params[:participants]) if params[:participants].present?

      # Create agenda items if provided
      create_agenda_items(meeting, params[:agenda_items]) if params[:agenda_items].present?

      render json: {
        success: true,
        data: meeting.reload.as_json(include: serialization_includes)
      }, status: :created
    else
      render json: {
        success: false,
        error: meeting.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/meetings/:id
  def update
    if @meeting.update(meeting_params)
      # Update participants if provided
      update_participants(@meeting, params[:participants]) if params[:participants].present?

      # Update agenda items if provided
      update_agenda_items(@meeting, params[:agenda_items]) if params[:agenda_items].present?

      render json: {
        success: true,
        data: @meeting.reload.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: @meeting.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/meetings/:id
  def destroy
    if @meeting.destroy
      render json: {
        success: true,
        data: { message: "Meeting deleted successfully" }
      }
    else
      render json: {
        success: false,
        error: "Failed to delete meeting"
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/meetings/:id/start
  def start
    if @meeting.start!
      render json: {
        success: true,
        data: @meeting.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: "Cannot start meeting"
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/meetings/:id/complete
  def complete
    if @meeting.complete!
      render json: {
        success: true,
        data: @meeting.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: "Cannot complete meeting"
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/meetings/:id/cancel
  def cancel
    if @meeting.cancel!
      render json: {
        success: true,
        data: @meeting.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: "Cannot cancel meeting"
      }, status: :unprocessable_entity
    end
  end

  private

  def set_meeting
    @meeting = Meeting.find(params[:id])
  end

  def meeting_params
    params.require(:meeting).permit(
      :title, :description, :start_time, :end_time, :location,
      :meeting_type, :status, :job_id, :notes, :video_url
    )
  end

  def serialization_includes
    {
      construction: {},
      created_by: {},
      meeting_participants: {
        include: {
          user: {},
          contact: {}
        }
      },
      meeting_agenda_items: {
        include: {
          presenter: {},
          created_task: {}
        }
      }
    }
  end

  def create_participants(meeting, participants_data)
    participants_data.each do |participant|
      meeting.meeting_participants.create(participant.permit(
        :user_id, :contact_id, :is_organizer, :is_required, :response_status, :notes
      ))
    end
  end

  def update_participants(meeting, participants_data)
    # Simple approach: delete all and recreate
    meeting.meeting_participants.destroy_all
    create_participants(meeting, participants_data)
  end

  def create_agenda_items(meeting, agenda_items_data)
    agenda_items_data.each_with_index do |item, index|
      meeting.meeting_agenda_items.create(item.permit(
        :title, :description, :duration_minutes, :presenter_id, :notes
      ).merge(sequence_order: index + 1))
    end
  end

  def update_agenda_items(meeting, agenda_items_data)
    # Simple approach: delete all and recreate
    meeting.meeting_agenda_items.destroy_all
    create_agenda_items(meeting, agenda_items_data)
  end
end
