namespace :xero_bills do
  desc "Link bills to supplier contacts (SSoT migration)"
  task link_to_suppliers: :environment do
    puts "=" * 80
    puts "XERO BILLS → SUPPLIER LINKING (SSoT Migration)"
    puts "=" * 80
    puts ""

    # Get all bills
    total_bills = ExternalInvoice.bills.count
    bills_with_supplier = ExternalInvoice.bills.where.not(contact_id: nil).count
    bills_without_supplier = ExternalInvoice.bills.where(contact_id: nil).count

    puts "Total bills: #{total_bills}"
    puts "Already have supplier: #{bills_with_supplier} (#{(bills_with_supplier.to_f / total_bills * 100).round(1)}%)"
    puts "Missing supplier: #{bills_without_supplier}"
    puts ""

    if bills_without_supplier == 0
      puts "✅ All bills already have suppliers! No migration needed."
      next
    end

    # Try to link bills using external_contact_id
    puts "Attempting to link bills to suppliers using external_contact_id..."
    puts ""

    linked_count = 0
    error_count = 0
    missing_link_count = 0

    ExternalInvoice.bills.where(contact_id: nil).find_each do |bill|
      begin
        if bill.external_contact_id.present?
          # Find the ContactExternalLink
          link = ContactExternalLink.find_by(
            source: bill.source,
            tenant_id: bill.tenant_id,
            external_contact_id: bill.external_contact_id
          )

          if link&.contact
            bill.update!(contact_id: link.contact_id)
            linked_count += 1
            puts "✅ Bill ##{bill.id} (#{bill.invoice_number}) → #{link.contact.display_name}"
          else
            missing_link_count += 1
            puts "⚠️  Bill ##{bill.id} (#{bill.invoice_number}) - Supplier '#{bill.contact_name}' not synced to TEEEM"
          end
        else
          missing_link_count += 1
          puts "⚠️  Bill ##{bill.id} (#{bill.invoice_number}) - No external_contact_id"
        end
      rescue => e
        error_count += 1
        puts "❌ Bill ##{bill.id} (#{bill.invoice_number}) - Error: #{e.message}"
      end
    end

    puts ""
    puts "=" * 80
    puts "SUMMARY"
    puts "=" * 80
    puts "Successfully linked: #{linked_count}"
    puts "Missing supplier in TEEEM: #{missing_link_count}"
    puts "Errors: #{error_count}"
    puts ""

    if missing_link_count > 0
      puts "⚠️  #{missing_link_count} bills reference suppliers not yet synced from Xero."
      puts "   Run the Xero contact sync to import these suppliers first."
    end
  end

  desc "Report on bill storage status (SSoT analysis)"
  task report: :environment do
    puts "=" * 80
    puts "BILL STORAGE REPORT (SSoT Analysis)"
    puts "=" * 80
    puts ""

    total = ExternalInvoice.bills.count
    with_supplier = ExternalInvoice.bills.where.not(contact_id: nil).count
    without_supplier = ExternalInvoice.bills.where(contact_id: nil).count
    with_job = ExternalInvoice.bills.where.not(job_id: nil).count
    without_job = ExternalInvoice.bills.where(job_id: nil).count

    puts "TOTAL BILLS: #{total}"
    puts ""

    puts "SUPPLIER (SSoT):"
    puts "  With supplier: #{with_supplier} (#{(with_supplier.to_f / total * 100).round(1)}%)"
    puts "  Without supplier: #{without_supplier} (#{(without_supplier.to_f / total * 100).round(1)}%)"
    puts ""

    puts "JOB TRACKING (Optional):"
    puts "  With job: #{with_job} (#{(with_job.to_f / total * 100).round(1)}%)"
    puts "  Without job: #{without_job} (#{(without_job.to_f / total * 100).round(1)}%)"
    puts ""

    # Breakdown
    job_only = ExternalInvoice.bills.where.not(job_id: nil).where(contact_id: nil).count
    supplier_only = ExternalInvoice.bills.where.not(contact_id: nil).where(job_id: nil).count
    both = ExternalInvoice.bills.where.not(job_id: nil).where.not(contact_id: nil).count
    neither = ExternalInvoice.bills.where(job_id: nil, contact_id: nil).count

    puts "BREAKDOWN:"
    puts "  ✅ Both supplier AND job: #{both} (#{(both.to_f / total * 100).round(1)}%)"
    puts "  ⚠️  Supplier only (no job): #{supplier_only} (#{(supplier_only.to_f / total * 100).round(1)}%)"
    puts "  ⚠️  Job only (no supplier): #{job_only} (#{(job_only.to_f / total * 100).round(1)}%)"
    puts "  ❌ Neither supplier nor job: #{neither} (#{(neither.to_f / total * 100).round(1)}%)"
    puts ""

    # Bill documents
    puts "BILL DOCUMENTS (PDFs):"
    total_docs = CompanyDocument.where(documentable_type: "ExternalInvoice").count
    bill_docs = CompanyDocument.joins("INNER JOIN external_invoices ON external_invoices.id = company_documents.documentable_id")
                               .where("external_invoices.invoice_type = ?", "bill").count

    puts "  Total documents attached to ExternalInvoices: #{total_docs}"
    puts "  Documents attached to bills: #{bill_docs}"
    puts ""

    # Top suppliers by bill count
    puts "TOP 10 SUPPLIERS BY BILL COUNT:"
    Contact.joins(:external_invoices)
           .where(external_invoices: { invoice_type: "bill" })
           .group("contacts.id")
           .select("contacts.id, contacts.full_name, COUNT(external_invoices.id) as bill_count, SUM(external_invoices.total) as total_value")
           .order("bill_count DESC")
           .limit(10)
           .each_with_index do |contact, index|
      puts "  #{index + 1}. #{contact.full_name}: #{contact.bill_count} bills ($#{contact.total_value&.round(2)})"
    end
    puts ""

    if without_supplier > 0
      puts "⚠️  ACTION REQUIRED:"
      puts "  Run 'rails xero_bills:link_to_suppliers' to link bills to suppliers"
    else
      puts "✅ All bills are properly linked to suppliers (SSoT)"
    end
  end

  desc "Verify bill-supplier relationships (data integrity check)"
  task verify: :environment do
    puts "=" * 80
    puts "BILL-SUPPLIER DATA INTEGRITY CHECK"
    puts "=" * 80
    puts ""

    issues = []

    # Check 1: Bills with contact_name but no contact_id
    bills_missing_link = ExternalInvoice.bills
                                        .where.not(contact_name: nil)
                                        .where(contact_id: nil)
                                        .count
    if bills_missing_link > 0
      issues << "#{bills_missing_link} bills have contact_name but no contact_id (supplier link missing)"
    end

    # Check 2: Bills with contact_id that doesn't exist
    orphaned_bills = ExternalInvoice.bills
                                    .where.not(contact_id: nil)
                                    .where.not(contact_id: Contact.select(:id))
                                    .count
    if orphaned_bills > 0
      issues << "#{orphaned_bills} bills reference deleted contacts (orphaned)"
    end

    # Check 3: Bill documents without contact_id
    docs_missing_contact = CompanyDocument.joins("INNER JOIN external_invoices ON external_invoices.id = company_documents.documentable_id")
                                          .where("external_invoices.invoice_type = ?", "bill")
                                          .where("company_documents.contact_id IS NULL")
                                          .count
    if docs_missing_contact > 0
      issues << "#{docs_missing_contact} bill documents missing contact_id (should match bill's supplier)"
    end

    # Check 4: Bill documents with mismatched contact_id
    docs_mismatched = CompanyDocument.joins("INNER JOIN external_invoices ON external_invoices.id = company_documents.documentable_id")
                                     .where("external_invoices.invoice_type = ?", "bill")
                                     .where("company_documents.contact_id != external_invoices.contact_id")
                                     .where.not("company_documents.contact_id IS NULL")
                                     .where.not("external_invoices.contact_id IS NULL")
                                     .count
    if docs_mismatched > 0
      issues << "#{docs_mismatched} bill documents have different contact_id than their bill (mismatch)"
    end

    if issues.empty?
      puts "✅ No data integrity issues found!"
      puts ""
      puts "All bills are properly linked to suppliers."
      puts "All bill documents match their bill's supplier."
    else
      puts "❌ ISSUES FOUND:"
      puts ""
      issues.each_with_index do |issue, index|
        puts "  #{index + 1}. #{issue}"
      end
      puts ""
      puts "Run 'rails xero_bills:fix_integrity' to attempt automatic fixes."
    end
  end

  desc "Fix bill-supplier data integrity issues"
  task fix_integrity: :environment do
    puts "=" * 80
    puts "FIXING BILL-SUPPLIER DATA INTEGRITY"
    puts "=" * 80
    puts ""

    fixed_count = 0

    # Fix 1: Link bills using external_contact_id
    puts "1. Linking bills to suppliers..."
    ExternalInvoice.bills.where(contact_id: nil).find_each do |bill|
      if bill.link_to_contact!
        fixed_count += 1
        puts "  ✅ Linked bill ##{bill.id} to supplier"
      end
    end

    # Fix 2: Sync bill document contact_id with bill's contact_id
    puts ""
    puts "2. Syncing bill document contact_id with supplier..."
    CompanyDocument.joins("INNER JOIN external_invoices ON external_invoices.id = company_documents.documentable_id")
                   .where("external_invoices.invoice_type = ?", "bill")
                   .where("company_documents.contact_id IS NULL OR company_documents.contact_id != external_invoices.contact_id")
                   .find_each do |doc|
      bill = doc.documentable
      if bill&.contact_id
        doc.update!(contact_id: bill.contact_id)
        fixed_count += 1
        puts "  ✅ Updated document ##{doc.id} contact_id to match bill's supplier"
      end
    end

    puts ""
    puts "=" * 80
    puts "Fixed #{fixed_count} issues"
    puts ""
    puts "Run 'rails xero_bills:verify' to check for remaining issues."
  end
end
