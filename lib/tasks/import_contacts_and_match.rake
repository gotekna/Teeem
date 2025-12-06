namespace :suppliers do
  desc "Import contacts from CSV and run supplier matching"
  task import_and_match: :environment do
    require "csv"

    puts "=" * 80
    puts "SUPPLIER-CONTACT MATCHING SYSTEM"
    puts "=" * 80
    puts ""

    # Step 1: Import contacts
    puts "Step 1: Importing contacts from CSV..."
    contacts_file = Rails.root.join("..", "easybuildapp development Contacts.csv")

    unless File.exist?(contacts_file)
      puts "ERROR: Contacts CSV file not found at #{contacts_file}"
      puts "Please upload the CSV file to the backend directory"
      exit 1
    end

    imported_count = 0
    skipped_count = 0

    CSV.foreach(contacts_file, headers: true) do |row|
      # Skip if no meaningful data
      next if row["full_name"].blank? && row["first_name"].blank? && row["email"].blank?

      # Check if contact already exists
      existing = Contact.find_by(
        full_name: row["full_name"],
        email: row["email"]
      )

      if existing
        skipped_count += 1
        next
      end

      Contact.create!(
        sys_type_id: row["sys_type_id"],
        deleted: row["deleted"] == "true",
        parent_id: row["parent_id"],
        parent: row["parent"],
        drive_id: row["drive_id"],
        folder_id: row["folder_id"],
        tax_number: row["tax_number"],
        xero_id: row["xero_id"],
        email: row["email"],
        office_phone: row["office_phone"],
        mobile_phone: row["mobile_phone"],
        website: row["website"],
        first_name: row["first_name"],
        last_name: row["last_name"],
        full_name: row["full_name"],
        sync_with_xero: row["sync_with_xero"] == "true",
        contact_region_id: row["contact_region_id"],
        contact_region: row["contact_region"],
        branch: row["branch"] == "true"
      )

      imported_count += 1
    end

    puts "✓ Imported #{imported_count} contacts (skipped #{skipped_count} duplicates)"
    puts ""

    # Step 2: Create suppliers from price book if needed
    puts "Step 2: Ensuring all price book suppliers exist..."
    pricebook_file = Rails.root.join("..", "pricebook_cleaned.csv")

    if File.exist?(pricebook_file)
      created_suppliers = 0

      CSV.foreach(pricebook_file, headers: true) do |row|
        supplier_name = row["supplier_name"]&.strip
        next if supplier_name.blank?

        # Find or create supplier
        supplier = Supplier.find_or_initialize_by(name: supplier_name)
        if supplier.new_record?
          supplier.original_name = supplier_name
          supplier.save!
          created_suppliers += 1
        end
      end

      puts "✓ Created #{created_suppliers} new suppliers from price book"
    else
      puts "⚠ Price book CSV not found, skipping supplier creation"
    end
    puts ""

    # Step 3: Run auto-matching
    puts "Step 3: Running automatic supplier-contact matching..."
    puts ""

    matcher = SupplierMatcher.new
    unmatched_suppliers = Supplier.unmatched

    puts "Total suppliers to match: #{unmatched_suppliers.count}"
    puts ""

    # Run matching with different thresholds
    puts "Running high-confidence matching (threshold: 0.95)..."
    high_confidence = matcher.auto_apply_matches(threshold: 0.95, verify_exact: true)
    puts "✓ Matched #{high_confidence} suppliers with high confidence"
    puts ""

    puts "Running fuzzy matching (threshold: 0.7)..."
    fuzzy_matches = matcher.auto_apply_matches(threshold: 0.7, verify_exact: false)
    puts "✓ Matched #{fuzzy_matches} suppliers with fuzzy confidence"
    puts ""

    # Step 4: Show results
    puts "=" * 80
    puts "MATCHING RESULTS"
    puts "=" * 80
    puts ""

    total_suppliers = Supplier.count
    matched = Supplier.matched.count
    verified = Supplier.verified.count
    needs_review = Supplier.needs_review.count
    unmatched = Supplier.unmatched.count

    puts "Total Suppliers: #{total_suppliers}"
    puts "  ✓ Matched & Verified: #{verified}"
    puts "  ? Needs Review: #{needs_review}"
    puts "  ✗ Unmatched: #{unmatched}"
    puts ""

    match_rate = (matched.to_f / total_suppliers * 100).round(1)
    puts "Match Rate: #{match_rate}%"
    puts ""

    # Show some examples
    if needs_review > 0
      puts "Examples needing review:"
      Supplier.needs_review.limit(5).each do |supplier|
        puts "  - #{supplier.name} → #{supplier.contact.full_name} (#{supplier.match_confidence_label})"
      end
      puts ""
    end

    if unmatched > 0
      puts "Examples of unmatched suppliers:"
      Supplier.unmatched.limit(5).each do |supplier|
        puts "  - #{supplier.name}"
      end
      puts ""
    end

    puts "=" * 80
    puts "✓ Import and matching complete!"
    puts "=" * 80
    puts ""
    puts "Next steps:"
    puts "1. Review fuzzy matches at /suppliers?match_status=needs_review"
    puts "2. Manually link unmatched suppliers at /suppliers?match_status=unmatched"
    puts "3. Verify the matching worked as expected"
    puts ""
  end

  desc "Show matching statistics"
  task stats: :environment do
    puts "=" * 80
    puts "SUPPLIER-CONTACT MATCHING STATISTICS"
    puts "=" * 80
    puts ""

    total_suppliers = Supplier.count
    total_contacts = Contact.count
    matched = Supplier.matched.count
    verified = Supplier.verified.count
    needs_review = Supplier.needs_review.count
    unmatched = Supplier.unmatched.count

    puts "Contacts: #{total_contacts}"
    puts "Suppliers: #{total_suppliers}"
    puts ""
    puts "Matching Status:"
    puts "  ✓ Verified: #{verified} (#{(verified.to_f / total_suppliers * 100).round(1)}%)"
    puts "  ? Needs Review: #{needs_review} (#{(needs_review.to_f / total_suppliers * 100).round(1)}%)"
    puts "  ✗ Unmatched: #{unmatched} (#{(unmatched.to_f / total_suppliers * 100).round(1)}%)"
    puts ""
    puts "Overall Match Rate: #{((matched.to_f / total_suppliers) * 100).round(1)}%"
    puts ""
  end

  desc "Reset all supplier-contact matches"
  task reset_matches: :environment do
    puts "Resetting all supplier-contact matches..."
    Supplier.update_all(
      contact_id: nil,
      confidence_score: nil,
      match_type: nil,
      is_verified: false
    )
    puts "✓ Reset complete"
  end
end
