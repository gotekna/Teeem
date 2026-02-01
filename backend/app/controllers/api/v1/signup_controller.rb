# frozen_string_literal: true

module Api
  module V1
    class SignupController < ApplicationController
      skip_before_action :authorize_request, only: [:create, :check_availability, :template_packs, :tiers, :invitation]
      skip_before_action :set_tenant, only: [:create, :check_availability, :template_packs, :tiers, :invitation], raise: false

      # POST /api/v1/signup
      # Create a new tenant (self-service signup)
      def create
        # Check for invitation token
        invitation = nil
        if params[:invite_token].present?
          invitation = TrialInvitation.valid.find_by(token: params[:invite_token])
          if invitation.nil?
            return render json: {
              success: false,
              error: "Invalid or expired invitation"
            }, status: :unprocessable_entity
          end
        end

        # Use invitation data as defaults if available
        effective_params = signup_params.to_h
        if invitation
          effective_params[:company_name] ||= invitation.company_name
          effective_params[:admin_email] ||= invitation.email
          effective_params[:admin_first_name] ||= invitation.name.split.first
          effective_params[:admin_last_name] ||= invitation.name.split[1..].join(' ')
        end

        # Validate required params
        missing = required_params - effective_params.keys.select { |k| effective_params[k].present? }
        if missing.any?
          return render json: {
            success: false,
            error: "Missing required fields: #{missing.join(', ')}"
          }, status: :unprocessable_entity
        end

        # Check if company name/slug already exists
        slug = effective_params[:company_name].to_s.parameterize
        if CorporateGroup.exists?(slug: slug)
          return render json: {
            success: false,
            error: "A company with this name already exists"
          }, status: :unprocessable_entity
        end

        # Check if admin email already exists
        if User.exists?(email: effective_params[:admin_email])
          return render json: {
            success: false,
            error: "An account with this email already exists"
          }, status: :unprocessable_entity
        end

        # Provision the tenant with trial if from invitation
        provision_params = effective_params.merge(
          start_trial: invitation.present?,
          trial_days: 30,
          invited_by: invitation&.invited_by
        )
        service = TenantProvisioningService.new(provision_params)
        result = service.provision!

        if result[:success]
          tenant = result[:tenant]

          # Mark invitation as accepted if present
          invitation&.accept!(tenant)

          render json: {
            success: true,
            message: "Account created successfully",
            tenant: {
              id: tenant.id,
              name: tenant.name,
              slug: tenant.slug,
              login_url: "https://#{tenant.slug}.teeem.com.au",
              trial_ends_at: tenant.trial_ends_at&.iso8601
            },
            admin_user: {
              id: result[:admin_user].id,
              email: result[:admin_user].email,
              name: result[:admin_user].name
            }
          }, status: :created
        else
          render json: {
            success: false,
            error: "Failed to create account",
            errors: result[:errors]
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/signup/check_availability
      # Check if a company name/slug is available
      def check_availability
        company_name = params[:company_name].to_s
        slug = company_name.parameterize

        if slug.blank?
          return render json: {
            available: false,
            error: "Company name is required"
          }
        end

        available = !CorporateGroup.exists?(slug: slug)

        render json: {
          available: available,
          suggested_slug: slug,
          login_url: available ? "https://#{slug}.teeem.com.au" : nil
        }
      end

      # GET /api/v1/signup/invitation/:token
      # Get invitation details by token (for prefilling signup form)
      def invitation
        token = params[:token]

        if token.blank?
          return render json: {
            success: false,
            error: "Token is required"
          }, status: :bad_request
        end

        invitation = TrialInvitation.valid.find_by(token: token)

        if invitation.nil?
          return render json: {
            success: false,
            error: "Invalid or expired invitation"
          }, status: :not_found
        end

        # Split name into first/last
        name_parts = invitation.name.to_s.split
        first_name = name_parts.first || ""
        last_name = name_parts[1..].join(' ')

        render json: {
          success: true,
          data: {
            email: invitation.email,
            name: invitation.name,
            first_name: first_name,
            last_name: last_name,
            company_name: invitation.company_name,
            personal_message: invitation.personal_message,
            sender_name: invitation.sender_name,
            expires_at: invitation.expires_at.iso8601
          }
        }
      end

      # GET /api/v1/signup/template_packs
      # Get available template packs for new tenants
      def template_packs
        packs = TemplatePack.where(visibility: [:curated, :marketplace], status: :published)
                            .includes(:source_tenant, :template_pack_items)
                            .order(visibility: :desc, downloads_count: :desc)

        render json: {
          success: true,
          template_packs: packs.map do |pack|
            {
              id: pack.id,
              name: pack.name,
              description: pack.description,
              visibility: pack.visibility,
              source_tenant: pack.source_tenant.name,
              downloads_count: pack.downloads_count,
              items_count: pack.template_pack_items.count,
              item_types: pack.template_pack_items.pluck(:item_type).uniq
            }
          end
        }
      end

      # GET /api/v1/signup/tiers
      # Get available pricing tiers
      def tiers
        render json: {
          success: true,
          tiers: [
            {
              id: "shared",
              name: "Standard",
              description: "Shared infrastructure, perfect for most builders",
              features: [
                "Full platform access",
                "Shared database",
                "Shared file storage",
                "Email support",
                "Template library access"
              ],
              pricing: {
                type: "per_job",
                amount: 1650, # $1,500 + GST
                currency: "AUD",
                description: "$1,500 + GST per job (charged when deposit received)"
              }
            },
            {
              id: "dedicated",
              name: "Enterprise",
              description: "Dedicated infrastructure for larger builders",
              features: [
                "Everything in Standard",
                "Dedicated database",
                "Dedicated file storage",
                "Priority support",
                "Custom domain option",
                "Advanced integrations"
              ],
              pricing: {
                type: "per_job",
                amount: 1650, # Same base, but with % on larger jobs
                currency: "AUD",
                description: "$1,500 + GST per job + tiered % on contract value"
              }
            }
          ]
        }
      end

      private

      def required_params
        %w[company_name admin_email admin_first_name admin_last_name]
      end

      def signup_params
        params.permit(
          :company_name,
          :abn,
          :email,
          :phone,
          :website,
          :admin_email,
          :admin_first_name,
          :admin_last_name,
          :tier,
          :billing_email,
          :timezone,
          :locale,
          :currency,
          :include_pricebook,
          template_pack_ids: []
        )
      end
    end
  end
end
