module Api
  module V1
    class CompanyGroupsController < ApplicationController
      before_action :set_company_group, only: [ :show, :update, :destroy, :companies, :structure, :contacts ]

      # GET /api/v1/company_groups
      def index
        @company_groups = CompanyGroup.all

        # Filter by active status
        if params[:active].present?
          @company_groups = @company_groups.where(active: params[:active] == "true")
        end

        # Search using SSoT SearchService
        if params[:search].present?
          @company_groups = SearchService.apply(
            @company_groups,
            params[:search],
            columns: %w[name],
            mode: params[:search_mode] || 'contains',
            model: CompanyGroup
          )
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
          render_validation_errors(@company_group)
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
          render_validation_errors(@company_group)
        end
      end

      # DELETE /api/v1/company_groups/:id
      def destroy
        if @company_group.corporate_companies.any?
          render json: {
            success: false,
            errors: [ "Cannot delete group with #{@company_group.corporate_companies.count} companies. Reassign companies first." ]
          }, status: :unprocessable_entity
        else
          @company_group.destroy
          render json: { success: true }
        end
      end

      # GET /api/v1/company_groups/:id/companies
      def companies
        companies = @company_group.corporate_companies.order(:name)

        render json: {
          success: true,
          data: companies.map { |c| serialize_company_summary(c) }
        }
      end

      # GET /api/v1/company_groups/:id/structure
      def structure
        # Pre-load ALL companies in this group to avoid N+1 in recursive tree building
        all_companies = @company_group.corporate_companies.order(:name).to_a
        companies_by_id = all_companies.index_by(&:id)

        # Pre-load all shareholdings and investments for companies in this group
        company_ids = all_companies.map(&:id)
        all_shareholdings = CorporateShareholding.where(company_id: company_ids).includes(:shareholder).group_by(&:company_id)
        all_investments = CorporateShareholding.where(shareholder_type: "Corporate", shareholder_id: company_ids).includes(:corporate).group_by(&:shareholder_id)

        # Pre-load children lookup (consolidated_children by parent_id)
        children_by_parent = all_companies.select(&:consolidation_parent_id).group_by(&:consolidation_parent_id)

        # Pre-load trust entities by name for trustee lookups
        trusts_by_name = all_companies
          .select { |c| c.entity_type.in?(%w[Trust Superfund]) }
          .index_by(&:name)

        # Build pre-loaded context hash to pass through recursion
        preloaded = {
          shareholdings: all_shareholdings,
          investments: all_investments,
          children_by_parent: children_by_parent,
          trusts_by_name: trusts_by_name
        }

        # Find trusts/superfunds that have a trustee company (in-memory, no queries)
        trustee_trust_names = all_companies.select(&:is_trustee).map(&:trust_name).compact.to_set
        trusts_with_trustees_ids = all_companies
          .select { |c| c.entity_type.in?(%w[Trust Superfund]) && trustee_trust_names.include?(c.name) }
          .map(&:id).to_set

        # Top-level = no parent AND not a trust shown under its trustee
        top_level = all_companies.select { |c| c.consolidation_parent_id.nil? && !trusts_with_trustees_ids.include?(c.id) }

        # SSoT: Get people in this group via memberships
        # Pre-load directorships and shareholdings for all people to avoid N+1 in get_person_roles
        people_memberships = @company_group.contact_memberships.people.active.includes(:contact)
        contact_ids = people_memberships.map(&:contact_id).compact.uniq
        @directorships_by_contact = CorporateDirector
          .where(contact_id: contact_ids)
          .includes(:corporate)
          .group_by(&:contact_id)
        @shareholdings_by_contact = CorporateShareholding
          .where(shareholder_type: "Contact", shareholder_id: contact_ids)
          .includes(:corporate)
          .group_by(&:shareholder_id)

        people = people_memberships.map { |m| serialize_person_membership(m) }

        render json: {
          success: true,
          data: {
            group: {
              id: @company_group.id,
              name: @company_group.name
            },
            companies: top_level.map { |c| build_hierarchy_tree(c, @company_group, preloaded) },
            people: people,
            stats: {
              total_companies: all_companies.count,
              top_level_count: top_level.count,
              trustees_count: all_companies.count(&:is_trustee),
              trusts_count: all_companies.count { |c| c.entity_type == "Trust" },
              people_count: people.count
            }
          }
        }
      end

      # GET /api/v1/company_groups/:id/contacts
      def contacts
        memberships = @company_group.contact_memberships
          .includes(:contact, :corporate)

        if params[:type].present?
          memberships = memberships.where(membership_type: params[:type])
        end

        if params[:active].present?
          memberships = params[:active] == "true" ? memberships.active : memberships.where(is_active: false)
        end

        render json: {
          success: true,
          data: memberships.map { |m| serialize_membership(m) }.compact
        }
      end

      private

      def set_company_group
        @company_group = CompanyGroup.find(params[:id])
      end

      def company_group_params
        params.require(:company_group).permit(
          :name,
          :code,
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
          code: group.code,
          description: group.description,
          default_registered_office: group.default_registered_office,
          default_principal_place: group.default_principal_place,
          default_accountant: group.default_accountant,
          default_accountant_contact: group.default_accountant_contact,
          active: group.active,
          companies_count: group.corporate_companies_count,
          created_at: group.created_at,
          updated_at: group.updated_at
        }

        if include_companies
          data[:companies] = group.corporate_companies.order(:name).map { |c| serialize_company_summary(c) }
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
        return nil unless contact  # Skip orphaned memberships

        # Check if this contact has a linked Company record
        linked_company = Corporate.find_by(contact_id: contact.id)
        {
          id: membership.id,
          contact_id: contact.id,
          contact_name: contact.display_name,
          contact_email: contact.email,
          contact_entity_type: contact.entity_type,
          company_group_id: membership.company_group_id,
          membership_type: membership.membership_type,
          company_id: membership.company_id,
          company_name: membership.corporate&.name,
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
      # Uses pre-loaded @directorships_by_contact and @shareholdings_by_contact when available
      def get_person_roles(contact, company_group_id)
        roles = []

        # Get directorship/officer roles (director, secretary, corporate_officer, public_officer)
        directorships = @directorships_by_contact&.dig(contact.id) || contact.corporate_directorships.includes(:corporate)
        directorships.each do |dir|
          next unless dir.corporate&.company_group_id == company_group_id

          position = dir.position.to_s

          if position.include?("director") || position == "chairman"
            roles << { type: "director", company_id: dir.company_id, company_name: dir.corporate.name, position: dir.position, is_current: dir.is_current }
          end

          if position.include?("secretary")
            roles << { type: "secretary", company_id: dir.company_id, company_name: dir.corporate.name, position: dir.position, is_current: dir.is_current }
          end

          if position.include?("corporate_officer")
            roles << { type: "corporate_officer", company_id: dir.company_id, company_name: dir.corporate.name, position: dir.position, is_current: dir.is_current }
          end

          if position.include?("public_officer")
            roles << { type: "public_officer", company_id: dir.company_id, company_name: dir.corporate.name, position: dir.position, is_current: dir.is_current }
          end
        end

        # Get shareholder roles
        shareholdings = @shareholdings_by_contact&.dig(contact.id) || contact.corporate_shareholdings.includes(:corporate)
        shareholdings.each do |sh|
          next unless sh.corporate&.company_group_id == company_group_id
          roles << {
            type: "shareholder",
            company_id: sh.company_id,
            company_name: sh.corporate&.name,
            shares: sh.number_of_shares,
            percentage: sh.percentage_of_total
          }
        end

        roles
      end

      def build_hierarchy_tree(company, company_group = nil, preloaded = {})
        # Use pre-loaded shareholdings (no DB query)
        shareholders = (preloaded[:shareholdings]&.dig(company.id) || []).map do |sh|
          shareholder_name = DisplayValueResolver.resolve(sh.shareholder)
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

        # Use pre-loaded investments (no DB query)
        investments = (preloaded[:investments]&.dig(company.id) || []).map do |inv|
          {
            company_id: inv.company_id,
            company_name: inv.corporate&.name,
            shares: inv.number_of_shares,
            percentage: inv.percentage_of_total
          }
        end

        # Use pre-loaded children (no DB query, recursive)
        child_companies = (preloaded[:children_by_parent]&.dig(company.id) || []).sort_by(&:name)
        children = child_companies.map { |s| build_hierarchy_tree(s, company_group, preloaded) }

        # If this company is a trustee, add the Trust/Superfund entity as a child
        # Uses pre-loaded trusts_by_name (no DB query)
        if company.is_trustee && company.trust_name.present? && preloaded[:trusts_by_name]
          trust_entity = preloaded[:trusts_by_name][company.trust_name]
          if trust_entity
            trust_node = {
              id: trust_entity.id,
              name: trust_entity.name,
              code: trust_entity.code,
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
              is_trust_of_trustee: true
            }
            children.unshift(trust_node)
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
          date_incorporated: company.date_incorporated,
          shareholders: shareholders,
          investments: investments,
          children: children
        }
      end
    end
  end
end
