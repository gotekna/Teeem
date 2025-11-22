class Api::V1::WHSSettingsController < ApplicationController
  before_action :set_whs_setting, only: [:show, :update, :destroy]

  # GET /api/v1/whs_settings
  def index
    settings = WhsSetting.all.order(:setting_key)

    # Following B01.003: API response format
    render json: {
      success: true,
      data: settings.as_json
    }
  end

  # GET /api/v1/whs_settings/:id
  def show
    render json: {
      success: true,
      data: @whs_setting.as_json
    }
  end

  # GET /api/v1/whs_settings/key/:key
  def show_by_key
    setting = WhsSetting.find_by(setting_key: params[:key])

    if setting
      render json: {
        success: true,
        data: {
          key: setting.setting_key,
          value: setting.parsed_value,
          type: setting.setting_type,
          description: setting.description
        }
      }
    else
      render json: {
        success: false,
        error: 'Setting not found'
      }, status: :not_found
    end
  end

  # POST /api/v1/whs_settings
  def create
    setting = WhsSetting.new(whs_setting_params)

    if setting.save
      render json: {
        success: true,
        data: setting.as_json
      }, status: :created
    else
      render json: {
        success: false,
        error: setting.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/whs_settings/:id
  def update
    if @whs_setting.update(whs_setting_params)
      render json: {
        success: true,
        data: @whs_setting.as_json
      }
    else
      render json: {
        success: false,
        error: @whs_setting.errors.full_messages.join(', ')
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/whs_settings/key/:key
  def update_by_key
    key = params[:key]
    value = params[:value]
    setting_type = params[:setting_type] || 'string'
    description = params[:description]

    begin
      setting = WhsSetting.set(key, value, description: description, type: setting_type)

      render json: {
        success: true,
        data: {
          key: setting.setting_key,
          value: setting.parsed_value,
          type: setting.setting_type,
          description: setting.description
        }
      }
    rescue => e
      render json: {
        success: false,
        error: e.message
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/whs_settings/:id
  def destroy
    if @whs_setting.destroy
      render json: {
        success: true,
        data: { message: 'Setting deleted successfully' }
      }
    else
      render json: {
        success: false,
        error: 'Failed to delete setting'
      }, status: :unprocessable_entity
    end
  end

  private

  def set_whs_setting
    @whs_setting = WhsSetting.find(params[:id])
  end

  def whs_setting_params
    params.require(:whs_setting).permit(
      :setting_key, :setting_value, :setting_type, :description
    )
  end
end
