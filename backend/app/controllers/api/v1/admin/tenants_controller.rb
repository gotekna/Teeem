# frozen_string_literal: true

module Api
  module V1
    module Admin
      class TenantsController < ApplicationController
        before_action :require_teeem_staff!, except: [:index, :current, :update_environment]

        # GET /api/v1/admin/tenants
        # Returns all tenants (for TEEEM staff) or just user's tenant
        # SSoT: Uses Tenant model (not CorporateGroup) for multi-tenancy
        def index
          tenants = if current_user.teeem_staff?
                      Tenant.active.order(:name)
                    else
                      [current_user.tenant].compact
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
        # SSoT: Uses Tenant model (not CorporateGroup)
        def show
          tenant = Tenant.find(params[:id])

          unless current_user.teeem_staff? || current_user.tenant_id == tenant.id
            return render json: { success: false, error: "Access denied" }, status: :forbidden
          end

          render json: {
            success: true,
            tenant: tenant_json(tenant, include_stats: true)
          }
        end

        # POST /api/v1/admin/tenants/:id/switch
        # Switch to a different tenant (TEEEM staff only)
        # SSoT: Uses Tenant model (not CorporateGroup)
        def switch
          Rails.logger.info "[TenantSwitch] Switch called with id=#{params[:id]}"
          tenant = Tenant.find(params[:id])

          unless current_user.teeem_staff?
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
        # SSoT: Uses Tenant model (not CorporateGroup)
        def clear_switch
          previous_tenant_id = cookies.signed[:admin_tenant_id]
          cookies.delete(:admin_tenant_id)

          Rails.logger.info "[TenantSwitch] User #{current_user.id} (#{current_user.email}) cleared tenant override (was: #{previous_tenant_id})"

          render json: {
            success: true,
            message: "Returned to default tenant",
            tenant: current_user.tenant ? tenant_json(current_user.tenant) : nil
          }
        end

        # GET /api/v1/admin/tenants/dashboard
        # Returns all tenants with usage stats for admin dashboard
        def dashboard
          tenants = Tenant.active.includes(:tenant_setting).order(created_at: :desc)

          render json: {
            success: true,
            data: {
              summary: {
                total: tenants.count,
                on_trial: tenants.on_trial.count,
                trial_expiring_7_days: tenants.trials_expiring_soon(7).count,
                trial_expired: tenants.trial_expired.count,
                converted: tenants.converted.count,
                active_today: active_tenants_today_count
              },
              tenants: tenants.map { |t| tenant_dashboard_json(t) }
            }
          }
        end

        # POST /api/v1/admin/tenants/:id/extend_trial
        # Extend a tenant's trial period
        def extend_trial
          tenant = Tenant.find(params[:id])
          days = params[:days].to_i.clamp(1, 90)

          new_end_date = tenant.extend_trial!(days: days)

          render json: {
            success: true,
            message: "Trial extended by #{days} days until #{new_end_date.strftime('%d %b %Y')}"
          }
        end

        # POST /api/v1/admin/tenants/:id/convert_to_paid
        # Convert a trial tenant to paid customer
        def convert_to_paid
          tenant = Tenant.find(params[:id])
          tenant.convert_to_paid!

          render json: {
            success: true,
            message: "#{tenant.name} converted to paid customer"
          }
        end

        # PATCH /api/v1/admin/tenants/environment
        # Update current tenant's environment (staging/beta/production)
        # SSoT: Uses Tenant model (not CorporateGroup)
        def update_environment
          tenant = ActsAsTenant.current_tenant

          unless tenant
            return render json: { success: false, error: "No tenant context" }, status: :bad_request
          end

          # Validate environment value
          valid_environments = Tenant.environments.keys
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

        def active_tenants_today_count
          Tenant.joins(:users)
                .where('users.last_login_at > ?', 24.hours.ago)
                .distinct
                .count
        end

        def tenant_dashboard_json(tenant)
          usage = tenant.usage_stats

          {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            company_name: tenant.tenant_setting&.company_name,
            tier: tenant.tier,
            trial_status: tenant.trial_status || 'none',
            trial_days_remaining: tenant.trial_days_remaining,
            trial_ends_at: tenant.trial_ends_at&.iso8601,
            created_at: tenant.created_at.iso8601,
            onboarding_complete: tenant.onboarding_completed_at.present?,
            usage: {
              total_users: usage[:total_users],
              active_today: usage[:active_users_today],
              active_week: usage[:active_users_week],
              last_activity: usage[:last_activity]&.iso8601,
              jobs_count: usage[:jobs_count],
              contacts_count: usage[:contacts_count]
            }
          }
        end

        def current_tenant_json
          tenant = ActsAsTenant.current_tenant
          tenant ? tenant_json(tenant) : nil
        end

        def tenant_json(tenant, include_stats: false)
          env = tenant.environment || "production"

          json = {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            tier: tenant.tier,
            environment: env,
            isMasterTenant: tenant.is_master_tenant?,
            loginUrl: tenant.login_url,
            logoUrl: tenant.settings&.logo_url,
            primaryColor: tenant.settings&.primary_color,
            # SSoT: TenantSetting environment URL constants
            frontendUrl: TenantSetting::FRONTEND_ENVIRONMENT_URLS[env],
            apiUrl: TenantSetting::API_ENVIRONMENT_URLS[env]
          }

          if include_stats
            # SSoT: Use tenant_id for stats (not corporate_group_id/company_group_id)
            json[:stats] = {
              usersCount: User.where(tenant_id: tenant.id).count,
              jobsCount: Job.where(tenant_id: tenant.id).count,
              contactsCount: Contact.where(tenant_id: tenant.id).count
            }
          end

          json
        end
      end
    end
  end
end
