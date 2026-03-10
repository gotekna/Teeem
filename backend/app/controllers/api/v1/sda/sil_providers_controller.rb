# frozen_string_literal: true

module Api
  module V1
    module Sda
      class SilProvidersController < ApplicationController
        before_action :set_sil_provider, only: [:show, :update, :destroy]

        # GET /api/v1/sda/sil_providers
        def index
          sil_providers = SdaSilProvider.includes(:property, :contact).order(created_at: :desc)
          sil_providers = apply_filters(sil_providers)

          render_success(sil_providers.as_json(include: {
            property: { only: [:id, :name, :street_address] },
            contact: { only: [:id, :display_name, :email, :phone] }
          }))
        end

        # GET /api/v1/sda/sil_providers/:id
        def show
          render_success(@sil_provider.as_json(include: {
            property: { only: [:id, :name, :street_address] },
            contact: { only: [:id, :display_name, :email, :phone] }
          }))
        end

        # POST /api/v1/sda/sil_providers
        def create
          sil_provider = SdaSilProvider.new(sil_provider_params)

          if sil_provider.save
            render_success(sil_provider, status: :created)
          else
            render_validation_errors(sil_provider)
          end
        end

        # PATCH /api/v1/sda/sil_providers/:id
        def update
          if @sil_provider.update(sil_provider_params)
            render_success(@sil_provider)
          else
            render_validation_errors(@sil_provider)
          end
        end

        # DELETE /api/v1/sda/sil_providers/:id
        def destroy
          @sil_provider.destroy
          render_success
        end

        private

        def set_sil_provider
          @sil_provider = SdaSilProvider.find(params[:id])
        end

        def sil_provider_params
          params.require(:sda_sil_provider).permit(
            :property_id, :contact_id, :status, :service_type,
            :agreement_start_date, :agreement_end_date, :agreement_blob_id,
            :weekly_sil_hours, :notes
          )
        end

        def apply_filters(scope)
          scope = scope.where(property_id: params[:property_id]) if params[:property_id].present?
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope
        end
      end
    end
  end
end
