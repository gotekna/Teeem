# frozen_string_literal: true

module Api
  module V1
    module Admin
      class TenantsController < ApplicationController
        before_action :require_teeem_staff!, except: [:current, :update_environment]

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
          puts "[DEBUG] TenantSwitch#switch called with id=#{params[:id]}"
          Rails.logger.info "[DEBUG] TenantSwitch#switch called with id=#{params[:id]}"
          tenant = CorporateGroup.find(params[:id])

          unless current_user.can_access_tenant?(tenant)
            return render json: { success: false, error: "Access denied to this tenant" }, status: :forbidden
          end

          # Store in signed cookie for tenant override (API doesn't have sessions)
          # Cross-origin (frontend:3000 → backend:3001) requires SameSite=None + Secure
          # Chrome treats localhost as secure, so this works in development
          cookies.signed[:admin_tenant_id] = {
            value: tenant.id,
            httponly: true,
            secure: true,  # Required for SameSite=None, Chrome treats localhost as secure
            same_site: :none,  # Required for cross-origin cookie setting
            domain: Rails.env.development? ? 'localhost' : nil  # Share across ports in dev
          }

          Rails.logger.info "[TenantSwitch] Cookie set for tenant #{tenant.id}"

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

        # PATCH /api/v1/admin/tenants/environment
        # Update current tenant's environment (staging/beta/production)
        def update_environment
          tenant = ActsAsTenant.current_tenant

          unless tenant
            return render json: { success: false, error: "No tenant context" }, status: :bad_request
          end

          # Validate environment value
          valid_environments = CorporateGroup.environments.keys
          unless valid_environments.include?(params[:environment])
            return render json: {
              success: false,
              error: "Invalid environment. Must be one of: #{valid_environments.join(', ')}"
            }, status: :unprocessable_entity
          end

          if tenant.update(environment: params[:environment])
            Rails.logger.info "[TenantEnvironment] User #{current_user.id} changed tenant #{tenant.id} environment to #{params[:environment]}"

            render json: {
              success: true,
              message: "Environment changed to #{params[:environment]}",
              tenant: tenant_json(tenant)
            }
          else
            render json: {
              success: false,
              error: tenant.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
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
