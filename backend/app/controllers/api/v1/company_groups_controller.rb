module Api
  module V1
    class CompanyGroupsController < ApplicationController
      before_action :set_company_group, only: [:show, :update, :destroy, :companies, :structure, :contacts]

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
        # Exclude Trustee companies (is_trustee: true) - they'll be shown under their Trust
        all_top_level = @company_group.companies.where(parent_company_id: nil).order(:name)

        # Find trustee companies that have a matching Trust entity in this group
        # These should NOT appear at top level (they'll appear under their Trust)
        trustee_companies_with_trusts = @company_group.companies
          .where(is_trustee: true)
          .where.not(trust_name: [nil, ''])
          .select { |trustee| @company_group.companies.exists?(entity_type: ['Trust', 'Superfund'], name: trustee.trust_name) }
          .map(&:id)

        # Exclude those trustee companies from top level (they'll appear under their Trust)
        top_level = all_top_level.where.not(id: trustee_companies_with_trusts)

        # SSoT: Get people in this group via memberships
        people = @company_group.contact_memberships
          .people
          .active
          .includes(:contact)
          .map { |m| serialize_person_membership(m) }

        render json: {
          success: true,
          data: {
            group: {
              id: @company_group.id,
              name: @company_group.name
            },
            companies: top_level.map { |c| build_hierarchy_tree(c, @company_group) },
            people: people,
            stats: {
              total_companies: @company_group.companies.count,
              top_level_count: top_level.count,
              trustees_count: @company_group.companies.where(is_trustee: true).count,
              trusts_count: @company_group.companies.where(entity_type: 'Trust').count,
              people_count: people.count
            }
          }
        }
      end

      # GET /api/v1/company_groups/:id/contacts
      def contacts
        memberships = @company_group.contact_memberships
          .includes(:contact, :company)

        if params[:type].present?
          memberships = memberships.where(membership_type: params[:type])
        end

        if params[:active].present?
          memberships = params[:active] == 'true' ? memberships.active : memberships.where(is_active: false)
        end

        render json: {
          success: true,
          data: memberships.map { |m| serialize_membership(m) }
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
          code: company.code,
          contact_id: company.contact_id  # SSoT link
        }
      end

      # SSoT: Serialize a person membership for the structure endpoint
      def serialize_person_membership(membership)
        contact = membership.contact
        {
          id: membership.id,
          contact_id: contact.id,
          name: contact.display_name,
          email: contact.email,
          membership_type: membership.membership_type,
          is_active: membership.is_active,
          roles: get_person_roles(contact, membership.company_group_id)
        }
      end

      # SSoT: Serialize full membership data
      def serialize_membership(membership)
        contact = membership.contact
        # Check if this contact has a linked Company record
        linked_company = Company.find_by(contact_id: contact.id)
        {
          id: membership.id,
          contact_id: contact.id,
          contact_name: contact.display_name,
          contact_email: contact.email,
          contact_entity_type: contact.entity_type,
          company_group_id: membership.company_group_id,
          membership_type: membership.membership_type,
          company_id: membership.company_id,
          company_name: membership.company&.name,
          can_view_confidential: membership.can_view_confidential,
          can_edit: membership.can_edit,
          is_active: membership.is_active,
          has_linked_company: linked_company.present?,
          linked_company_id: linked_company&.id,
          created_at: membership.created_at,
          updated_at: membership.updated_at
        }
      end

      # SSoT: Get all roles a person has in a company group
      def get_person_roles(contact, company_group_id)
        roles = []

        # Get directorship/officer roles (director, secretary, corporate_officer, public_officer)
        contact.company_directorships.includes(:company).each do |dir|
          next unless dir.company&.company_group_id == company_group_id

          position = dir.position.to_s

          # Add director role if position includes director or is chairman
          if position.include?('director') || position == 'chairman'
            roles << {
              type: 'director',
              company_id: dir.company_id,
              company_name: dir.company.name,
              position: dir.position,
              is_current: dir.is_current
            }
          end

          # Add secretary role if position includes secretary
          if position.include?('secretary')
            roles << {
              type: 'secretary',
              company_id: dir.company_id,
              company_name: dir.company.name,
              position: dir.position,
              is_current: dir.is_current
            }
          end

          # Add corporate_officer role if position includes corporate_officer
          if position.include?('corporate_officer')
            roles << {
              type: 'corporate_officer',
              company_id: dir.company_id,
              company_name: dir.company.name,
              position: dir.position,
              is_current: dir.is_current
            }
          end

          # Add public_officer role if position includes public_officer
          if position.include?('public_officer')
            roles << {
              type: 'public_officer',
              company_id: dir.company_id,
              company_name: dir.company.name,
              position: dir.position,
              is_current: dir.is_current
            }
          end
        end

        # Get shareholder roles
        contact.company_shareholdings.includes(:company).each do |sh|
          next unless sh.company&.company_group_id == company_group_id
          roles << {
            type: 'shareholder',
            company_id: sh.company_id,
            company_name: sh.company.name,
            shares: sh.number_of_shares,
            percentage: sh.percentage_of_total
          }
        end

        roles
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

        # If this entity is a Trust/Superfund, find and add its Trustee company as a child
        # The trustee company has is_trustee: true and trust_name matching this Trust's name
        if ['Trust', 'Superfund'].include?(company.entity_type) && company_group
          trustee_company = company_group.companies.find_by(is_trustee: true, trust_name: company.name)
          if trustee_company
            # Build trustee node (don't recurse to avoid infinite loop - trustee shouldn't have the trust as child again)
            trustee_shareholders = trustee_company.company_shareholdings.includes(:shareholder).map do |sh|
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

            trustee_node = {
              id: trustee_company.id,
              name: trustee_company.name,
              code: trustee_company.code,
              acn: trustee_company.acn,
              abn: trustee_company.abn,
              status: trustee_company.status,
              entity_type: trustee_company.entity_type,
              is_trustee: true,
              trust_name: trustee_company.trust_name,
              hierarchy_level: trustee_company.hierarchy_level,
              shareholders: trustee_shareholders,
              investments: [],
              children: [],
              is_trustee_of_trust: true  # Flag to indicate this company is the trustee of the parent trust
            }
            children.unshift(trustee_node)
          end
        end

        {
          id: company.id,
          name: company.name,
          code: company.code,
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
