namespace :purchase_orders do
  desc "Auto-create purchase orders for existing bills that have job and supplier but no PO"
  task backfill_from_bills: :environment do
    puts "=" * 80
    puts "AUTO-CREATE PURCHASE ORDERS FROM EXISTING BILLS"
    puts "=" * 80
    puts ""

    # Find all bills (ACCPAY) that have both job and supplier
    bills_with_job_and_supplier = ExternalInvoice
      .where(invoice_type: "bill")
      .where.not(job_id: nil)
      .where.not(contact_id: nil)

    total_bills = bills_with_job_and_supplier.count
    puts "Found #{total_bills} bills with job and supplier"
    puts ""

    # Check which ones already have POs
    bills_with_existing_po = bills_with_job_and_supplier.select do |bill|
      PurchaseOrder.exists?(xero_invoice_id: bill.external_id)
    end

    puts "Already have POs: #{bills_with_existing_po.count}"
    puts "Need POs: #{total_bills - bills_with_existing_po.count}"
    puts ""

    # Ask for confirmation
    print "Create purchase orders for #{total_bills - bills_with_existing_po.count} bills? (y/n): "
    confirmation = STDIN.gets.chomp.downcase

    unless confirmation == "y" || confirmation == "yes"
      puts "Cancelled."
      exit
    end

    puts ""
    puts "Creating purchase orders..."
    puts ""

    created_count = 0
    skipped_count = 0
    error_count = 0
    errors = []

    bills_with_job_and_supplier.each do |bill|
      # Skip if PO already exists
      if PurchaseOrder.exists?(xero_invoice_id: bill.external_id)
        skipped_count += 1
        next
      end

      begin
        # Create purchase order
        po = PurchaseOrder.create!(
          job_id: bill.job_id,
          supplier_id: bill.contact_id,
          status: "invoiced", # Bill already exists, so mark as invoiced
          xero_invoice_id: bill.external_id,
          invoiced_amount: bill.total,
          invoice_date: bill.invoice_date,
          invoice_reference: bill.invoice_number,
          description: "Auto-generated from Xero bill #{bill.invoice_number}",
          ordered_date: bill.invoice_date, # Use invoice date as order date
          payment_status: bill.status == "paid" ? "complete" : "pending",
          # Set totals directly since we have no line items
          total: bill.total || 0,
          sub_total: bill.subtotal || 0,
          tax: bill.total_tax || 0
        )

        created_count += 1
        puts "✓ Created #{po.purchase_order_number} for bill #{bill.invoice_number} (Job: #{bill.job&.title}, Supplier: #{bill.contact&.display_name}, Total: $#{bill.total})"

      rescue StandardError => e
        error_count += 1
        error_msg = "✗ Failed for bill #{bill.invoice_number}: #{e.message}"
        puts error_msg
        errors << error_msg
      end
    end

    puts ""
    puts "=" * 80
    puts "SUMMARY"
    puts "=" * 80
    puts "Total bills checked: #{total_bills}"
    puts "Already had POs: #{bills_with_existing_po.count}"
    puts "Skipped (already had PO): #{skipped_count}"
    puts "Successfully created: #{created_count}"
    puts "Errors: #{error_count}"
    puts ""

    if errors.any?
      puts "ERRORS:"
      errors.each { |err| puts "  #{err}" }
      puts ""
    end

    puts "Done!"
    puts "=" * 80
  end

  desc "Report on bills that could have POs auto-created"
  task report_backfill_candidates: :environment do
    puts "=" * 80
    puts "BILLS THAT COULD HAVE POs AUTO-CREATED"
    puts "=" * 80
    puts ""

    # Find all bills (ACCPAY) that have both job and supplier
    bills_with_job_and_supplier = ExternalInvoice
      .where(invoice_type: "bill")
      .where.not(job_id: nil)
      .where.not(contact_id: nil)

    total_bills = bills_with_job_and_supplier.count
    puts "Total bills with job and supplier: #{total_bills}"
    puts ""

    # Check which ones already have POs
    bills_without_po = bills_with_job_and_supplier.reject do |bill|
      PurchaseOrder.exists?(xero_invoice_id: bill.external_id)
    end

    bills_with_po = total_bills - bills_without_po.count

    puts "Bills with existing PO: #{bills_with_po} (#{(bills_with_po.to_f / total_bills * 100).round(1)}%)"
    puts "Bills WITHOUT PO: #{bills_without_po.count} (#{(bills_without_po.count.to_f / total_bills * 100).round(1)}%)"
    puts ""

    if bills_without_po.any?
      puts "BREAKDOWN BY SUPPLIER (Bills without PO):"
      puts "-" * 80

      by_supplier = bills_without_po.group_by(&:contact_id)
      sorted_suppliers = by_supplier.sort_by { |_, bills| -bills.count }

      sorted_suppliers.first(20).each do |contact_id, bills|
        contact = Contact.find_by(id: contact_id)
        total_amount = bills.sum(&:total)
        puts "#{contact&.display_name || 'Unknown'}: #{bills.count} bills ($#{total_amount.round(2)})"
      end

      if sorted_suppliers.count > 20
        puts "... and #{sorted_suppliers.count - 20} more suppliers"
      end

      puts ""
      puts "SAMPLE BILLS WITHOUT PO (first 10):"
      puts "-" * 80
      bills_without_po.first(10).each do |bill|
        puts "Bill: #{bill.invoice_number} | Job: #{bill.job&.title} | Supplier: #{bill.contact&.display_name} | Total: $#{bill.total} | Date: #{bill.invoice_date}"
      end
    end

    puts ""
    puts "To create POs for these bills, run:"
    puts "  rails purchase_orders:backfill_from_bills"
    puts ""
    puts "=" * 80
  end
end
