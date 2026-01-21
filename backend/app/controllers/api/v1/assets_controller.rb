module Api
  module V1
    class AssetsController < ApplicationController
      before_action :set_asset, only: [
        :show, :update, :destroy, :service_history, :add_service, :insurance,
        :update_insurance, :documents, :depreciation_profile, :update_depreciation_profile,
        :depreciation_schedule, :calculate_depreciation, :depreciation_forecast,
        :dispose, :expenses, :add_expense, :odometer_readings, :add_odometer_reading,
        :assign_user
      ]

      # GET /api/v1/assets
      def index
        # Return empty result if assets table doesn't exist yet
        unless Asset.table_exists?
          return render json: { success: true, assets: [] }
        end

        # Build includes array based on what tables exist
        # Check if table exists using raw SQL to avoid loading the model
        has_insurance_table = ActiveRecord::Base.connection.table_exists?("asset_insurances")
        includes_array = [ :corporate_company ]
        includes_array << :asset_insurance if has_insurance_table

        @assets = Asset.includes(includes_array).all

        # Filter by company
        @assets = @assets.where(company_id: params[:company_id]) if params[:company_id].present?

        # Filter by type
        @assets = @assets.by_type(params[:asset_type]) if params[:asset_type].present?

        # Filter by status
        @assets = @assets.where(status: params[:status]) if params[:status].present?

        # Search using SSoT SearchService
        if params[:search].present?
          @assets = SearchService.apply(
            @assets,
            params[:search],
            columns: %w[name make model registration_number],
            mode: params[:search_mode] || 'contains',
            model: Asset
          )
        end

        # Build include hash based on what tables exist
        include_hash = { corporate_company: {} }
        if has_insurance_table
          include_hash[:asset_insurance] = { methods: [ :days_until_renewal ] }
        end

        render json: {
          success: true,
          assets: @assets.as_json(
            include: include_hash,
            methods: [ :display_name, :company_name, :company_code, :assigned_to_name, :needs_attention?, :insurance_expired?, :service_overdue? ]
          )
        }
      end

      # GET /api/v1/assets/:id
      def show
        render json: {
          success: true,
          asset: @asset.as_json(
            include: {
              corporate_company: {},
              asset_insurance: {
                methods: [ :days_until_renewal, :expired?, :expiring_soon? ]
              }
            },
            methods: [ :display_name, :age_in_years, :total_maintenance_cost, :depreciation_amount, :thumbnail_url, :photo_urls, :photos_count ]
          )
        }
      end

      # POST /api/v1/assets
      def create
        @asset = Asset.new(asset_params)

        # SSoT: Handle photo uploads via StorageBlob (Jan 2026)
        if params[:photos].present?
          params[:photos].each do |photo|
            @asset.add_photo(
              photo.read,
              filename: photo.original_filename,
              content_type: photo.content_type
            )
          end
        end

        if @asset.save
          render json: {
            success: true,
            message: "Asset created successfully",
            asset: @asset.as_json(methods: [ :display_name ])
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
        # SSoT: Handle photo uploads via StorageBlob (Jan 2026)
        if params[:photos].present?
          params[:photos].each do |photo|
            @asset.add_photo(
              photo.read,
              filename: photo.original_filename,
              content_type: photo.content_type
            )
          end
        end

        if @asset.update(asset_params)
          render json: {
            success: true,
            message: "Asset updated successfully",
            asset: @asset.as_json(methods: [ :display_name ])
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
          message: "Asset deleted successfully"
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
            include: { user: {} },
            methods: [ :display_name, :formatted_service_type, :days_since_service ]
          )
        }
      end

      # POST /api/v1/assets/:id/add_service
      def add_service
        service = @asset.asset_service_histories.build(service_params)
        service.user = current_user

        # SSoT: Handle document uploads via StorageBlob (Jan 2026)
        if params[:invoice].present?
          service.attach_invoice(
            params[:invoice].read,
            filename: params[:invoice].original_filename,
            content_type: params[:invoice].content_type
          )
        end
        if params[:document].present?
          service.attach_document(
            params[:document].read,
            filename: params[:document].original_filename,
            content_type: params[:document].content_type
          )
        end

        if service.save
          render json: {
            success: true,
            message: "Service record added successfully",
            service: service.as_json(methods: [ :display_name, :formatted_service_type ])
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
              methods: [ :days_until_renewal, :expired?, :expiring_soon?, :display_name ]
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
              message: "Insurance updated successfully",
              insurance: insurance.as_json(methods: [ :days_until_renewal ])
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
              message: "Insurance added successfully",
              insurance: insurance.as_json(methods: [ :days_until_renewal ])
            }, status: :created
          else
            render json: {
              success: false,
              errors: insurance.errors.full_messages
            }, status: :unprocessable_entity
          end
        end
      end

      # GET /api/v1/assets/:id/documents
      def documents
        documents = @asset.corporate_company_documents.includes(:corporate_company, :user, :document_type_record).order(created_at: :desc)

        render json: {
          success: true,
          documents: documents.as_json(
            include: {
              corporate_company: {},
              user: {},
              document_type_record: {}
            },
            methods: [ :formatted_document_type, :file_size_mb ]
          )
        }
      end

      # ==========================================
      # DEPRECIATION ENDPOINTS
      # ==========================================

      # GET /api/v1/assets/:id/depreciation_profile
      def depreciation_profile
        profile = @asset.depreciation_profile

        render json: {
          success: true,
          depreciation_profile: profile&.as_json(methods: [:current_book_wdv, :current_tax_wdv, :depreciable_amount])
        }
      end

      # PATCH /api/v1/assets/:id/depreciation_profile
      def update_depreciation_profile
        profile = @asset.depreciation_profile || @asset.build_depreciation_profile

        if profile.update(depreciation_profile_params)
          render json: {
            success: true,
            message: "Depreciation profile updated",
            depreciation_profile: profile.as_json(methods: [:current_book_wdv, :current_tax_wdv])
          }
        else
          render json: {
            success: false,
            errors: profile.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/assets/:id/depreciation_schedule
      def depreciation_schedule
        schedules = @asset.depreciation_schedules.order(period_start: :asc)

        render json: {
          success: true,
          depreciation_schedule: schedules.as_json,
          summary: {
            total_book_depreciation: schedules.sum(:book_depreciation),
            total_tax_depreciation: schedules.sum(:tax_depreciation),
            current_book_wdv: schedules.last&.book_closing_wdv,
            current_tax_wdv: schedules.last&.tax_closing_wdv
          }
        }
      end

      # POST /api/v1/assets/:id/calculate_depreciation
      def calculate_depreciation
        financial_year = params[:financial_year] || AssetDepreciationSchedule.current_financial_year

        service = AssetDepreciationService.new(@asset)

        result = if params[:all_years]
          service.calculate_all_years
        else
          service.calculate_for_year(financial_year)
        end

        if result[:success]
          render json: {
            success: true,
            message: "Depreciation calculated",
            **result
          }
        else
          render json: {
            success: false,
            error: result[:error] || result[:errors]
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/assets/:id/depreciation_forecast
      def depreciation_forecast
        years = (params[:years] || 10).to_i.clamp(1, 50)

        service = AssetDepreciationService.new(@asset)
        result = service.forecast(years)

        if result[:success]
          render json: {
            success: true,
            forecasts: result[:forecasts]
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/assets/:id/dispose
      def dispose
        disposal = @asset.build_disposal(disposal_params)
        disposal.user = current_user

        # Calculate WDV at disposal
        disposal.book_wdv_at_disposal = @asset.current_book_wdv
        disposal.tax_wdv_at_disposal = @asset.current_tax_wdv

        if disposal.save
          render json: {
            success: true,
            message: "Asset disposed successfully",
            disposal: disposal.as_json
          }
        else
          render json: {
            success: false,
            errors: disposal.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # ==========================================
      # EXPENSE ENDPOINTS
      # ==========================================

      # GET /api/v1/assets/:id/expenses
      def expenses
        expenses = @asset.expenses.includes(:user).order(expense_date: :desc)

        render json: {
          success: true,
          expenses: expenses.as_json(include: { user: { only: [:id, :full_name] } }),
          totals: {
            total: @asset.expenses.sum(:amount),
            by_type: @asset.expenses.group(:expense_type).sum(:amount)
          }
        }
      end

      # POST /api/v1/assets/:id/expenses
      def add_expense
        expense = @asset.expenses.build(expense_params)
        expense.user = current_user

        # SSoT: Handle receipt upload via StorageBlob (Jan 2026)
        if params[:receipt].present?
          expense.attach_receipt(
            params[:receipt].read,
            filename: params[:receipt].original_filename,
            content_type: params[:receipt].content_type
          )
        end

        if expense.save
          render json: {
            success: true,
            message: "Expense added",
            expense: expense.as_json
          }, status: :created
        else
          render json: {
            success: false,
            errors: expense.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # ==========================================
      # ODOMETER ENDPOINTS
      # ==========================================

      # GET /api/v1/assets/:id/odometer_readings
      def odometer_readings
        readings = @asset.odometer_readings.includes(:user).order(reading_date: :desc)

        render json: {
          success: true,
          odometer_readings: readings.as_json(
            include: { user: { only: [:id, :full_name] } },
            methods: [:display_value, :distance_since_last]
          ),
          current: {
            odometer_km: @asset.current_odometer,
            hours: @asset.current_hours,
            last_reading_date: @asset.last_reading_date
          }
        }
      end

      # POST /api/v1/assets/:id/odometer_readings
      def add_odometer_reading
        reading = @asset.odometer_readings.build(odometer_reading_params)
        reading.user = current_user

        # SSoT: Handle photo upload via StorageBlob (Jan 2026)
        if params[:photo].present?
          reading.attach_photo(
            params[:photo].read,
            filename: params[:photo].original_filename,
            content_type: params[:photo].content_type
          )
        end

        if reading.save
          render json: {
            success: true,
            message: "Reading recorded",
            odometer_reading: reading.as_json(methods: [:display_value])
          }, status: :created
        else
          render json: {
            success: false,
            errors: reading.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # ==========================================
      # USER ASSIGNMENT
      # ==========================================

      # PATCH /api/v1/assets/:id/assign_user
      def assign_user
        if @asset.update(assigned_user_id: params[:user_id])
          render json: {
            success: true,
            message: params[:user_id].present? ? "Asset assigned" : "Asset unassigned",
            asset: @asset.as_json(
              include: { assigned_user: { only: [:id, :full_name, :email] } }
            )
          }
        else
          render json: {
            success: false,
            errors: @asset.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      private

      def set_asset
        @asset = Asset.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Asset not found" }, status: :not_found
      end

      def asset_params
        params.require(:asset).permit(
          :company_id, :name, :asset_type, :make, :model, :serial_number,
          :registration_number, :description, :abbreviation, :purchase_date, :purchase_price,
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

      def depreciation_profile_params
        params.require(:depreciation_profile).permit(
          :depreciable_cost, :residual_value, :book_method, :tax_method,
          :effective_life_years, :book_rate, :tax_rate, :depreciation_start_date,
          :in_low_value_pool, :pool_entry_date, :is_division_43, :division_43_rate,
          :instant_writeoff_applied, :instant_writeoff_date
        )
      end

      def disposal_params
        params.require(:disposal).permit(
          :disposal_date, :settlement_date, :disposal_type, :sale_proceeds,
          :disposal_costs, :notes, :replacement_asset_id, :trade_in_value
        )
      end

      def expense_params
        params.require(:expense).permit(
          :expense_date, :expense_type, :amount, :description, :vendor, :reference
        )
      end

      def odometer_reading_params
        params.require(:odometer_reading).permit(
          :reading_date, :odometer_km, :hours, :reading_type, :notes
        )
      end
    end
  end
end
