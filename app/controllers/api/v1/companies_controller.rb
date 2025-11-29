module Api
  module V1
    class CompaniesController < ApplicationController
      before_action :set_company, only: [:show, :update, :destroy, :directors, :add_director,
                                         :update_director, :remove_director, :compliance_items,
                                         :activities, :documents, :assets]

      # GET /api/v1/companies
      def index
        @companies = Company.all

        # Filtering
        @companies = @companies.by_group(params[:group]) if params[:group].present?
        @companies = @companies.where(status: params[:status]) if params[:status].present?

        # Search
        if params[:search].present?
          @companies = @companies.where(
            "name ILIKE ? OR acn ILIKE ? OR abn ILIKE ?",
            "%#{params[:search]}%",
            "%#{params[:search]}%",
            "%#{params[:search]}%"
          )
        end

        # Sorting
        sort_by = params[:sort_by] || 'name'
        sort_order = params[:sort_order] || 'asc'
        @companies = @companies.order("#{sort_by} #{sort_order}")

        render json: {
          success: true,
          companies: @companies.as_json(
            include: {
              current_directors: { only: [:id, :full_name, :email] },
              company_xero_connection: { only: [:id, :connection_status, :xero_tenant_name] }
            },
            methods: [:formatted_acn, :formatted_abn, :has_xero_connection?]
          ),
          total: @companies.count
        }
      end

      # GET /api/v1/companies/:id
      def show
        company_json = @company.as_json(
          include: {
            bank_accounts: { only: [:id, :institution_name, :status], methods: [:display_name, :masked_account_number] },
            # Note: active_assets removed - assets table not yet migrated
            pending_compliance_items: { only: [:id, :title, :due_date, :completed], methods: [:days_until_due] },
            company_xero_connection: { only: [:id, :connection_status, :xero_tenant_name, :last_sync_at] }
          },
          methods: [:formatted_acn, :formatted_abn, :has_xero_connection?]
          # Note: total_asset_value removed - depends on assets table
        )

        # Serialize current directors separately (company_directors.current returns CompanyDirector objects)
        company_json['current_directors'] = @company.company_directors.current.includes(:contact).map do |director|
          director.as_json(
            include: { contact: { only: [:id, :full_name, :email, :mobile_phone] } },
            methods: [:formatted_position]
          )
        end

        render json: { success: true, company: company_json }
      end

      # POST /api/v1/companies
      def create
        @company = Company.new(company_params)

        if @company.save
          render json: {
            success: true,
            message: 'Company created successfully',
            company: @company.as_json(methods: [:formatted_acn, :formatted_abn])
          }, status: :created
        else
          render json: {
            success: false,
            errors: @company.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/companies/:id
      def update
        if @company.update(company_params)
          render json: {
            success: true,
            message: 'Company updated successfully',
            company: @company.as_json(methods: [:formatted_acn, :formatted_abn])
          }
        else
          render json: {
            success: false,
            errors: @company.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/companies/:id
      def destroy
        @company.destroy
        render json: {
          success: true,
          message: 'Company deleted successfully'
        }
      end

      # GET /api/v1/companies/:id/directors
      def directors
        directors = @company.company_directors.includes(:contact).order(appointment_date: :desc)

        render json: {
          success: true,
          directors: directors.as_json(
            include: {
              contact: {
                only: [:id, :full_name, :email, :mobile_phone, :director_id, :date_of_birth],
                methods: [:display_name]
              }
            },
            methods: [:formatted_position, :active_duration]
          )
        }
      end

      # POST /api/v1/companies/:id/add_director
      def add_director
        contact = Contact.find(params[:contact_id])

        director = @company.company_directors.build(
          contact: contact,
          position: params[:position],
          appointment_date: params[:appointment_date] || Date.today,
          is_current: true
        )

        if director.save
          render json: {
            success: true,
            message: 'Director added successfully',
            director: director.as_json(
              include: { contact: { only: [:id, :full_name, :email] } },
              methods: [:formatted_position]
            )
          }, status: :created
        else
          render json: {
            success: false,
            errors: director.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PUT /api/v1/companies/:id/directors/:director_id
      def update_director
        director = @company.company_directors.find(params[:director_id])

        if director.update(director_params)
          render json: {
            success: true,
            message: 'Director updated successfully',
            director: director.as_json(
              include: { contact: { only: [:id, :full_name, :email] } },
              methods: [:formatted_position]
            )
          }
        else
          render json: {
            success: false,
            errors: director.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/companies/:id/directors/:director_id
      def remove_director
        director = @company.company_directors.find(params[:director_id])

        if director.update(resignation_date: params[:resignation_date] || Date.today, is_current: false)
          render json: {
            success: true,
            message: 'Director removed successfully'
          }
        else
          render json: {
            success: false,
            errors: director.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/companies/:id/compliance_items
      def compliance_items
        items = @company.company_compliance_items.order(:due_date)

        # Filter by status
        items = items.where(status: params[:status]) if params[:status].present?

        render json: {
          success: true,
          compliance_items: items.as_json(methods: [:days_until_due, :formatted_compliance_type])
        }
      end

      # GET /api/v1/companies/:id/activities
      def activities
        activities = @company.company_activities
          .includes(:user)
          .order(created_at: :desc)
          .limit(params[:limit]&.to_i || 50)

        render json: {
          success: true,
          activities: activities.as_json(
            methods: [:formatted_activity_type, :performed_by_name, :time_ago]
          )
        }
      end

      # GET /api/v1/companies/:id/documents
      def documents
        documents = @company.company_documents.order(created_at: :desc)

        # Filter by type
        documents = documents.by_type(params[:document_type]) if params[:document_type].present?

        render json: {
          success: true,
          documents: documents.as_json(methods: [:formatted_document_type, :file_size_mb])
        }
      end

      # GET /api/v1/companies/:id/assets
      def assets
        assets = @company.assets.includes(:asset_insurance).order(created_at: :desc)

        # Filter by type and status
        assets = assets.by_type(params[:asset_type]) if params[:asset_type].present?
        assets = assets.where(status: params[:status]) if params[:status].present?

        render json: {
          success: true,
          assets: assets.as_json(
            include: {
              asset_insurance: { only: [:id, :renewal_date, :status], methods: [:days_until_renewal] }
            },
            methods: [:display_name, :needs_attention?]
          )
        }
      end

      # POST /api/v1/companies/import
      def import
        # Handle Excel import (to be implemented with CompanyImportService)
        if params[:file].blank?
          return render json: { success: false, error: 'No file provided' }, status: :unprocessable_entity
        end

        # This will be implemented later with the CompanyImportService
        render json: {
          success: true,
          message: 'Import functionality coming soon'
        }
      end

      # POST /api/v1/companies/reload
      def reload
        file_path = ENV['CORPORATE_FILE_PATH'] || '/Users/robertharder/Library/CloudStorage/OneDrive-Tekna/Accounts - Internal/Corporate File/Corporate File.xlsx'

        unless File.exist?(file_path)
          return render json: { success: false, error: 'Corporate File not found' }, status: :unprocessable_entity
        end

        service = CompanyImportService.new(file_path)
        result = service.reload_all

        render json: {
          success: true,
          message: 'Company data reloaded from spreadsheet',
          result: result
        }
      rescue StandardError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/companies/health_report
      def health_report
        report = CompanyImportService.health_report

        summary = {
          total: report.count,
          excellent: report.count { |r| r[:health_status] == 'excellent' },
          good: report.count { |r| r[:health_status] == 'good' },
          needs_attention: report.count { |r| r[:health_status] == 'needs_attention' },
          critical: report.count { |r| r[:health_status] == 'critical' },
          average_score: report.any? ? (report.sum { |r| r[:health_score] } / report.count.to_f).round(1) : 0
        }

        render json: {
          success: true,
          summary: summary,
          companies: report
        }
      end

      # GET /api/v1/companies/asic_logins
      # Returns all companies' ASIC login credentials for table view
      def asic_logins
        @companies = Company.all.order(:name)

        # Filter by company group
        if params[:company_group_id].present?
          @companies = @companies.where(company_group_id: params[:company_group_id])
        end

        # Only include companies with ASIC credentials
        if params[:with_credentials] == 'true'
          @companies = @companies.where.not(asic_username: [nil, ''])
        end

        render json: {
          success: true,
          companies: @companies.map do |company|
            {
              id: company.id,
              name: company.name,
              acn: company.acn,
              formatted_acn: company.formatted_acn,
              company_group_id: company.company_group_id,
              company_group_name: company.company_group&.name,
              corporate_key: company.corporate_key,
              asic_username: company.asic_username,
              asic_password: company.encrypted_asic_password,
              recovery_question: company.recovery_question,
              recovery_answer: company.encrypted_recovery_answer,
              has_credentials: company.asic_username.present?
            }
          end,
          total: @companies.count
        }
      end

      private

      def set_company
        @company = Company.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Company not found' }, status: :not_found
      end

      def company_params
        params.require(:company).permit(
          :name, :company_group, :acn, :abn, :tfn, :date_incorporated, :purpose, :status,
          :registered_office_address, :principal_place_of_business, :is_trustee, :trust_name,
          :corporate_key, :asic_username, :encrypted_asic_password, :recovery_question,
          :encrypted_recovery_answer, :review_date, :gst_registration_status, :accounting_method,
          :shares_on_issue, :carry_forward_losses, :franking_balance, :amount_owing,
          metadata: {}
        )
      end

      def director_params
        params.permit(:position, :appointment_date, :resignation_date, :notes)
      end
    end
  end
end
