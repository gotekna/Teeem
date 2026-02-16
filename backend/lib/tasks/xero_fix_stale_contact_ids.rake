namespace :xero do
  desc "Fix stale Xero contact IDs in ExternalInvoice records (preview)"
  task fix_stale_contact_ids: :environment do
    dry_run = !ENV["EXECUTE"].present?

    puts "=" * 70
    puts "FIX STALE XERO CONTACT IDs IN INVOICES"
    puts dry_run ? "(DRY RUN - set EXECUTE=1 to apply)" : "(LIVE MODE)"
    puts "=" * 70
    puts

    # Find invoice records grouped by xero_org_id + contact_name
    # where the same name has multiple different external_contact_ids
    groups = ExternalInvoice
      .where.not(contact_name: [nil, "", "No Contact"])
      .where.not(external_contact_id: nil)
      .where.not(xero_org_id: [nil, ""])
      .group(:xero_org_id, :contact_name)
      .having("COUNT(DISTINCT external_contact_id) > 1")
      .pluck(:xero_org_id, :contact_name, Arel.sql("COUNT(DISTINCT external_contact_id)"))

    if groups.empty?
      puts "No stale contact IDs found. All clean!"
      next
    end

    puts "Found #{groups.size} contact names with multiple Xero IDs"
    puts

    total_invoices_fixed = 0
    total_links_cleaned = 0
    total_groups_fixed = 0

    groups.each do |xero_org_id, contact_name, id_count|
      # Get the distinct external_contact_ids for this name + org
      ids_with_counts = ExternalInvoice
        .where(xero_org_id: xero_org_id, contact_name: contact_name)
        .group(:external_contact_id)
        .order(Arel.sql("MAX(invoice_date) DESC NULLS LAST"))
        .pluck(:external_contact_id, Arel.sql("COUNT(*)"), Arel.sql("MAX(invoice_date)"))

      # The winner is the one with the most recent invoice
      winner_id = ids_with_counts.first[0]
      stale_ids = ids_with_counts[1..].map(&:first)

      # Check TEEEM links
      winner_link = ContactExternalLink.find_by(external_contact_id: winner_id)
      stale_links = stale_ids.map { |id| ContactExternalLink.find_by(external_contact_id: id) }.compact

      # Get credential name for display
      cred = XeroCredential.find_by(tenant_id: xero_org_id)
      org_name = cred&.tenant_name || xero_org_id.to_s[0..8]

      puts "#{contact_name} (#{org_name})"
      puts "  Winner: #{winner_id} (#{ids_with_counts.first[1]} invoices, latest: #{ids_with_counts.first[2]})"
      stale_ids.each_with_index do |stale_id, i|
        count = ids_with_counts[i + 1][1]
        latest = ids_with_counts[i + 1][2]
        puts "  Stale:  #{stale_id} (#{count} invoices, latest: #{latest})"
      end

      # Count invoices to fix
      invoices_to_fix = ExternalInvoice.where(
        xero_org_id: xero_org_id,
        contact_name: contact_name,
        external_contact_id: stale_ids
      ).count

      puts "  -> #{invoices_to_fix} invoices to update"

      unless dry_run
        # Update invoices to use winner ID
        ExternalInvoice.where(
          xero_org_id: xero_org_id,
          contact_name: contact_name,
          external_contact_id: stale_ids
        ).update_all(external_contact_id: winner_id)

        # Clean up stale ContactExternalLink records
        # Transfer to winner's TEEEM contact if winner doesn't have a link
        stale_links.each do |stale_link|
          if winner_link.nil? && stale_link.contact_id.present?
            # No winner link yet - reassign this one as the winner
            stale_link.update!(external_contact_id: winner_id)
            winner_link = stale_link
            puts "  -> Reassigned link #{stale_link.id} to winner ID"
          else
            # Winner already has a link - delete this stale one
            stale_link.destroy!
            total_links_cleaned += 1
            puts "  -> Deleted stale link #{stale_link.id}"
          end
        end
      end

      total_invoices_fixed += invoices_to_fix
      total_groups_fixed += 1
      puts
    end

    puts "=" * 70
    puts "SUMMARY"
    puts "-" * 40
    puts "  Groups with stale IDs: #{groups.size}"
    puts "  Invoices #{dry_run ? 'to fix' : 'fixed'}: #{total_invoices_fixed}"
    puts "  Stale links #{dry_run ? 'to clean' : 'cleaned'}: #{total_links_cleaned}"
    puts
    if dry_run
      puts "This was a DRY RUN. To apply changes:"
      puts "  rails xero:fix_stale_contact_ids EXECUTE=1"
    else
      puts "Done! Changes applied."
    end
  end
end
