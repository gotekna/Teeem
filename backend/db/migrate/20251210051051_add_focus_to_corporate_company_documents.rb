class AddFocusToCorporateCompanyDocuments < ActiveRecord::Migration[8.0]
  def up
    # Add focus column with default 'company'
    add_column :corporate_documents, :focus, :string, default: 'company', null: false
    add_index :corporate_documents, :focus

    puts "\n" + "=" * 80
    puts "ADDING FOCUS FIELD TO CORPORATE_COMPANY_DOCUMENTS"
    puts "=" * 80
    puts "Focus categories: company, people, job"
    puts "=" * 80
    puts ""

    # Count documents by current associations
    total = CorporateCompanyDocument.count
    with_contact = CorporateCompanyDocument.where.not(contact_id: nil).count
    with_job = CorporateCompanyDocument.where.not(job_id: nil).count
    with_job_documentable = CorporateCompanyDocument.where("documentable_type LIKE ?", "%Job%").count

    puts "Total documents: #{total}"
    puts "Documents with contact_id (people): #{with_contact}"
    puts "Documents with job_id: #{with_job}"
    puts "Documents with Job documentable: #{with_job_documentable}"
    puts "=" * 80
    puts ""

    # Backfill focus based on associations
    stats = { people: 0, job: 0, company: 0 }

    # Priority order:
    # 1. contact_id → people
    # 2. job_id OR Job documentable → job
    # 3. else → company

    puts "Backfilling focus values..."

    # Set people focus
    people_count = CorporateCompanyDocument.where.not(contact_id: nil).update_all(focus: 'people')
    stats[:people] = people_count
    puts "✅ Set #{people_count} documents to 'people' focus"

    # Set job focus (exclude people that were already set)
    job_count = CorporateCompanyDocument
      .where(focus: 'company') # Only update ones still at default
      .where("job_id IS NOT NULL OR documentable_type LIKE ?", "%Job%")
      .update_all(focus: 'job')
    stats[:job] = job_count
    puts "✅ Set #{job_count} documents to 'job' focus"

    # Count remaining company docs (already have default)
    company_count = CorporateCompanyDocument.where(focus: 'company').count
    stats[:company] = company_count
    puts "✅ #{company_count} documents remain with 'company' focus (default)"

    puts "\n" + "=" * 80
    puts "FOCUS ASSIGNMENT COMPLETE"
    puts "=" * 80
    puts "People:  #{stats[:people]} documents"
    puts "Job:     #{stats[:job]} documents"
    puts "Company: #{stats[:company]} documents"
    puts "Total:   #{stats.values.sum} documents"
    puts "=" * 80
    puts ""
  end

  def down
    remove_index :corporate_documents, :focus
    remove_column :corporate_documents, :focus
  end
end
