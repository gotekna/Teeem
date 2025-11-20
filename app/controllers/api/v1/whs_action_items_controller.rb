class Api::V1::WhsActionItemsController < ApplicationController
  before_action :set_whs_action_item, only: [:show, :update, :destroy, :start, :complete, :cancel]

  # GET /api/v1/whs_action_items
  def index
    action_items = WhsActionItem.all

    # Apply actionable filter (polymorphic)
    if params[:actionable_type].present? && params[:actionable_id].present?
      action_items = action_items.where(
        actionable_type: params[:actionable_type],
        actionable_id: params[:actionable_id]
      )
    end

    # Apply status filter
    action_items = action_items.where(status: params[:status]) if params[:status].present?

    # Apply priority filter
    action_items = action_items.by_priority(params[:priority]) if params[:priority].present?

    # Apply assigned_to filter
    action_items = action_items.assigned_to(params[:assigned_to_user_id]) if params[:assigned_to_user_id].present?

    # Apply overdue filter
    action_items = action_items.overdue if params[:overdue] == 'true'

    # Apply due_soon filter
    if params[:due_soon] == 'true'
      days = params[:due_soon_days]&.to_i || 7
      action_items = action_items.due_soon(days)
    end

    # Apply pending filter (open or in_progress)
    action_items = action_items.pending if params[:pending] == 'true'

    action_items = action_items.includes(:actionable, :assigned_to_user, :created_by, :project_task)
                               .order(due_date: :asc, priority: :desc)

    # Following B01.003: API response format
    render json: {
      success: true,
      data: action_items.as_json(include: serialization_includes)
    }
  end

  # GET /api/v1/whs_action_items/:id
  def show
    render json: {
      success: true,
      data: @whs_action_item.as_json(include: serialization_includes)
    }
  end

  # POST /api/v1/whs_action_items
  def create
    action_item = WhsActionItem.new(whs_action_item_params)
    action_item.created_by = current_user

    if action_item.save
      render json: {
        success: true,
        data: action_item.reload.as_json(include: serialization_includes)
      }, status: :created
    else
      render json: {
        success: false,
        error: action_item.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/whs_action_items/:id
  def update
    if @whs_action_item.update(whs_action_item_params)
      render json: {
        success: true,
        data: @whs_action_item.reload.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: @whs_action_item.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/whs_action_items/:id
  def destroy
    if @whs_action_item.destroy
      render json: {
        success: true,
        data: { message: 'Action item deleted successfully' }
      }
    else
      render json: {
        success: false,
        error: 'Failed to delete action item'
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_action_items/:id/start
  def start
    if @whs_action_item.start!
      render json: {
        success: true,
        data: @whs_action_item.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: 'Cannot start action item'
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_action_items/:id/complete
  def complete
    completion_notes = params[:completion_notes]

    if @whs_action_item.complete!(completion_notes)
      render json: {
        success: true,
        data: @whs_action_item.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: 'Cannot complete action item'
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_action_items/:id/cancel
  def cancel
    if @whs_action_item.cancel!
      render json: {
        success: true,
        data: @whs_action_item.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: 'Cannot cancel action item'
      }, status: :unprocessable_entity
    end
  end

  private

  def set_whs_action_item
    @whs_action_item = WhsActionItem.find(params[:id])
  end

  def whs_action_item_params
    params.require(:whs_action_item).permit(
      :title, :description, :actionable_type, :actionable_id,
      :action_type, :priority, :status, :assigned_to_user_id,
      :due_date, :completion_notes, :project_task_id
    )
  end

  def serialization_includes
    {
      actionable: {
        only: [:id, :type],
        methods: [:source_description]
      },
      assigned_to_user: { only: [:id, :name, :email] },
      created_by: { only: [:id, :name, :email] },
      project_task: { only: [:id, :name, :status, :planned_end_date] }
    }
  end
end
