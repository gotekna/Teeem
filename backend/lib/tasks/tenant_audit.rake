# frozen_string_literal: true

# Tenant Audit Tasks
# ===================
# Read-only audit tasks to diagnose multi-tenancy data integrity issues.
#
# Usage:
#   rails tenant:audit           # Full audit
#   rails tenant:audit:tenants   # Tenant status only
#   rails tenant:audit:users     # User assignment only
#   rails tenant:audit:corporate # Corporate entities only
#   rails tenant:audit:data      # Data visibility only

namespace :tenant do
  desc "Full tenant data integrity audit"
  task audit: :environment do
    TenantAuditRunner.new.run_full_audit
  end

  namespace :audit do
    desc "Audit tenant status and configuration"
    task tenants: :environment do
      TenantAuditRunner.new.audit_tenants
    end

    desc "Audit user assignments (tenant_id vs corporate_group_id)"
    task users: :environment do
      TenantAuditRunner.new.audit_users
    end

    desc "Audit corporate entities per tenant"
    task corporate: :environment do
      TenantAuditRunner.new.audit_corporate
    end

    desc "Audit data visibility (records without tenant assignment)"
    task data: :environment do
      TenantAuditRunner.new.audit_data_visibility
    end
  end
end

# Audit runner class to encapsulate all audit logic
class TenantAuditRunner
  DIVIDER = "=" * 80
  SECTION = "-" * 60

  def run_full_audit
    puts "\n#{DIVIDER}"
    puts "TENANT DATA INTEGRITY AUDIT"
    puts "Generated: #{Time.current.strftime('%Y-%m-%d %H:%M:%S %Z')}"
    puts "#{DIVIDER}\n"

    audit_tenants
    audit_users
    audit_corporate
    audit_data_visibility
    print_summary
  end

  # =========================================================================
  # Section 1: Tenant Status
  # =========================================================================
  def audit_tenants
    puts "\n#{DIVIDER}"
    puts "SECTION 1: TENANT STATUS"
    puts "#{DIVIDER}\n"

    tenants = Tenant.all.order(:id)

    if tenants.empty?
      puts "⚠️  NO TENANTS FOUND IN DATABASE"
      puts "   This is a critical issue - at least one master tenant should exist."
      @tenant_issues ||= []
      @tenant_issues << "No tenants exist in database"
      return
    end

    puts "Found #{tenants.count} tenant(s):\n\n"

    tenants.each do |tenant|
      print_tenant_details(tenant)
    end

    # Check for orphaned CorporateGroups (not linked to any Tenant)
    orphaned_groups = CorporateGroup.where(tenant_id: nil)
    if orphaned_groups.any?
      puts "\n#{SECTION}"
      puts "⚠️  ORPHANED CORPORATE GROUPS (no tenant_id):"
      puts "#{SECTION}"
      orphaned_groups.each do |group|
        companies_count = group.corporates.count
        puts "   - ID: #{group.id}, Name: #{group.name}, Slug: #{group.slug || 'NULL'}"
        puts "     Companies: #{companies_count}, is_master_tenant: #{group.is_master_tenant?}"
      end
      @tenant_issues ||= []
      @tenant_issues << "#{orphaned_groups.count} CorporateGroups not linked to any Tenant"
    end
  end

  def print_tenant_details(tenant)
    puts "#{SECTION}"
    puts "TENANT: #{tenant.name} (ID: #{tenant.id})"
    puts "#{SECTION}"

    # Basic info
    puts "  Slug:           #{tenant.slug}"
    puts "  Tier:           #{tenant.tier}"
    puts "  Environment:    #{tenant.environment}"
    puts "  Active:         #{tenant.active?}"
    puts "  Master Tenant:  #{tenant.is_master_tenant?}"

    # Billing company
    if tenant.billing_company_id.present?
      billing = tenant.billing_company
      if billing
        puts "  Billing Co:     #{billing.name} (ID: #{billing.id})"
      else
        puts "  ⚠️  Billing Co:  ID #{tenant.billing_company_id} - RECORD NOT FOUND!"
        @tenant_issues ||= []
        @tenant_issues << "Tenant #{tenant.name}: billing_company_id points to non-existent record"
      end
    else
      puts "  ⚠️  Billing Co:  NOT SET"
      @tenant_issues ||= []
      @tenant_issues << "Tenant #{tenant.name}: billing_company_id is NULL"
    end

    # Corporate groups linked to this tenant
    groups = tenant.corporate_groups
    puts "  Corp Groups:    #{groups.count}"
    groups.each do |group|
      puts "                  - #{group.name} (ID: #{group.id}, #{group.corporate_companies.count} companies)"
    end

    # Corporate companies (via groups)
    companies_count = tenant.corporate_companies.count
    puts "  Corp Companies: #{companies_count}"

    # Users via tenant_id
    users_by_tenant = User.where(tenant_id: tenant.id).count
    puts "  Users (tenant): #{users_by_tenant}"

    if users_by_tenant == 0
      @tenant_issues ||= []
      @tenant_issues << "Tenant #{tenant.name}: No users assigned"
    end

    # Organizations (if the association exists and table has tenant_id)
    if Organization.column_names.include?("tenant_id")
      orgs_count = Organization.where(tenant_id: tenant.id).count
      puts "  Organizations:  #{orgs_count}" if orgs_count > 0
    end

    # Storage config (if the association exists)
    begin
      if tenant.respond_to?(:storage_configuration) && tenant.storage_configuration.present?
        puts "  Storage Config: Present (provider: #{tenant.storage_configuration.provider_type || 'not set'})"
      end
    rescue StandardError
      # Ignore if table doesn't exist
    end

    puts ""
  end

  # =========================================================================
  # Section 2: User Assignment Audit
  # =========================================================================
  def audit_users
    puts "\n#{DIVIDER}"
    puts "SECTION 2: USER ASSIGNMENT AUDIT"
    puts "#{DIVIDER}\n"

    total_users = User.count
    puts "Total Users: #{total_users}\n\n"

    # Users with tenant_id assigned (correct)
    assigned = User.where.not(tenant_id: nil)
    puts "✅ Users with tenant_id assigned:              #{assigned.count}"

    # Users without tenant_id (orphans - need assignment)
    orphans = User.where(tenant_id: nil)
    puts "❌ Users without tenant_id (orphans):          #{orphans.count}"
    if orphans.any?
      @user_issues ||= []
      @user_issues << "#{orphans.count} users have no tenant assignment (orphans)"
    end

    # Breakdown by tenant
    puts "\n#{SECTION}"
    puts "USERS BY TENANT"
    puts "#{SECTION}\n"

    Tenant.all.each do |tenant|
      count = User.where(tenant_id: tenant.id).count
      puts "  #{tenant.name.ljust(30)} #{count} users"
    end
    orphan_count = User.where(tenant_id: nil).count
    puts "  #{'(No tenant assigned)'.ljust(30)} #{orphan_count} users" if orphan_count > 0

    # Breakdown by email domain
    puts "\n#{SECTION}"
    puts "USER BREAKDOWN BY EMAIL DOMAIN"
    puts "#{SECTION}\n"

    domain_breakdown = User.select("LOWER(SUBSTRING(email FROM POSITION('@' IN email) + 1)) as domain, COUNT(*) as count")
                          .group("LOWER(SUBSTRING(email FROM POSITION('@' IN email) + 1))")
                          .order("count DESC")
                          .limit(20)

    domain_breakdown.each do |row|
      domain = row.domain || "(no domain)"
      puts "  #{domain.ljust(35)} #{row.count} users"
    end

    # Detail orphan users
    if orphans.any?
      puts "\n#{SECTION}"
      puts "ORPHAN USERS (need tenant assignment)"
      puts "#{SECTION}\n"
      orphans.limit(30).each do |user|
        domain = user.email&.split("@")&.last || "unknown"
        puts "  - #{user.email.to_s.ljust(40)} (#{user.name})"
      end
      puts "  ... and #{orphans.count - 30} more" if orphans.count > 30

      # Suggest assignment based on email domain
      puts "\n#{SECTION}"
      puts "SUGGESTED TENANT ASSIGNMENTS (by email domain)"
      puts "#{SECTION}\n"
      puts "  @tekna.com.au      → Tekna tenant"
      puts "  @teeem.com.au      → TEEEM tenant"
      puts "  @pilgrim*          → Pilgrim tenant"
      puts "  Others             → Review individually"
    end
  end

  # =========================================================================
  # Section 3: Corporate Entity Audit
  # =========================================================================
  def audit_corporate
    puts "\n#{DIVIDER}"
    puts "SECTION 3: CORPORATE ENTITY AUDIT"
    puts "#{DIVIDER}\n"

    tenants = Tenant.all

    tenants.each do |tenant|
      puts "#{SECTION}"
      puts "TENANT: #{tenant.name}"
      puts "#{SECTION}\n"

      groups = tenant.corporate_groups

      if groups.empty?
        puts "  ⚠️  NO CORPORATE GROUPS linked to this tenant"
        @corporate_issues ||= []
        @corporate_issues << "Tenant #{tenant.name}: No CorporateGroups linked"
      else
        groups.each do |group|
          puts "  CorporateGroup: #{group.name} (ID: #{group.id})"
          companies = group.corporate_companies
          puts "    Companies: #{companies.count}"

          if companies.any?
            # Show first 5 companies
            companies.limit(5).each do |company|
              status = company.status == "active" ? "✓" : "○"
              puts "      #{status} #{company.name} (#{company.code || 'no code'})"
            end
            puts "      ... and #{companies.count - 5} more" if companies.count > 5
          else
            puts "    ⚠️  No companies in this group"
          end
        end
      end

      # Check if billing_company exists in tenant's corporate companies
      if tenant.billing_company_id.present?
        billing = tenant.billing_company
        if billing
          tenant_company_ids = tenant.corporate_companies.pluck(:id)
          unless tenant_company_ids.include?(billing.id)
            puts "\n  ⚠️  BILLING COMPANY NOT IN TENANT'S COMPANIES"
            puts "     billing_company (ID: #{billing.id}) is not in any of this tenant's corporate groups"
            @corporate_issues ||= []
            @corporate_issues << "Tenant #{tenant.name}: billing_company not in tenant's corporate companies"
          end
        end
      end

      puts ""
    end

    # Check for Corporates without a corporate_group
    orphaned_companies = Corporate.where(company_group_id: nil)
    if orphaned_companies.any?
      puts "#{SECTION}"
      puts "⚠️  ORPHANED CORPORATE COMPANIES (no company_group_id)"
      puts "#{SECTION}\n"
      orphaned_companies.limit(20).each do |company|
        puts "  - #{company.name} (ID: #{company.id}, status: #{company.status})"
      end
      puts "  ... and #{orphaned_companies.count - 20} more" if orphaned_companies.count > 20
      @corporate_issues ||= []
      @corporate_issues << "#{orphaned_companies.count} Corporates have no company_group_id"
    end
  end

  # =========================================================================
  # Section 4: Data Visibility Audit
  # =========================================================================
  def audit_data_visibility
    puts "\n#{DIVIDER}"
    puts "SECTION 4: DATA VISIBILITY AUDIT"
    puts "#{DIVIDER}\n"

    puts "Checking for records without tenant assignment...\n\n"

    # Models that should have tenant_id for tenant scoping
    # We'll check the actual column that exists in each table
    scoped_models = %w[
      Job
      Contact
      SmScheduleMaster
      SmTrade
      PricebookCategory
      PurchaseOrder
      Estimate
      Asset
      JobType
      JobStatus
      JobStage
      ContactType
      DocumentType
      SmScheduleMasterTemplate
      PublicHoliday
      WarehouseFolder
    ]

    issues_found = false

    scoped_models.each do |model_name|
      begin
        model_class = model_name.constantize

        # Check which scope column actually exists in the table
        scope_column = if model_class.column_names.include?("tenant_id")
                         :tenant_id
                       elsif model_class.column_names.include?("company_group_id")
                         :company_group_id
                       else
                         nil
                       end

        if scope_column.nil?
          puts "⚠️  #{model_name.ljust(25)} - no tenant_id or company_group_id column"
          next
        end

        total = model_class.count
        unscoped = model_class.where(scope_column => nil).count

        if unscoped > 0
          percentage = ((unscoped.to_f / total) * 100).round(1)
          puts "⚠️  #{model_name.ljust(25)} #{unscoped.to_s.rjust(6)} / #{total.to_s.rjust(6)} unscoped (#{percentage}%) [#{scope_column}]"
          @data_issues ||= []
          @data_issues << "#{model_name}: #{unscoped} records without #{scope_column}"
          issues_found = true
        else
          puts "✅ #{model_name.ljust(25)} #{total.to_s.rjust(6)} records - all scoped [#{scope_column}]"
        end
      rescue NameError
        puts "⚠️  #{model_name.ljust(25)} - model not found (may not exist yet)"
      rescue StandardError => e
        puts "❌ #{model_name.ljust(25)} - error: #{e.class}: #{e.message[0..80]}"
      end
    end

    puts "\n✅ All models properly scoped!" unless issues_found
  end

  # =========================================================================
  # Summary
  # =========================================================================
  def print_summary
    puts "\n#{DIVIDER}"
    puts "AUDIT SUMMARY"
    puts "#{DIVIDER}\n"

    all_issues = []
    all_issues += (@tenant_issues || [])
    all_issues += (@user_issues || [])
    all_issues += (@corporate_issues || [])
    all_issues += (@data_issues || [])

    if all_issues.empty?
      puts "✅ NO ISSUES FOUND - Tenant data integrity looks good!\n\n"
    else
      puts "❌ #{all_issues.count} ISSUE(S) FOUND:\n\n"

      if @tenant_issues&.any?
        puts "TENANT ISSUES:"
        @tenant_issues.each { |issue| puts "  - #{issue}" }
        puts ""
      end

      if @user_issues&.any?
        puts "USER ASSIGNMENT ISSUES:"
        @user_issues.each { |issue| puts "  - #{issue}" }
        puts ""
      end

      if @corporate_issues&.any?
        puts "CORPORATE ENTITY ISSUES:"
        @corporate_issues.each { |issue| puts "  - #{issue}" }
        puts ""
      end

      if @data_issues&.any?
        puts "DATA VISIBILITY ISSUES:"
        @data_issues.each { |issue| puts "  - #{issue}" }
        puts ""
      end

      puts "\nRun 'rails tenant:fix' after reviewing these issues to apply fixes."
    end

    puts "#{DIVIDER}\n"
  end
end
