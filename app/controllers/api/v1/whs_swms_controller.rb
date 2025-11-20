class Api::V1::WhsSwmsController < ApplicationController
  before_action :set_whs_swms, only: [:show, :update, :destroy, :submit_for_approval, :approve, :reject, :supersede, :acknowledge]

  # GET /api/v1/whs_swms
  def index
    swms = if params[:construction_id].present?
      WhsSwms.for_construction(params[:construction_id])
    else
      WhsSwms.all
    end

    # Apply status filter
    swms = swms.where(status: params[:status]) if params[:status].present?

    # Apply company_wide filter
    swms = swms.company_wide if params[:company_wide] == 'true'

    swms = swms.includes(:construction, :created_by, :approved_by, :superseded_by, :whs_swms_hazards)
                .order(created_at: :desc)

    # Following B01.003: API response format
    render json: {
      success: true,
      data: swms.as_json(include: serialization_includes)
    }
  end

  # GET /api/v1/whs_swms/:id
  def show
    render json: {
      success: true,
      data: @whs_swms.as_json(include: serialization_includes)
    }
  end

  # POST /api/v1/whs_swms
  def create
    swms = WhsSwms.new(whs_swms_params)
    swms.created_by = current_user

    if swms.save
      # Create hazards if provided
      create_hazards(swms, params[:hazards]) if params[:hazards].present?

      render json: {
        success: true,
        data: swms.reload.as_json(include: serialization_includes)
      }, status: :created
    else
      render json: {
        success: false,
        error: swms.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/whs_swms/:id
  def update
    if @whs_swms.update(whs_swms_params)
      # Update hazards if provided
      update_hazards(@whs_swms, params[:hazards]) if params[:hazards].present?

      render json: {
        success: true,
        data: @whs_swms.reload.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: @whs_swms.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/whs_swms/:id
  def destroy
    if @whs_swms.destroy
      render json: {
        success: true,
        data: { message: 'SWMS deleted successfully' }
      }
    else
      render json: {
        success: false,
        error: 'Failed to delete SWMS'
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_swms/:id/submit_for_approval
  def submit_for_approval
    if @whs_swms.submit_for_approval!
      render json: {
        success: true,
        data: @whs_swms.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: 'Cannot submit SWMS for approval'
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_swms/:id/approve
  def approve
    # TODO: Add WPHS Appointee authorization check
    if @whs_swms.approve!(current_user)
      render json: {
        success: true,
        data: @whs_swms.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: 'Cannot approve SWMS'
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_swms/:id/reject
  def reject
    rejection_reason = params[:rejection_reason]

    if rejection_reason.blank?
      return render json: {
        success: false,
        error: 'Rejection reason is required'
      }, status: :unprocessable_entity
    end

    # TODO: Add WPHS Appointee authorization check
    if @whs_swms.reject!(current_user, rejection_reason)
      render json: {
        success: true,
        data: @whs_swms.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: 'Cannot reject SWMS'
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_swms/:id/supersede
  def supersede
    new_version = params[:new_version]

    if new_version.blank?
      return render json: {
        success: false,
        error: 'New version number is required'
      }, status: :unprocessable_entity
    end

    # Create new SWMS with incremented version
    new_swms = @whs_swms.dup
    new_swms.version = new_version
    new_swms.status = 'draft'
    new_swms.approved_by = nil
    new_swms.approved_at = nil
    new_swms.created_by = current_user

    if new_swms.save && @whs_swms.supersede!(new_swms)
      render json: {
        success: true,
        data: new_swms.reload.as_json(include: serialization_includes)
      }
    else
      render json: {
        success: false,
        error: new_swms.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/whs_swms/:id/acknowledge
  def acknowledge
    acknowledgment = @whs_swms.whs_swms_acknowledgments.new(acknowledgment_params)
    acknowledgment.acknowledged_at = Time.current
    acknowledgment.ip_address = request.remote_ip

    if acknowledgment.save
      render json: {
        success: true,
        data: acknowledgment.as_json
      }, status: :created
    else
      render json: {
        success: false,
        error: acknowledgment.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  private

  def set_whs_swms
    @whs_swms = WhsSwms.find(params[:id])
  end

  def whs_swms_params
    params.require(:whs_swms).permit(
      :title, :description, :construction_id, :version, :status,
      :high_risk_work, :high_risk_type, :company_wide, :expiry_date,
      ppe_requirements: [],
      required_qualifications: [],
      metadata: {}
    )
  end

  def acknowledgment_params
    params.require(:acknowledgment).permit(
      :user_id, :worker_name, :signature_data, :notes
    )
  end

  def serialization_includes
    {
      construction: { only: [:id, :name, :construction_number] },
      created_by: { only: [:id, :name, :email] },
      approved_by: { only: [:id, :name, :email] },
      superseded_by: { only: [:id, :swms_number, :version] },
      whs_swms_hazards: {
        include: {
          whs_swms_controls: { only: [:id, :control_description, :control_type, :residual_risk_score] }
        }
      },
      whs_swms_acknowledgments: {
        include: {
          user: { only: [:id, :name] }
        }
      }
    }
  end

  def create_hazards(swms, hazards_data)
    hazards_data.each do |hazard|
      hazard_record = swms.whs_swms_hazards.create(hazard.permit(
        :hazard_description, :likelihood, :consequence, :affected_workers
      ))

      # Create controls for this hazard if provided
      if hazard[:controls].present?
        hazard[:controls].each do |control|
          hazard_record.whs_swms_controls.create(control.permit(
            :control_description, :control_type, :implementation_details,
            :residual_likelihood, :residual_consequence, :responsible_person
          ))
        end
      end
    end
  end

  def update_hazards(swms, hazards_data)
    # Simple approach: delete all and recreate
    swms.whs_swms_hazards.destroy_all
    create_hazards(swms, hazards_data)
  end
end
