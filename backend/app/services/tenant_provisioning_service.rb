# frozen_string_literal: true

# Service to provision new tenants during self-service signup
#
# This service creates the full multi-tenancy structure for a new customer:
#
# Creation Order (dependencies matter!):
#   1. Tenant (SSoT for multi-tenancy isolation)
#   2. CorporateGroup (business grouping, belongs_to Tenant)
#   3. Organization (credential isolation, belongs_to Tenant)
#   4. TenantSetting (configuration, belongs_to Tenant)
#   5. Corporate (the customer's main company)
#   6. Contact (admin user's linked contact record)
#   7. User (admin user, belongs_to Tenant + Contact)
#   8. WarehouseProvider (storage config, belongs_to Tenant)
#   9. Default reference data (job types, statuses, contact types)
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
#   # => { success: true, tenant: Tenant, admin_user: User }
#
class TenantProvisioningService
  attr_reader :params, :tenant, :corporate_group, :organization, :corporate_company, :admin_user, :errors

  def initialize(params)
    @params = params.with_indifferent_access
    @tenant = nil
    @corporate_group = nil
    @organization = nil
    @corporate_company = nil
    @admin_user = nil
    @errors = []
  end

  def provision!
    ActiveRecord::Base.transaction do
      # Phase 1: Core multi-tenancy structure
      create_tenant           # 1. Tenant (SSoT)
      create_corporate_group  # 2. CorporateGroup (belongs_to Tenant)
      create_organization     # 3. Organization (credential isolation)
      create_tenant_setting   # 4. TenantSetting (config)
      create_corporate_company # 5. Corporate (main company)

      # Phase 2: Admin user (requires Contact per Jan 2026 rules)
      create_admin_user       # 6-7. Contact + User

      # Phase 3: Storage and reference data
      setup_storage           # 8. WarehouseProvider
      create_default_reference_data # 9. Job types, statuses, etc.

      # Phase 4: Optional enhancements
      start_trial if @params[:start_trial]
      import_starter_templates
      copy_master_pricebook if @params[:include_pricebook]
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

  # ============================================================================
  # Phase 1: Core multi-tenancy structure
  # ============================================================================

  def create_tenant
    slug = generate_slug(@params[:company_name])

    @tenant = Tenant.create!(
      name: @params[:company_name],
      slug: slug,
      tier: @params[:tier] || :shared,
      environment: :production,
      is_master_tenant: false,
      active: true
    )

    Rails.logger.info "[TenantProvisioning] Created Tenant: #{@tenant.name} (ID: #{@tenant.id}, slug: #{@tenant.slug})"
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Failed to create tenant: #{e.message}"
    raise ActiveRecord::Rollback
  end

  def create_corporate_group
    @corporate_group = CorporateGroup.create!(
      tenant: @tenant,
      name: @params[:company_name],
      slug: @tenant.slug  # Reuse tenant slug for consistency
    )

    Rails.logger.info "[TenantProvisioning] Created CorporateGroup: #{@corporate_group.name}"
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Failed to create corporate group: #{e.message}"
    raise ActiveRecord::Rollback
  end

  def create_organization
    @organization = Organization.create!(
      tenant: @tenant,
      name: "#{@params[:company_name]} Organization",
      is_active: true
    )

    Rails.logger.info "[TenantProvisioning] Created Organization: #{@organization.name}"
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Failed to create organization: #{e.message}"
    raise ActiveRecord::Rollback
  end

  def create_tenant_setting
    TenantSetting.create!(
      tenant: @tenant,
      corporate_group: @corporate_group,  # Backward compat
      company_name: @params[:company_name],
      abn: @params[:abn],
      email: @params[:email],
      phone: @params[:phone],
      website: @params[:website],
      timezone: @params[:timezone] || "Australia/Brisbane",
      locale: @params[:locale] || "en-AU",
      currency: @params[:currency] || "AUD"
    )

    Rails.logger.info "[TenantProvisioning] Created TenantSetting for #{@tenant.name}"
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Failed to create tenant settings: #{e.message}"
    raise ActiveRecord::Rollback
  end

  def create_corporate_company
    # Corporate requires a Contact (Contact is THE ONE SSoT for identity)
    # Create company contact first
    company_contact = Contact.create!(
      tenant_id: @tenant.id,
      display_name: @params[:company_name],
      legal_name: @params[:company_name],
      email: @params[:email],
      phone: @params[:phone],
      website: @params[:website],
      abn: @params[:abn],
      entity_type: "company",
      is_active: true
    )

    @corporate_company = Corporate.create!(
      tenant: @tenant,
      company_group_id: @corporate_group.id,
      contact: company_contact,
      name: @params[:company_name],
      abn: @params[:abn],
      entity_type: "Company",
      active: true
    )

    # Set this company as the billing company for the tenant
    @tenant.update!(billing_company: @corporate_company)

    Rails.logger.info "[TenantProvisioning] Created Corporate: #{@corporate_company.name}"
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Failed to create corporate company: #{e.message}"
    raise ActiveRecord::Rollback
  end

  # ============================================================================
  # Phase 2: Admin user
  # ============================================================================

  def create_admin_user
    temp_password = generate_temp_password

    # Create Contact first (User MUST have Contact per Jan 2026 rules)
    admin_contact = Contact.create!(
      tenant_id: @tenant.id,
      display_name: "#{@params[:admin_first_name]} #{@params[:admin_last_name]}",
      first_name: @params[:admin_first_name],
      last_name: @params[:admin_last_name],
      email: @params[:admin_email],
      entity_type: "person",
      is_team_contact: true,  # Internal team member
      primary_company_id: @corporate_company&.id,
      is_active: true
    )

    @admin_user = User.create!(
      tenant: @tenant,
      corporate_group: @corporate_group,  # Backward compat
      contact: admin_contact,  # REQUIRED: User must have Contact
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

  # ============================================================================
  # Phase 3: Storage and reference data
  # ============================================================================

  def setup_storage
    if @tenant.tier_dedicated?
      setup_dedicated_storage
    else
      setup_shared_storage
    end
  end

  def setup_dedicated_storage
    bucket_name = "teeem-#{@tenant.slug}"

    WarehouseProvider.create!(
      tenant: @tenant,
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
      tenant: @tenant,
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
    :s3_compatible
  end

  def create_default_reference_data
    # Create default job types (schema uses 'position' not 'display_order')
    default_job_types = ["New Build", "Renovation", "Extension", "Other"]
    default_job_types.each_with_index do |name, index|
      JobType.create(
        tenant_id: @tenant.id,
        name: name,
        position: index,
        is_active: true
      )
    end

    # Create default job statuses (schema uses 'position', no 'is_open' column)
    default_job_statuses = [
      { name: "Lead", color: "#94a3b8" },
      { name: "Quoting", color: "#3b82f6" },
      { name: "Won", color: "#22c55e" },
      { name: "In Progress", color: "#f59e0b" },
      { name: "Complete", color: "#10b981" },
      { name: "Lost", color: "#ef4444" }
    ]
    default_job_statuses.each_with_index do |attrs, index|
      JobStatus.create(
        tenant_id: @tenant.id,
        name: attrs[:name],
        color: attrs[:color],
        position: index,
        is_active: true
      )
    end

    # Create default job stages
    default_job_stages = ["Pre-Construction", "Foundation", "Frame", "Lock Up", "Fit Off", "Handover"]
    default_job_stages.each_with_index do |name, index|
      JobStage.create(
        tenant_id: @tenant.id,
        name: name,
        position: index,
        is_active: true
      )
    end

    # Create default contact types (schema uses 'position', 'active', and requires 'display_name')
    default_contact_types = ["Client", "Supplier", "Subcontractor", "Consultant", "Architect", "Engineer"]
    default_contact_types.each_with_index do |name, index|
      ContactType.create(
        tenant_id: @tenant.id,
        name: name.downcase,       # slug-style name
        display_name: name,        # Human-readable display name
        position: index,
        active: true
      )
    end

    Rails.logger.info "[TenantProvisioning] Created default reference data for #{@tenant.name}"
  rescue StandardError => e
    Rails.logger.warn "[TenantProvisioning] Reference data creation warning: #{e.message}"
    # Don't fail for reference data errors - can be set up later
  end

  # ============================================================================
  # Phase 4: Optional enhancements
  # ============================================================================

  def start_trial
    trial_days = @params[:trial_days] || 30
    @tenant.update!(
      trial_starts_at: Time.current,
      trial_ends_at: trial_days.days.from_now,
      trial_days: trial_days,
      trial_status: 'active',
      invited_by_user_id: @params[:invited_by]&.id
    )
    Rails.logger.info "[TenantProvisioning] Started #{trial_days}-day trial for #{@tenant.name}"
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Failed to start trial: #{e.message}"
    raise ActiveRecord::Rollback
  end

  def import_starter_templates
    template_pack_ids = @params[:template_pack_ids] || default_template_packs

    return if template_pack_ids.empty?

    template_pack_ids.each do |pack_id|
      pack = TemplatePack.find_by(id: pack_id)
      next unless pack

      begin
        result = TemplateImportService.new(@tenant, pack).import!(skip_existing: true)

        if result[:success]
          Rails.logger.info "[TenantProvisioning] Imported template pack: #{pack.name}"
        else
          Rails.logger.warn "[TenantProvisioning] Template pack import had errors: #{result[:errors].join(', ')}"
        end
      rescue StandardError => e
        Rails.logger.warn "[TenantProvisioning] Template import error: #{e.message}"
      end
    end
  end

  def default_template_packs
    TemplatePack.where(visibility: :curated, status: :published).pluck(:id)
  end

  # Copy pricebook from master tenant with 5% markup
  # Uses TenantConfigSyncService for FK remapping and consistency
  def copy_master_pricebook
    master = Tenant.find_by(is_master_tenant: true) || Tenant.find_by(slug: "teeem")
    unless master
      Rails.logger.warn "[TenantProvisioning] No master tenant found, skipping pricebook copy"
      return
    end

    sync_service = TenantConfigSyncService.new(@tenant)
    markup_percent = 5.0

    # Step 1: Copy contacts (suppliers) - needed for FK references in price_histories
    supplier_contact_ids = ActsAsTenant.with_tenant(master) do
      # Only copy contacts that have price histories (suppliers with pricing data)
      Contact.joins("INNER JOIN price_histories ON price_histories.supplier_id = contacts.id")
             .distinct
             .pluck(:id)
    end

    if supplier_contact_ids.any?
      contacts_result = sync_service.pull_from_master(
        table: :contacts,
        record_ids: supplier_contact_ids,
        mode: :add_new
      )
      Rails.logger.info "[TenantProvisioning] Copied #{contacts_result[:imported]&.length || 0} supplier contacts"
    end

    # Step 2: Copy pricebook items with 5% markup
    pricebook_item_ids = ActsAsTenant.with_tenant(master) do
      PricebookItem.where(is_active: true).pluck(:id)
    end

    if pricebook_item_ids.any?
      items_result = sync_service.pull_from_master(
        table: :pricebook_items,
        record_ids: pricebook_item_ids,
        mode: :add_new,
        price_markup_percent: markup_percent
      )
      Rails.logger.info "[TenantProvisioning] Copied #{items_result[:imported]&.length || 0} pricebook items with #{markup_percent}% markup"
    end

    # Step 3: Copy price histories with 5% markup
    price_history_ids = ActsAsTenant.with_tenant(master) do
      PriceHistory.pluck(:id)
    end

    if price_history_ids.any?
      histories_result = sync_service.pull_from_master(
        table: :price_histories,
        record_ids: price_history_ids,
        mode: :add_new,
        price_markup_percent: markup_percent
      )
      Rails.logger.info "[TenantProvisioning] Copied #{histories_result[:imported]&.length || 0} price histories with #{markup_percent}% markup"
    end

    Rails.logger.info "[TenantProvisioning] Pricebook copy complete for #{@tenant.name}"
  rescue StandardError => e
    Rails.logger.warn "[TenantProvisioning] Pricebook copy warning: #{e.message}"
    # Don't fail provisioning for pricebook errors - can be synced later via Config Sync
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
  end

  # ============================================================================
  # Post-provisioning
  # ============================================================================

  def send_welcome_email
    return unless @admin_user

    temp_password = @admin_user.instance_variable_get(:@temp_password)

    if @params[:start_trial] && @tenant.trial_active?
      UserMailer.trial_welcome_email(@admin_user, temp_password, @tenant).deliver_later
    else
      UserMailer.welcome_email(@admin_user, temp_password).deliver_later
    end

    Rails.logger.info "[TenantProvisioning] Welcome email queued for #{@admin_user.email}"
  rescue StandardError => e
    Rails.logger.warn "[TenantProvisioning] Welcome email failed: #{e.message}"
  end

  def log_provision_success
    Rails.logger.info "[TenantProvisioning] Successfully provisioned tenant:"
    Rails.logger.info "  Name: #{@tenant.name}"
    Rails.logger.info "  Slug: #{@tenant.slug}"
    Rails.logger.info "  Tier: #{@tenant.tier}"
    Rails.logger.info "  Admin: #{@admin_user.email}"
    Rails.logger.info "  Login URL: #{@tenant.subdomain}.teeem.com.au"
  end

  # ============================================================================
  # Helpers
  # ============================================================================

  def generate_slug(name)
    base_slug = name.to_s.parameterize
    slug = base_slug
    counter = 1

    # Check both Tenant AND CorporateGroup for uniqueness
    while Tenant.exists?(slug: slug) || CorporateGroup.exists?(slug: slug)
      slug = "#{base_slug}-#{counter}"
      counter += 1
    end

    slug
  end

  def generate_temp_password
    SecureRandom.hex(8)
  end
end
