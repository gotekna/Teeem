namespace :bank_statements do
  desc "Test regenerate one bank statement report"
  task test_one: :environment do
    report = BankStatementReport.completed.where.not(company_id: nil).first
    if report.nil?
      puts "No reports with company_id found"
      exit
    end

    puts "Testing: #{report.display_name}"
    puts "  Company: #{report.corporate_company&.name}"
    puts "  Group: #{report.corporate_company&.group_name}"
    puts ""

    tab = EntityTab.find_by(tab_key: "xero-bank-statement")
    puts "EntityTab path: #{tab&.sharepoint_folder_path}"
    puts ""

    result = report.generate!
    puts "Result: #{result[:success] ? 'SUCCESS' : "FAILED: #{result[:error]}"}"
    puts "New URL: #{report.reload.cloudinary_url&.slice(0, 80)}"

    doc = CorporateCompanyDocument.find_by(external_id: "bank_statement_report:#{report.id}")
    puts "Document created: #{doc ? "YES (ID #{doc.id})" : 'NO'}"
  end

  desc "Regenerate all bank statement reports to correct path and create document records"
  task fix_all: :environment do
    # First link reports to companies
    puts "Step 1: Linking reports to companies..."
    linked = 0
    BankStatementReport.where(company_id: nil).where.not(company_code: nil).find_each do |report|
      company = CorporateCompany.find_by(code: report.company_code)
      if company
        report.update_column(:company_id, company.id)
        linked += 1
      end
    end
    puts "  Linked #{linked} reports"

    # Now regenerate
    puts ""
    puts "Step 2: Regenerating reports..."
    total = BankStatementReport.completed.where.not(company_id: nil).count
    success = 0
    failed = 0

    BankStatementReport.completed.where.not(company_id: nil).find_each.with_index do |report, idx|
      print "\r  Processing #{idx + 1}/#{total}: #{report.display_name[0..40]}..."
      result = report.generate!
      if result[:success]
        success += 1
      else
        failed += 1
        puts "\n    FAILED: #{result[:error]}"
      end
    end

    puts ""
    puts ""
    puts "Done!"
    puts "  Success: #{success}"
    puts "  Failed: #{failed}"
    puts "  Documents created: #{CorporateCompanyDocument.where(source: 'xero').where('external_id LIKE ?', 'bank_statement_report%').count}"
  end
end
