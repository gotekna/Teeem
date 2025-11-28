module Api
  module V1
    class CompanyGroupsController < ApplicationController
      before_action :set_company_group, only: [:show, :update, :destroy, :companies]

      # GET /api/v1/company_groups
      def index
        @company_groups = CompanyGroup.all

        # Filter by active status
        if params[:active].present?
          @company_groups = @company_groups.where(active: params[:active] == 'true')
        end

        # Search by name
        if params[:search].present?
          @company_groups = @company_groups.where('name ILIKE ?', "%#{params[:search]}%")
        end

        @company_groups = @company_groups.order(:name)

        render json: {
          success: true,
          data: @company_groups.map { |g| serialize_company_group(g) }
        }
      end

      # GET /api/v1/company_groups/:id
      def show
        render json: {
          success: true,
          data: serialize_company_group(@company_group, include_companies: true)
        }
      end

      # POST /api/v1/company_groups
      def create
        @company_group = CompanyGroup.new(company_group_params)

        if @company_group.save
          render json: {
            success: true,
            data: serialize_company_group(@company_group)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @company_group.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/company_groups/:id
      def update
        if @company_group.update(company_group_params)
          render json: {
            success: true,
            data: serialize_company_group(@company_group)
          }
        else
          render json: {
            success: false,
            errors: @company_group.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/company_groups/:id
      def destroy
        if @company_group.companies.any?
          render json: {
            success: false,
            errors: ["Cannot delete group with #{@company_group.companies.count} companies. Reassign companies first."]
          }, status: :unprocessable_entity
        else
          @company_group.destroy
          render json: { success: true }
        end
      end

      # GET /api/v1/company_groups/:id/companies
      def companies
        companies = @company_group.companies.order(:name)

        render json: {
          success: true,
          data: companies.map { |c| serialize_company_summary(c) }
        }
      end

      private

      def set_company_group
        @company_group = CompanyGroup.find(params[:id])
      end

      def company_group_params
        params.require(:company_group).permit(
          :name,
          :description,
          :default_registered_office,
          :default_principal_place,
          :default_accountant,
          :default_accountant_contact,
          :active
        )
      end

      def serialize_company_group(group, include_companies: false)
        data = {
          id: group.id,
          name: group.name,
          description: group.description,
          default_registered_office: group.default_registered_office,
          default_principal_place: group.default_principal_place,
          default_accountant: group.default_accountant,
          default_accountant_contact: group.default_accountant_contact,
          active: group.active,
          companies_count: group.companies_count,
          created_at: group.created_at,
          updated_at: group.updated_at
        }

        if include_companies
          data[:companies] = group.companies.order(:name).map { |c| serialize_company_summary(c) }
        end

        data
      end

      def serialize_company_summary(company)
        {
          id: company.id,
          name: company.name,
          acn: company.acn,
          abn: company.abn,
          status: company.status,
          abbreviation: company.abbreviation
        }
      end
    end
  end
end
