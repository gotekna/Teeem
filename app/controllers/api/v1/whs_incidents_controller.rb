class Api::V1::WHSIncidentsController < ApplicationController
  before_action :set_whs_incident, only: [:show, :update, :destroy, :investigate, :close, :notify_workcov]

  # GET /api/v1/whs_incidents
  def index
    incidents = if params[:construction_id].present?
      WhsIncident.for_construction(params[:construction_id])
    else
      WhsIncident.all
    end

    # Apply status filter
    incidents = incidents.where(status: params[:status]) if params[:status].present?

    # Apply category filter
    incidents = incidents.by_category(params[:incident_category]) if params[:incident_category].present?

    # Apply severity filter
    incidents = incidents.by_severity(params[:severity_level]) if params[:severity_level].present?

    # Apply LTI filter
    incidents = incidents.lti if params[:lti] == 'true'

    # Apply near miss filter
    incidents = incidents.near_miss if params[:near_miss] == 'true'

    # Apply WorkCover filter
    incidents = incidents.requiring_workcov if params[:requiring_workcov] == 'true'

    # Apply this month filter
    incidents = incidents.this_month if params[:this_month] == 'true'

    incidents = incidents.includes(:construction, :reported_by_user, :investigated_by_user, :whs_action_items)
                         .recent

    # Following B01.003: API response format
    render json: {
      success: true,
      data: incidents.as_json(include: serialization_includes)
    }
  end

  # GET /api/v1/whs_incidents/:id
  def show
    render json: {
      success: true,
      data: @whs_incident.as_json(include: serialization_includes)
    }
  end

  # POST /api/v1/whs_incidents
  def create
    incident = WhsIncident.new(whs_incident_params)
    incident.reported_by_user = current_user

    if incident.save
      render json: {
        success: true,
        data: incident.reload.as_json(include: serialization_includes)
      }, status: :created
    else
      render json: {
        success: false,
        error: incident.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/whs_incidents/:id
  def update
    if @whs_incident.update(whs_incident_params)
      render json: {
        success: true,
        data: @whs_incident.reload.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: @whs_incident.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/whs_incidents/:id
  def destroy
    if @whs_incident.destroy
      render json: {
        success: true,
        data: { message: 'Incident deleted successfully' }
      }
    else
      render json: {
        success: false,
        error: 'Failed to delete incident'
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_incidents/:id/investigate
  def investigate
    if @whs_incident.investigate!(current_user)
      render json: {
        success: true,
        data: @whs_incident.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: 'Cannot start investigation'
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_incidents/:id/close
  def close
    closure_notes = params[:closure_notes]

    if closure_notes.blank?
      return render json: {
        success: false,
        error: 'Closure notes are required'
      }, status: :unprocessable_entity
    end

    if @whs_incident.close!(closure_notes)
      render json: {
        success: true,
        data: @whs_incident.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: 'Cannot close incident. Ensure all action items are completed.'
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_incidents/:id/notify_workcov
  def notify_workcov
    workcov_reference = params[:workcov_reference_number]

    if workcov_reference.blank?
      return render json: {
        success: false,
        error: 'WorkCover reference number is required'
      }, status: :unprocessable_entity
    end

    if @whs_incident.update(
      workcov_notification_date: CompanySetting.today,
      workcov_reference_number: workcov_reference
    )
      render json: {
        success: true,
        data: @whs_incident.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: 'Failed to record WorkCover notification'
      }, status: :unprocessable_entity
    end
  end

  private

  def set_whs_incident
    @whs_incident = WhsIncident.find(params[:id])
  end

  def whs_incident_params
    params.require(:whs_incident).permit(
      :incident_number, :incident_date, :report_date, :status,
      :incident_category, :incident_type, :severity_level,
      :what_happened, :where_it_happened, :who_was_involved,
      :immediate_action_taken, :construction_id, :location,
      :investigation_findings, :root_cause, :contributing_factors,
      :corrective_actions_summary, :lessons_learned,
      witnesses: [],
      photo_urls: [],
      injured_parties: []
    )
  end

  def serialization_includes
    {
      construction: { only: [:id, :name, :construction_number] },
      reported_by_user: { only: [:id, :name, :email] },
      investigated_by_user: { only: [:id, :name, :email] },
      whs_action_items: {
        include: {
          assigned_to_user: { only: [:id, :name] }
        }
      }
    }
  end
end
