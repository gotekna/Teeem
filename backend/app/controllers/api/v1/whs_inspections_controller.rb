class Api::V1::WHSInspectionsController < ApplicationController
  before_action :set_whs_inspection, only: [:show, :update, :destroy, :start, :complete]

  # GET /api/v1/whs_inspections
  def index
    inspections = if params[:construction_id].present?
      WhsInspection.for_construction(params[:construction_id])
    else
      WhsInspection.all
    end

    # Apply status filter
    inspections = inspections.where(status: params[:status]) if params[:status].present?

    # Apply inspection_type filter
    inspections = inspections.by_type(params[:inspection_type]) if params[:inspection_type].present?

    # Apply overdue filter
    inspections = inspections.overdue if params[:overdue] == 'true'

    # Apply upcoming filter
    inspections = inspections.upcoming if params[:upcoming] == 'true'

    # Apply critical issues filter
    inspections = inspections.with_critical_issues if params[:critical_issues] == 'true'

    inspections = inspections.includes(:construction, :whs_inspection_template, :inspector_user, :created_by, :whs_inspection_items)
                             .order(scheduled_date: :desc)

    # Following B01.003: API response format
    render json: {
      success: true,
      data: inspections.as_json(include: serialization_includes)
    }
  end

  # GET /api/v1/whs_inspections/:id
  def show
    render json: {
      success: true,
      data: @whs_inspection.as_json(include: serialization_includes)
    }
  end

  # POST /api/v1/whs_inspections
  def create
    inspection = WhsInspection.new(whs_inspection_params)
    inspection.created_by = current_user

    if inspection.save
      render json: {
        success: true,
        data: inspection.reload.as_json(include: serialization_includes)
      }, status: :created
    else
      render json: {
        success: false,
        error: inspection.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/whs_inspections/:id
  def update
    if @whs_inspection.update(whs_inspection_params)
      # Update inspection items if provided
      update_inspection_items(@whs_inspection, params[:inspection_items]) if params[:inspection_items].present?

      render json: {
        success: true,
        data: @whs_inspection.reload.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: @whs_inspection.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/whs_inspections/:id
  def destroy
    if @whs_inspection.destroy
      render json: {
        success: true,
        data: { message: 'Inspection deleted successfully' }
      }
    else
      render json: {
        success: false,
        error: 'Failed to delete inspection'
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_inspections/:id/start
  def start
    if @whs_inspection.start!
      render json: {
        success: true,
        data: @whs_inspection.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: 'Cannot start inspection'
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_inspections/:id/complete
  def complete
    if @whs_inspection.complete!
      render json: {
        success: true,
        data: @whs_inspection.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: 'Cannot complete inspection'
      }, status: :unprocessable_entity
    end
  end

  private

  def set_whs_inspection
    @whs_inspection = WhsInspection.find(params[:id])
  end

  def whs_inspection_params
    params.require(:whs_inspection).permit(
      :inspection_number, :inspection_type, :status, :construction_id,
      :whs_inspection_template_id, :inspector_user_id, :scheduled_date,
      :location, :weather_conditions, :notes, :meeting_id
    )
  end

  def serialization_includes
    {
      construction: { only: [:id, :name, :construction_number] },
      whs_inspection_template: { only: [:id, :name, :inspection_type] },
      inspector_user: { only: [:id, :name, :email] },
      created_by: { only: [:id, :name, :email] },
      meeting: { only: [:id, :title, :start_time] },
      whs_inspection_items: {
        only: [:id, :item_description, :category, :result, :notes, :photo_urls, :action_required, :position]
      },
      whs_action_items: {
        include: {
          assigned_to_user: { only: [:id, :name] }
        }
      }
    }
  end

  def update_inspection_items(inspection, items_data)
    items_data.each do |item_data|
      item = inspection.whs_inspection_items.find_or_initialize_by(id: item_data[:id])
      item.update(item_data.permit(
        :result, :notes, :action_required, photo_urls: []
      ))
    end
  end
end
