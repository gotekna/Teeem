module Api
  module V1
    class PropertySettingsController < ApplicationController
      # GET /api/v1/property_settings
      def show
        setting = PropertySetting.find_or_initialize_by(tenant: current_tenant)

        render json: {
          success: true,
          data: {
            id: setting.id,
            xero_credential_id: setting.xero_credential_id,
            xero_tenant_name: setting.xero_credential&.tenant_name,
            trading_name: setting.trading_name,
            configured: setting.configured?
          }
        }
      end

      # PUT /api/v1/property_settings
      def update
        setting = PropertySetting.find_or_initialize_by(tenant: current_tenant)

        # Scope xero_credential to current tenant to prevent cross-tenant assignment
        if params[:xero_credential_id].present?
          credential = XeroCredential.for_teeem_tenant(current_tenant).find_by(id: params[:xero_credential_id])
          unless credential
            return render json: { success: false, error: "Xero credential not found" }, status: :not_found
          end
        end

        if setting.update(property_setting_params)
          render json: {
            success: true,
            data: {
              id: setting.id,
              xero_credential_id: setting.xero_credential_id,
              xero_tenant_name: setting.xero_credential&.tenant_name,
              trading_name: setting.trading_name,
              configured: setting.configured?
            }
          }
        else
          render json: { success: false, error: setting.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      private

      def property_setting_params
        params.permit(:xero_credential_id, :trading_name)
      end
    end
  end
end
