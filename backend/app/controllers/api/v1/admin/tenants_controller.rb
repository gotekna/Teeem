# frozen_string_literal: true

module Api
  module V1
    module Admin
      class TenantsController < ApplicationController
        before_action :require_teeem_staff!, except: [:current]

        # GET /api/v1/admin/tenants
        # Returns all tenants (for TEEEM staff) or just user's tenant
        def index
          tenants = if current_user.teeem_staff?
                      CorporateGroup.where.not(slug: [nil, ""])
                                    .order(:name)
                    else
                      current_user.available_tenants
                    end

          render json: {
            success: true,
            tenants: tenants.map { |t| tenant_json(t) },
            current_tenant: current_tenant_json,
            user: {
              id: current_user.id,
              email: current_user.email,
              name: current_user.name,
              isTeeemStaff: current_user.teeem_staff?
            }
          }
        end

        # GET /api/v1/admin/tenants/current
        # Returns current tenant info (works for all authenticated users)
        def current
          render json: {
            success: true,
            tenant: current_tenant_json,
            user: {
              id: current_user.id,
              email: current_user.email,
              name: current_user.name,
              isTeeemStaff: current_user.teeem_staff?
            }
          }
        end

        # GET /api/v1/admin/tenants/:id
        # Returns single tenant details
        def show
          tenant = CorporateGroup.find(params[:id])

          unless current_user.can_access_tenant?(tenant)
            return render json: { success: false, error: "Access denied" }, status: :forbidden
          end

          render json: {
            success: true,
            tenant: tenant_json(tenant, include_stats: true)
          }
        end

        # POST /api/v1/admin/tenants/:id/switch
        # Switch to a different tenant (TEEEM staff only)
        def switch
          tenant = CorporateGroup.find(params[:id])

          unless current_user.can_access_tenant?(tenant)
            return render json: { success: false, error: "Access denied to this tenant" }, status: :forbidden
          end

          # Store in signed cookie for tenant override (API doesn't have sessions)
          # Note: same_site: :none required for cross-origin requests (Vercel → Heroku)
          cookies.signed[:admin_tenant_id] = {
            value: tenant.id,
            httponly: true,
            secure: Rails.env.production?,
            same_site: Rails.env.production? ? :none : :lax
          }

          Rails.logger.info "[TenantSwitch] User #{current_user.id} (#{current_user.email}) switched to tenant #{tenant.id} (#{tenant.name})"

          render json: {
            success: true,
            message: "Switched to #{tenant.name}",
            tenant: tenant_json(tenant)
          }
        end

        # DELETE /api/v1/admin/tenants/switch
        # Clear tenant override (return to user's default tenant)
        def clear_switch
          previous_tenant_id = cookies.signed[:admin_tenant_id]
          cookies.delete(:admin_tenant_id)

          Rails.logger.info "[TenantSwitch] User #{current_user.id} (#{current_user.email}) cleared tenant override (was: #{previous_tenant_id})"

          render json: {
            success: true,
            message: "Returned to default tenant",
            tenant: current_user.corporate_group ? tenant_json(current_user.corporate_group) : nil
          }
        end

        private

        def require_teeem_staff!
          return if current_user&.teeem_staff?

          render json: {
            success: false,
            error: "Unauthorized. TEEEM staff access required."
          }, status: :forbidden
        end

        def current_tenant_json
          tenant = ActsAsTenant.current_tenant
          tenant ? tenant_json(tenant) : nil
        end

        def tenant_json(tenant, include_stats: false)
          json = {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            tier: tenant.tier,
            environment: tenant.environment,
            isMasterTenant: tenant.is_master_tenant?,
            loginUrl: tenant.login_url,
            logoUrl: tenant.settings&.logo_url,
            primaryColor: tenant.settings&.primary_color
          }

          if include_stats
            json[:stats] = {
              usersCount: User.where(corporate_group_id: tenant.id).count,
              jobsCount: Job.where(company_group_id: tenant.id).count,
              contactsCount: Contact.where(company_group_id: tenant.id).count
            }
          end

          json
        end
      end
    end
  end
end
