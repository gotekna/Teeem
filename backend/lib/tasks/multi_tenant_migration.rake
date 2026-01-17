# frozen_string_literal: true

namespace :tenants do
  desc "Migrate existing single-tenant data to multi-tenant structure"
  task migrate: :environment do
    puts "Starting multi-tenant migration..."
    puts "=" * 60

    ActiveRecord::Base.transaction do
      # Step 1: Create TEEEM master tenant
      puts "\n[Step 1] Creating TEEEM master tenant..."
      teeem = CorporateGroup.find_or_create_by!(slug: "teeem") do |t|
        t.name = "TEEEM"
        t.tier = :shared
        t.environment = :production
        t.is_master_tenant = true
      end
      # Ensure is_master_tenant is set even if record already existed
      teeem.update!(is_master_tenant: true) unless teeem.is_master_tenant?
      puts "  ✓ TEEEM tenant ID: #{teeem.id} (master: #{teeem.is_master_tenant?})"

      # Step 2: Create Tekna tenant (first paying customer - wife's company)
      puts "\n[Step 2] Creating Tekna Homes tenant..."
      tekna = CorporateGroup.find_or_create_by!(slug: "tekna-homes") do |t|
        t.name = "Tekna Homes"
        t.tier = :shared
        t.environment = :staging
        t.is_master_tenant = false
      end
      puts "  ✓ Tekna tenant ID: #{tekna.id}"

      # Step 3: Migrate TenantSetting from existing company settings
      puts "\n[Step 3] Creating tenant settings..."
      create_tenant_settings(teeem, tekna)

      # Step 4: Assign existing config data to Tekna
      puts "\n[Step 4] Assigning configuration tables to Tekna..."
      assign_config_tables_to_tenant(tekna)

      # Step 5: Assign business data to Tekna
      puts "\n[Step 5] Assigning business data to Tekna..."
      assign_business_data_to_tenant(tekna)

      # Step 6: Assign users to Tekna (except TEEEM staff)
      puts "\n[Step 6] Assigning users to appropriate tenants..."
      assign_users_to_tenants(teeem, tekna)

      # Step 7: Copy Tekna config to TEEEM as master templates (future feature)
      puts "\n[Step 7] Template sync will be done after TemplateExportService is created"

      puts "\n" + "=" * 60
      puts "Migration complete!"
      puts "  TEEEM tenant: ID #{teeem.id} (#{teeem.slug}) - Master tenant"
      puts "  Tekna tenant: ID #{tekna.id} (#{tekna.slug}) - First customer"
      puts "=" * 60
    end
  end

  desc "Verify multi-tenant migration was successful"
  task verify: :environment do
    puts "Verifying multi-tenant migration..."
    puts "=" * 60

    errors = []
    warnings = []

    # Check TEEEM master tenant exists
    teeem = CorporateGroup.find_by(slug: "teeem")
    if teeem.nil?
      errors << "TEEEM master tenant not found"
    elsif !teeem.is_master_tenant?
      errors << "TEEEM tenant is not marked as master"
    else
      puts "✓ TEEEM master tenant exists (ID: #{teeem.id})"
    end

    # Check Tekna tenant exists
    tekna = CorporateGroup.find_by(slug: "tekna-homes")
    if tekna.nil?
      errors << "Tekna Homes tenant not found"
    else
      puts "✓ Tekna Homes tenant exists (ID: #{tekna.id})"
    end

    # Check config tables have company_group_id
    config_models = [
      JobType, JobStatus, JobStage, ContactType, DocumentType,
      SmScheduleMasterTemplate, PublicHoliday, EntityTab
    ]

    puts "\nConfiguration tables:"
    config_models.each do |model|
      next unless model.table_exists?

      orphans = model.where(company_group_id: nil).count
      total = model.count
      if orphans > 0
        warnings << "#{model.name}: #{orphans}/#{total} records without tenant"
        puts "  ⚠ #{model.name}: #{orphans}/#{total} records without tenant"
      else
        puts "  ✓ #{model.name}: #{total} records, all assigned"
      end
    end

    # Check business data tables
    business_models = [
      { model: Contact, name: "Contact" },
      { model: Job, name: "Job" },
      { model: PurchaseOrder, name: "PurchaseOrder" },
      { model: Estimate, name: "Estimate" },
      { model: Asset, name: "Asset" },
      { model: EmailWarehouse, name: "EmailWarehouse" }
    ]

    puts "\nBusiness data tables:"
    business_models.each do |item|
      model = item[:model]
      next unless model.table_exists?

      orphans = model.where(company_group_id: nil).count
      total = model.count
      if orphans > 0
        warnings << "#{item[:name]}: #{orphans}/#{total} records without tenant"
        puts "  ⚠ #{item[:name]}: #{orphans}/#{total} records without tenant"
      else
        puts "  ✓ #{item[:name]}: #{total} records, all assigned"
      end
    end

    # Check users
    puts "\nUsers:"
    orphan_users = User.where(corporate_group_id: nil).count
    total_users = User.count
    if orphan_users > 0
      warnings << "Users: #{orphan_users}/#{total_users} without tenant"
      puts "  ⚠ Users: #{orphan_users}/#{total_users} without tenant"
    else
      puts "  ✓ Users: #{total_users} users, all assigned"
    end

    # Check tenant settings
    puts "\nTenant Settings:"
    if teeem && TenantSetting.exists?(corporate_group_id: teeem.id)
      puts "  ✓ TEEEM has tenant settings"
    else
      warnings << "TEEEM missing tenant settings"
      puts "  ⚠ TEEEM missing tenant settings"
    end

    if tekna && TenantSetting.exists?(corporate_group_id: tekna.id)
      puts "  ✓ Tekna has tenant settings"
    else
      warnings << "Tekna missing tenant settings"
      puts "  ⚠ Tekna missing tenant settings"
    end

    # Summary
    puts "\n" + "=" * 60
    if errors.any?
      puts "ERRORS FOUND (#{errors.count}):"
      errors.each { |e| puts "  ✗ #{e}" }
    end

    if warnings.any?
      puts "WARNINGS (#{warnings.count}):"
      warnings.each { |w| puts "  ⚠ #{w}" }
    end

    if errors.empty? && warnings.empty?
      puts "✓ All verifications passed!"
    elsif errors.empty?
      puts "\n⚠ Migration complete with warnings. Review above."
    else
      puts "\n✗ Migration has errors. Run 'rails tenants:migrate' to fix."
    end
    puts "=" * 60
  end

  desc "Show tenant statistics"
  task stats: :environment do
    puts "Tenant Statistics"
    puts "=" * 60

    CorporateGroup.order(:id).each do |tenant|
      puts "\n#{tenant.name} (#{tenant.slug})"
      puts "-" * 40
      puts "  ID: #{tenant.id}"
      puts "  Master: #{tenant.is_master_tenant? ? 'Yes' : 'No'}"
      puts "  Tier: #{tenant.tier}"
      puts "  Environment: #{tenant.environment}"

      # Count records
      counts = {}
      counts[:users] = User.where(corporate_group_id: tenant.id).count
      counts[:jobs] = Job.where(company_group_id: tenant.id).count if Job.table_exists?
      counts[:contacts] = Contact.where(company_group_id: tenant.id).count if Contact.table_exists?
      counts[:job_types] = JobType.where(company_group_id: tenant.id).count if JobType.table_exists?
      counts[:emails] = EmailWarehouse.where(company_group_id: tenant.id).count if EmailWarehouse.table_exists?

      puts "  Records:"
      counts.each do |type, count|
        puts "    #{type}: #{count}"
      end
    end

    # Orphaned records
    puts "\n" + "=" * 60
    puts "Orphaned Records (no tenant assigned):"
    puts "-" * 40
    orphan_counts = {}
    orphan_counts[:users] = User.where(corporate_group_id: nil).count
    orphan_counts[:jobs] = Job.where(company_group_id: nil).count if Job.table_exists?
    orphan_counts[:contacts] = Contact.where(company_group_id: nil).count if Contact.table_exists?

    if orphan_counts.values.sum == 0
      puts "  ✓ No orphaned records"
    else
      orphan_counts.each do |type, count|
        puts "  #{type}: #{count}" if count > 0
      end
    end
  end

  private

  def create_tenant_settings(teeem, tekna)
    # Create TEEEM settings
    TenantSetting.find_or_create_by!(corporate_group: teeem) do |ts|
      ts.company_name = "TEEEM"
      ts.timezone = "Australia/Brisbane"
      ts.locale = "en-AU"
      ts.currency = "AUD"
    end
    puts "  ✓ TEEEM tenant settings created"

    # Create Tekna settings - try to copy from existing CorporateCompanySetting if available
    TenantSetting.find_or_create_by!(corporate_group: tekna) do |ts|
      ts.company_name = "Tekna Homes"
      ts.timezone = "Australia/Brisbane"
      ts.locale = "en-AU"
      ts.currency = "AUD"

      # Try to copy from existing settings if available
      if defined?(CorporateCompanySetting) && CorporateCompanySetting.table_exists?
        old_setting = CorporateCompanySetting.first
        if old_setting
          ts.abn = old_setting.abn if old_setting.respond_to?(:abn)
          ts.qbcc_license = old_setting.qbcc_license if old_setting.respond_to?(:qbcc_license)
          ts.email = old_setting.email if old_setting.respond_to?(:email)
          ts.phone = old_setting.phone if old_setting.respond_to?(:phone)
          ts.website = old_setting.website if old_setting.respond_to?(:website)
          ts.address = old_setting.address if old_setting.respond_to?(:address)
          puts "  ✓ Tekna settings copied from CorporateCompanySetting"
        end
      end
    end
    puts "  ✓ Tekna tenant settings created"
  end

  def assign_config_tables_to_tenant(tenant)
    assign_to_tenant(JobType, tenant, :company_group_id)
    assign_to_tenant(JobStatus, tenant, :company_group_id)
    assign_to_tenant(JobStage, tenant, :company_group_id)
    assign_to_tenant(ContactType, tenant, :company_group_id)
    assign_to_tenant(DocumentType, tenant, :company_group_id)
    assign_to_tenant(SmScheduleMasterTemplate, tenant, :company_group_id)
    assign_to_tenant(PublicHoliday, tenant, :company_group_id)
    assign_to_tenant(EntityTab, tenant, :company_group_id)
  end

  def assign_business_data_to_tenant(tenant)
    # Core business data
    assign_to_tenant(Contact, tenant, :company_group_id)
    assign_to_tenant(Job, tenant, :company_group_id)
    assign_to_tenant(SmScheduleMaster, tenant, :company_group_id)
    assign_to_tenant(SmTask, tenant, :company_group_id) if defined?(SmTask) && SmTask.table_exists?
    assign_to_tenant(SmTrade, tenant, :company_group_id) if defined?(SmTrade) && SmTrade.table_exists?

    # Finance
    assign_to_tenant(PricebookItem, tenant, :company_group_id) if defined?(PricebookItem) && PricebookItem.table_exists?
    assign_to_tenant(PricebookCategory, tenant, :company_group_id) if defined?(PricebookCategory) && PricebookCategory.table_exists?
    assign_to_tenant(PurchaseOrder, tenant, :company_group_id)
    assign_to_tenant(Estimate, tenant, :company_group_id)

    # Assets
    assign_to_tenant(Asset, tenant, :company_group_id)

    # Email
    assign_to_tenant(EmailWarehouse, tenant, :company_group_id)

    # Timesheets (if exists)
    if defined?(Timesheet) && Timesheet.table_exists?
      assign_to_tenant(Timesheet, tenant, :company_group_id)
    end
    if defined?(TimesheetEntry) && TimesheetEntry.table_exists?
      assign_to_tenant(TimesheetEntry, tenant, :company_group_id)
    end

    # Meetings (if exists)
    if defined?(Meeting) && Meeting.table_exists?
      assign_to_tenant(Meeting, tenant, :company_group_id)
    end
  end

  def assign_users_to_tenants(teeem, tekna)
    # TEEEM staff (identified by @teeem.com.au email) go to TEEEM tenant
    teeem_staff_count = User.where("email LIKE ?", "%@teeem.com.au")
                            .where(corporate_group_id: nil)
                            .update_all(corporate_group_id: teeem.id)
    puts "  ✓ #{teeem_staff_count} TEEEM staff assigned to TEEEM tenant"

    # Everyone else goes to Tekna
    tekna_users_count = User.where(corporate_group_id: nil)
                            .update_all(corporate_group_id: tekna.id)
    puts "  ✓ #{tekna_users_count} users assigned to Tekna tenant"
  end

  def assign_to_tenant(model, tenant, column = :company_group_id)
    return unless model.table_exists?
    return unless model.column_names.include?(column.to_s)

    count = model.where(column => nil).count
    return if count == 0

    model.where(column => nil).update_all(column => tenant.id)
    puts "  ✓ #{model.name}: #{count} records assigned to #{tenant.name}"
  end
end
