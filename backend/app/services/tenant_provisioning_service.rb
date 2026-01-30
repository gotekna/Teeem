# frozen_string_literal: true

# Service to provision new tenants during self-service signup
#
# Usage:
#   service = TenantProvisioningService.new(
#     company_name: "Pilgrim Homes",
#     abn: "12345678901",
#     email: "admin@pilgrimhomes.com.au",
#     phone: "0412345678",
#     website: "https://pilgrimhomes.com.au",
#     admin_email: "john@pilgrimhomes.com.au",
#     admin_first_name: "John",
#     admin_last_name: "Smith",
#     tier: :shared,
#     template_pack_ids: [1, 2, 3]
#   )
#   result = service.provision!
#   # => { success: true, tenant: CorporateGroup, admin_user: User }
#
class TenantProvisioningService
  attr_reader :params, :tenant, :admin_user, :errors

  def initialize(params)
    @params = params.with_indifferent_access
    @tenant = nil
    @admin_user = nil
    @errors = []
  end

  def provision!
    ActiveRecord::Base.transaction do
      create_tenant
      create_tenant_setting
      create_admin_user
      import_starter_templates
      setup_storage
      create_stripe_customer if stripe_enabled?

      raise ActiveRecord::Rollback if @errors.any?
    end

    if @errors.empty?
      send_welcome_email
      log_provision_success
    end

    {
      success: @errors.empty?,
      tenant: @tenant,
      admin_user: @admin_user,
      errors: @errors
    }
  rescue StandardError => e
    Rails.logger.error "[TenantProvisioning] Fatal error: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
    @errors << "Provisioning failed: #{e.message}"
    { success: false, errors: @errors }
  end

  private

  def create_tenant
    slug = generate_slug(@params[:company_name])

    @tenant = CorporateGroup.create!(
      name: @params[:company_name],
      slug: slug,
      tier: @params[:tier] || :shared,
      environment: :production,
      is_master_tenant: false
    )

    Rails.logger.info "[TenantProvisioning] Created tenant: #{@tenant.name} (ID: #{@tenant.id}, slug: #{@tenant.slug})"
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Failed to create tenant: #{e.message}"
    raise ActiveRecord::Rollback
  end

  def create_tenant_setting
    TenantSetting.create!(
      corporate_group: @tenant,
      company_name: @params[:company_name],
      abn: @params[:abn],
      email: @params[:email],
      phone: @params[:phone],
      website: @params[:website],
      timezone: @params[:timezone] || "Australia/Brisbane",
      locale: @params[:locale] || "en-AU",
      currency: @params[:currency] || "AUD"
    )

    Rails.logger.info "[TenantProvisioning] Created tenant settings for #{@tenant.name}"
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Failed to create tenant settings: #{e.message}"
    raise ActiveRecord::Rollback
  end

  def create_admin_user
    temp_password = generate_temp_password

    @admin_user = User.create!(
      corporate_group: @tenant,
      email: @params[:admin_email],
      first_name: @params[:admin_first_name],
      last_name: @params[:admin_last_name],
      password: temp_password,
      password_confirmation: temp_password,
      role: "admin"
    )

    # Store temp password for welcome email (not persisted)
    @admin_user.instance_variable_set(:@temp_password, temp_password)

    Rails.logger.info "[TenantProvisioning] Created admin user: #{@admin_user.email}"
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Failed to create admin user: #{e.message}"
    raise ActiveRecord::Rollback
  end

  def import_starter_templates
    template_pack_ids = @params[:template_pack_ids] || default_template_packs

    return if template_pack_ids.empty?

    template_pack_ids.each do |pack_id|
      pack = TemplatePack.find_by(id: pack_id)
      next unless pack

      result = TemplateImportService.new(@tenant, pack).import!(skip_existing: true)

      if result[:success]
        Rails.logger.info "[TenantProvisioning] Imported template pack: #{pack.name}"
      else
        Rails.logger.warn "[TenantProvisioning] Template pack import had errors: #{result[:errors].join(', ')}"
        # Don't fail provisioning for template import errors
      end
    end
  end

  def default_template_packs
    # Get curated packs from TEEEM master tenant
    TemplatePack.where(visibility: :curated, status: :published).pluck(:id)
  end

  def setup_storage
    if @tenant.dedicated?
      # For dedicated tier, create separate bucket
      setup_dedicated_storage
    else
      # For shared tier, use shared bucket with tenant prefix
      setup_shared_storage
    end
  end

  def setup_dedicated_storage
    bucket_name = "teeem-#{@tenant.slug}"

    WarehouseProvider.create!(
      corporate_group: @tenant,
      provider_type: default_storage_provider,
      bucket_name: bucket_name,
      status: :pending_setup
    )

    Rails.logger.info "[TenantProvisioning] Created dedicated storage config for #{@tenant.name}"
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Failed to setup storage: #{e.message}"
    raise ActiveRecord::Rollback
  end

  def setup_shared_storage
    WarehouseProvider.create!(
      corporate_group: @tenant,
      provider_type: default_storage_provider,
      bucket_name: "teeem-shared",
      path_prefix: @tenant.slug,
      status: :active
    )

    Rails.logger.info "[TenantProvisioning] Created shared storage config for #{@tenant.name}"
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Failed to setup storage: #{e.message}"
    raise ActiveRecord::Rollback
  end

  def default_storage_provider
    # Default to S3-compatible (Wasabi) for new tenants
    :s3_compatible
  end

  def stripe_enabled?
    ENV["STRIPE_SECRET_KEY"].present?
  end

  def create_stripe_customer
    return unless stripe_enabled?

    require "stripe"
    Stripe.api_key = ENV["STRIPE_SECRET_KEY"]

    customer = Stripe::Customer.create(
      email: @params[:billing_email] || @params[:admin_email],
      name: @params[:company_name],
      metadata: {
        tenant_id: @tenant.id,
        tenant_slug: @tenant.slug
      }
    )

    @tenant.tenant_setting.update!(stripe_customer_id: customer.id)

    Rails.logger.info "[TenantProvisioning] Created Stripe customer: #{customer.id}"
  rescue Stripe::StripeError => e
    Rails.logger.warn "[TenantProvisioning] Stripe customer creation failed: #{e.message}"
    # Don't fail provisioning for Stripe errors - billing can be set up later
  end

  def send_welcome_email
    return unless @admin_user

    TenantMailer.welcome(
      @tenant,
      @admin_user,
      temp_password: @admin_user.instance_variable_get(:@temp_password)
    ).deliver_later
  rescue StandardError => e
    Rails.logger.warn "[TenantProvisioning] Welcome email failed: #{e.message}"
    # Don't fail for email errors
  end

  def log_provision_success
    Rails.logger.info "[TenantProvisioning] Successfully provisioned tenant:"
    Rails.logger.info "  Name: #{@tenant.name}"
    Rails.logger.info "  Slug: #{@tenant.slug}"
    Rails.logger.info "  Tier: #{@tenant.tier}"
    Rails.logger.info "  Admin: #{@admin_user.email}"
    Rails.logger.info "  Login URL: #{@tenant.subdomain}.teeem.com.au"
  end

  def generate_slug(name)
    base_slug = name.to_s.parameterize
    slug = base_slug
    counter = 1

    while CorporateGroup.exists?(slug: slug)
      slug = "#{base_slug}-#{counter}"
      counter += 1
    end

    slug
  end

  def generate_temp_password
    # Generate a readable temporary password
    SecureRandom.hex(8)
  end
end
