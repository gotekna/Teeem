module Api
  module V1
    class CompanyGroupsController < ApplicationController
      before_action :set_company_group, only: [:show, :update, :destroy, :companies, :structure]

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

      # GET /api/v1/company_groups/:id/structure
      def structure
        # Get top-level companies (no parent) in this group
        # Exclude Trust entities that have a Trustee company (they'll be shown under the Trustee)
        all_top_level = @company_group.companies.where(parent_company_id: nil).order(:name)

        # Find trusts/superfunds that have a trustee company in this group
        # Match by Trust/Superfund's name (not trust_name field) since trustee's trust_name = Trust's name
        trusts_with_trustees = @company_group.companies
          .where(entity_type: ['Trust', 'Superfund'])
          .select { |trust| @company_group.companies.exists?(is_trustee: true, trust_name: trust.name) }
          .map(&:id)

        # Exclude those trusts from top level (they'll appear under their trustee)
        top_level = all_top_level.where.not(id: trusts_with_trustees)

        render json: {
          success: true,
          data: {
            group: {
              id: @company_group.id,
              name: @company_group.name
            },
            companies: top_level.map { |c| build_hierarchy_tree(c, @company_group) },
            stats: {
              total_companies: @company_group.companies.count,
              top_level_count: top_level.count,
              trustees_count: @company_group.companies.where(is_trustee: true).count,
              trusts_count: @company_group.companies.where(entity_type: 'Trust').count
            }
          }
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

      def build_hierarchy_tree(company, company_group = nil)
        # Get shareholdings where this company is owned
        shareholders = company.company_shareholdings.includes(:shareholder).map do |sh|
          # Handle polymorphic shareholder - Company has 'name', Contact has 'full_name'
          shareholder_name = if sh.shareholder.respond_to?(:name)
                               sh.shareholder&.name
                             elsif sh.shareholder.respond_to?(:full_name)
                               sh.shareholder&.full_name
                             else
                               "Unknown"
                             end
          {
            id: sh.id,
            shareholder_type: sh.shareholder_type,
            shareholder_id: sh.shareholder_id,
            shareholder_name: shareholder_name,
            shares: sh.number_of_shares,
            percentage: sh.percentage_of_total,
            share_class: sh.share_class,
            beneficially_held: sh.beneficially_held
          }
        end

        # Get investments (companies this company owns)
        investments = company.investments.includes(:company).map do |inv|
          {
            company_id: inv.company_id,
            company_name: inv.company&.name,
            shares: inv.number_of_shares,
            percentage: inv.percentage_of_total
          }
        end

        # Build children list - only include subsidiaries from the same company group
        children = company.subsidiaries
          .where(company_group_id: company_group&.id)
          .order(:name)
          .map { |s| build_hierarchy_tree(s, company_group) }

        # If this company is a trustee, add the Trust/Superfund entity as a child
        # Match by Trust/Superfund's name (the trustee's trust_name = Trust entity's name)
        if company.is_trustee && company.trust_name.present? && company_group
          trust_entity = company_group.companies.where(entity_type: ['Trust', 'Superfund']).find_by(name: company.trust_name)
          if trust_entity
            # Add the trust at the beginning of children
            trust_node = {
              id: trust_entity.id,
              name: trust_entity.name,
              code: trust_entity.code,
              abbreviation: trust_entity.abbreviation,
              acn: trust_entity.acn,
              abn: trust_entity.abn,
              status: trust_entity.status,
              entity_type: trust_entity.entity_type,
              is_trustee: false,
              trust_name: trust_entity.trust_name,
              hierarchy_level: trust_entity.hierarchy_level,
              shareholders: [],
              investments: [],
              children: [],
              is_trust_of_trustee: true  # Flag to indicate this is the trust managed by the parent trustee
            }
            children.unshift(trust_node)
          end
        end

        {
          id: company.id,
          name: company.name,
          code: company.code,
          abbreviation: company.abbreviation,
          acn: company.acn,
          abn: company.abn,
          status: company.status,
          entity_type: company.entity_type,
          is_trustee: company.is_trustee,
          trust_name: company.trust_name,
          hierarchy_level: company.hierarchy_level,
          shareholders: shareholders,
          investments: investments,
          children: children
        }
      end
    end
  end
end
