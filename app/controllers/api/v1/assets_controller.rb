module Api
  module V1
    class AssetsController < ApplicationController
      before_action :set_asset, only: [:show, :update, :destroy, :service_history,
                                        :add_service, :insurance, :update_insurance]

      # GET /api/v1/assets
      def index
        @assets = Asset.includes(:company, :asset_insurance).all

        # Filter by company
        @assets = @assets.where(company_id: params[:company_id]) if params[:company_id].present?

        # Filter by type
        @assets = @assets.by_type(params[:asset_type]) if params[:asset_type].present?

        # Filter by status
        @assets = @assets.where(status: params[:status]) if params[:status].present?

        # Search
        if params[:search].present?
          @assets = @assets.where(
            "name ILIKE ? OR make ILIKE ? OR model ILIKE ? OR registration_number ILIKE ?",
            "%#{params[:search]}%", "%#{params[:search]}%",
            "%#{params[:search]}%", "%#{params[:search]}%"
          )
        end

        render json: {
          success: true,
          assets: @assets.as_json(
            include: {
              company: { only: [:id, :name] },
              asset_insurance: { only: [:id, :renewal_date, :status], methods: [:days_until_renewal] }
            },
            methods: [:display_name, :needs_attention?, :insurance_expired?, :service_overdue?]
          )
        }
      end

      # GET /api/v1/assets/:id
      def show
        render json: {
          success: true,
          asset: @asset.as_json(
            include: {
              company: { only: [:id, :name] },
              asset_insurance: {
                methods: [:days_until_renewal, :expired?, :expiring_soon?]
              }
            },
            methods: [:display_name, :age_in_years, :total_maintenance_cost, :depreciation_amount]
          )
        }
      end

      # POST /api/v1/assets
      def create
        @asset = Asset.new(asset_params)

        # Handle photo uploads
        if params[:photos].present?
          params[:photos].each do |photo|
            @asset.photos.attach(photo)
          end
        end

        if @asset.save
          render json: {
            success: true,
            message: 'Asset created successfully',
            asset: @asset.as_json(methods: [:display_name])
          }, status: :created
        else
          render json: {
            success: false,
            errors: @asset.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/assets/:id
      def update
        # Handle photo uploads
        if params[:photos].present?
          params[:photos].each do |photo|
            @asset.photos.attach(photo)
          end
        end

        if @asset.update(asset_params)
          render json: {
            success: true,
            message: 'Asset updated successfully',
            asset: @asset.as_json(methods: [:display_name])
          }
        else
          render json: {
            success: false,
            errors: @asset.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/assets/:id
      def destroy
        @asset.destroy
        render json: {
          success: true,
          message: 'Asset deleted successfully'
        }
      end

      # GET /api/v1/assets/:id/service_history
      def service_history
        services = @asset.asset_service_histories
          .includes(:user)
          .order(service_date: :desc)

        render json: {
          success: true,
          service_history: services.as_json(
            include: { user: { only: [:id, :name, :email] } },
            methods: [:display_name, :formatted_service_type, :days_since_service]
          )
        }
      end

      # POST /api/v1/assets/:id/add_service
      def add_service
        service = @asset.asset_service_histories.build(service_params)
        service.user = current_user

        # Handle document uploads
        service.invoice.attach(params[:invoice]) if params[:invoice].present?
        service.document.attach(params[:document]) if params[:document].present?

        if service.save
          render json: {
            success: true,
            message: 'Service record added successfully',
            service: service.as_json(methods: [:display_name, :formatted_service_type])
          }, status: :created
        else
          render json: {
            success: false,
            errors: service.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/assets/:id/insurance
      def insurance
        if @asset.asset_insurance.present?
          render json: {
            success: true,
            insurance: @asset.asset_insurance.as_json(
              methods: [:days_until_renewal, :expired?, :expiring_soon?, :display_name]
            )
          }
        else
          render json: {
            success: true,
            insurance: nil
          }
        end
      end

      # POST/PUT /api/v1/assets/:id/insurance
      def update_insurance
        if @asset.asset_insurance.present?
          insurance = @asset.asset_insurance
          if insurance.update(insurance_params)
            render json: {
              success: true,
              message: 'Insurance updated successfully',
              insurance: insurance.as_json(methods: [:days_until_renewal])
            }
          else
            render json: {
              success: false,
              errors: insurance.errors.full_messages
            }, status: :unprocessable_entity
          end
        else
          insurance = @asset.build_asset_insurance(insurance_params)
          if insurance.save
            render json: {
              success: true,
              message: 'Insurance added successfully',
              insurance: insurance.as_json(methods: [:days_until_renewal])
            }, status: :created
          else
            render json: {
              success: false,
              errors: insurance.errors.full_messages
            }, status: :unprocessable_entity
          end
        end
      end

      private

      def set_asset
        @asset = Asset.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Asset not found' }, status: :not_found
      end

      def asset_params
        params.require(:asset).permit(
          :company_id, :name, :asset_type, :make, :model, :serial_number,
          :registration_number, :description, :purchase_date, :purchase_price,
          :location, :status, :current_book_value, metadata: {}
        )
      end

      def service_params
        params.require(:service).permit(
          :service_date, :service_type, :service_provider, :description, :cost,
          :odometer_reading, :hours_reading, :next_service_km, :next_service_hours,
          :next_service_date, :invoice_url, :document_url
        )
      end

      def insurance_params
        params.require(:insurance).permit(
          :policy_number, :insurer_name, :broker_name, :broker_contact_name,
          :broker_email, :broker_phone, :start_date, :renewal_date,
          :payment_frequency, :premium_amount, :coverage_amount, :excess_amount, :status
        )
      end
    end
  end
end
