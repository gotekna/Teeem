namespace :xero do
  desc "Fix unlinked invoices by syncing missing contacts from Xero"
  task fix_unlinked_invoices: :environment do
    puts "Fixing unlinked invoices..."
    puts "="*80

    # Step 1: Link existing contacts to their invoices
    unlinked = ExternalInvoice.where(contact_id: nil)
    fixed_count = 0

    unlinked.each do |inv|
      # Try to find contact by xero_id (legacy field)
      contact = Contact.find_by(xero_id: inv.external_contact_id)

      # Try to find via ContactExternalLink
      unless contact
        link = ContactExternalLink.xero.find_by(external_contact_id: inv.external_contact_id)
        contact = link&.contact
      end

      if contact
        inv.update!(contact_id: contact.id)
        puts "✓ Linked invoice #{inv.invoice_number} to #{contact.display_name}"
        fixed_count += 1
      end
    end

    puts ""
    puts "Fixed #{fixed_count} invoices with existing contacts"

    # Step 2: Sync missing contacts from Xero
    still_unlinked = ExternalInvoice.where(contact_id: nil)
    if still_unlinked.any?
      puts ""
      puts "Syncing #{still_unlinked.count} contacts from Xero..."

      service = XeroContactSyncService.new
      xero_contacts = service.fetch_xero_contacts
      primary_credential = XeroCredential.find_by(is_primary: true)
      tenant_id = primary_credential&.tenant_id

      synced_count = 0
      still_unlinked.group_by(&:external_contact_id).each do |xero_id, invoices|
        xero_contact = xero_contacts.find { |c| c['ContactID'] == xero_id }

        if xero_contact
          puts "Found #{xero_contact['Name']} in Xero, creating in TEEEM..."
          new_contact = service.create_teeem_contact_from_xero(xero_contact, tenant_id)

          invoices.each do |inv|
            inv.update!(contact_id: new_contact.id)
            puts "  ✓ Linked invoice #{inv.invoice_number}"
          end

          synced_count += 1
        else
          puts "  ✗ Contact not found in Xero: #{invoices.first.contact_name} (#{xero_id})"
        end
      end

      puts ""
      puts "Synced #{synced_count} new contacts from Xero"
    end

    puts ""
    puts "="*80
    puts "FINAL RESULT: #{ExternalInvoice.where(contact_id: nil).count} invoices without linked contacts"
    puts "="*80
  end
end
