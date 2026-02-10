namespace :xero do
  desc "Fix XeroCredential teeem_tenant_id based on CorporateXeroConnection → Company → CompanyGroup → Tenant chain"
  task fix_tenant_ids: :environment do
    puts "=== XeroCredential Tenant ID Fix ==="
    puts ""

    fixed = 0
    skipped = 0
    already_correct = 0
    no_connection = 0

    XeroCredential.find_each do |cred|
      # Find the company connection for this credential
      connection = CorporateXeroConnection.find_by(xero_credential_id: cred.id)

      unless connection
        puts "  ⏭️  #{cred.tenant_name} (#{cred.id}): No CorporateXeroConnection - keeping teeem_tenant_id=#{cred.teeem_tenant_id}"
        no_connection += 1
        next
      end

      company = connection.corporate
      unless company
        puts "  ⚠️  #{cred.tenant_name} (#{cred.id}): Connection exists but company not found"
        skipped += 1
        next
      end

      company_group = company.company_group
      unless company_group
        puts "  ⚠️  #{cred.tenant_name} (#{cred.id}): Company #{company.name} has no company_group"
        skipped += 1
        next
      end

      correct_tenant_id = company_group.tenant_id
      unless correct_tenant_id
        puts "  ⚠️  #{cred.tenant_name} (#{cred.id}): CompanyGroup #{company_group.name} has no tenant_id"
        skipped += 1
        next
      end

      if cred.teeem_tenant_id == correct_tenant_id
        puts "  ✅ #{cred.tenant_name} (#{cred.id}): Already correct → tenant #{correct_tenant_id} (#{Tenant.find(correct_tenant_id).name})"
        already_correct += 1
      else
        old_tenant = Tenant.find_by(id: cred.teeem_tenant_id)
        new_tenant = Tenant.find(correct_tenant_id)
        puts "  🔧 #{cred.tenant_name} (#{cred.id}): #{old_tenant&.name} (#{cred.teeem_tenant_id}) → #{new_tenant.name} (#{correct_tenant_id})"
        cred.update_column(:teeem_tenant_id, correct_tenant_id)
        fixed += 1
      end
    end

    puts ""
    puts "=== Summary ==="
    puts "  Fixed:           #{fixed}"
    puts "  Already correct: #{already_correct}"
    puts "  No connection:   #{no_connection}"
    puts "  Skipped:         #{skipped}"
    puts "  Total:           #{XeroCredential.count}"
    puts ""

    # Verify final state
    puts "=== Final State ==="
    Tenant.order(:name).each do |t|
      creds = XeroCredential.where(teeem_tenant_id: t.id)
      puts "  #{t.name} (#{t.id}, master=#{t.is_master_tenant?}): #{creds.count} credentials"
      creds.each { |c| puts "    - #{c.tenant_name}" }
    end
  end
end
