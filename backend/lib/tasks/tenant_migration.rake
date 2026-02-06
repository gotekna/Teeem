# frozen_string_literal: true

namespace :tenant do
  desc "Assign all NULL tenant data to Tekna (for local dev after /h database pull)"
  task assign_null_to_tekna: :environment do
    tekna = CompanyGroup.find_by(slug: "tekna") || CompanyGroup.find(1)

    unless tekna
      puts "ERROR: Tekna tenant not found!"
      exit 1
    end

    puts "=== Assigning NULL tenant data to #{tekna.name} (ID: #{tekna.id}) ==="
    puts ""

    # All models with acts_as_tenant using company_group_id
    tenant_models = [
      Job,
      Contact,
      Estimate,
      PurchaseOrder,
      Asset,
      DocumentType,
      JobType,
      JobStatus,
      JobStage,
      ContactType,
      PricebookItem,
      PricebookCategory,
      PublicHoliday,
      SmScheduleMaster,
      SmScheduleMasterTemplate,
      SyncedEmail,
      BaseFolder  # Renamed from WarehouseFolder (Feb 2026)
    ]

    total_updated = 0

    tenant_models.each do |model|
      # Skip if model doesn't have company_group_id column
      unless model.column_names.include?("company_group_id")
        puts "  SKIP #{model.name} (no company_group_id column)"
        next
      end

      # Count NULL records
      null_count = model.unscoped.where(company_group_id: nil).count

      if null_count > 0
        # Update all NULL to Tekna
        updated = model.unscoped.where(company_group_id: nil).update_all(company_group_id: tekna.id)
        puts "  #{model.name}: #{updated} records assigned to #{tekna.name}"
        total_updated += updated
      else
        assigned_count = model.unscoped.where.not(company_group_id: nil).count
        puts "  #{model.name}: 0 NULL (#{assigned_count} already assigned)"
      end
    end

    puts ""
    puts "=== Total: #{total_updated} records assigned to #{tekna.name} ==="
    puts ""

    # Also fix users who should be assigned
    puts "=== Checking user tenant assignments ==="

    # Tekna employees (email ends with @tekna.com.au)
    tekna_users = User.where("email LIKE ?", "%@tekna.com.au").where(tenant_id: nil)
    if tekna_users.any?
      tekna_users.update_all(tenant_id: tekna.id)
      puts "  Assigned #{tekna_users.count} @tekna.com.au users to Tekna"
    end

    # TEEEM staff (email ends with @teeem.com.au) - they should stay NULL for multi-tenant access
    # OR be assigned to TEEEM tenant for proper identification
    teeem = CompanyGroup.find_by(slug: "teeem")
    if teeem
      teeem_users = User.where("email LIKE ?", "%@teeem.com.au").where(tenant_id: nil)
      if teeem_users.any?
        teeem_users.update_all(tenant_id: teeem.id)
        puts "  Assigned #{teeem_users.count} @teeem.com.au users to TEEEM"
      end
    end

    puts ""
    puts "Done! Run 'rails tenant:verify' to check the results."
  end

  desc "Verify tenant data assignment"
  task verify: :environment do
    puts "=== Tenant Data Verification ==="
    puts ""

    # Check each tenant's data
    CompanyGroup.where.not(slug: [nil, ""]).order(:name).each do |tenant|
      jobs_count = Job.unscoped.where(company_group_id: tenant.id).count
      contacts_count = Contact.unscoped.where(company_group_id: tenant.id).count
      users_count = User.where(tenant_id: tenant.id).count

      next if jobs_count == 0 && contacts_count == 0 && users_count == 0

      puts "#{tenant.name} (#{tenant.slug}):"
      puts "  Jobs: #{jobs_count}"
      puts "  Contacts: #{contacts_count}"
      puts "  Users: #{users_count}"
      puts ""
    end

    # Check NULL data
    puts "=== Records with NULL tenant ==="
    null_jobs = Job.unscoped.where(company_group_id: nil).count
    null_contacts = Contact.unscoped.where(company_group_id: nil).count
    null_users = User.where(tenant_id: nil).count

    puts "  Jobs: #{null_jobs}"
    puts "  Contacts: #{null_contacts}"
    puts "  Users: #{null_users}"

    if null_jobs > 0 || null_contacts > 0
      puts ""
      puts "WARNING: Some records have NULL tenant. Run 'rails tenant:assign_null_to_tekna' to fix."
    else
      puts ""
      puts "All records properly assigned to tenants."
    end
  end
end
