class MigrateContactEmailsAndPhones < ActiveRecord::Migration[8.0]
  def up
    # Migrate email addresses from contacts.email to contact_emails table
    Contact.find_each do |contact|
      next if contact.email.blank?

      # Only create if it doesn't already exist
      unless ContactEmail.exists?(contact_id: contact.id, email: contact.email)
        ContactEmail.create!(
          contact_id: contact.id,
          email: contact.email,
          is_primary: true,
          label: 'Primary',
          position: 0
        )
        Rails.logger.info "Migrated email for contact #{contact.id}: #{contact.email}"
      end
    end

    # Migrate mobile phones from contacts.mobile_phone to contact_phones table
    Contact.find_each do |contact|
      next if contact.mobile_phone.blank?

      # Only create if it doesn't already exist
      unless ContactPhone.exists?(contact_id: contact.id, phone_number: contact.mobile_phone, phone_type: 'mobile')
        ContactPhone.create!(
          contact_id: contact.id,
          phone_number: contact.mobile_phone,
          phone_type: 'mobile',
          is_primary: true,
          label: 'Mobile',
          position: 0
        )
        Rails.logger.info "Migrated mobile phone for contact #{contact.id}: #{contact.mobile_phone}"
      end
    end

    # Migrate office phones from contacts.office_phone to contact_phones table
    Contact.find_each do |contact|
      next if contact.office_phone.blank?

      # Only create if it doesn't already exist
      unless ContactPhone.exists?(contact_id: contact.id, phone_number: contact.office_phone, phone_type: 'office')
        # If mobile exists, office should not be primary
        has_mobile = ContactPhone.exists?(contact_id: contact.id, phone_type: 'mobile')

        ContactPhone.create!(
          contact_id: contact.id,
          phone_number: contact.office_phone,
          phone_type: 'office',
          is_primary: !has_mobile,
          label: 'Office',
          position: has_mobile ? 1 : 0
        )
        Rails.logger.info "Migrated office phone for contact #{contact.id}: #{contact.office_phone}"
      end
    end

    # Migrate fax phones from contacts.fax_phone to contact_phones table (if column exists)
    if Contact.column_names.include?('fax_phone')
      Contact.find_each do |contact|
        next if contact.fax_phone.blank?

        # Only create if it doesn't already exist
        unless ContactPhone.exists?(contact_id: contact.id, phone_number: contact.fax_phone, phone_type: 'fax')
          ContactPhone.create!(
            contact_id: contact.id,
            phone_number: contact.fax_phone,
            phone_type: 'fax',
            is_primary: false,
            label: 'Fax',
            position: 2
          )
          Rails.logger.info "Migrated fax phone for contact #{contact.id}: #{contact.fax_phone}"
        end
      end
    end
  end

  def down
    # Remove all migrated records (careful - only remove if they match old column data)
    Contact.find_each do |contact|
      if contact.email.present?
        ContactEmail.where(contact_id: contact.id, email: contact.email).destroy_all
      end

      if contact.mobile_phone.present?
        ContactPhone.where(contact_id: contact.id, phone_number: contact.mobile_phone, phone_type: 'mobile').destroy_all
      end

      if contact.office_phone.present?
        ContactPhone.where(contact_id: contact.id, phone_number: contact.office_phone, phone_type: 'office').destroy_all
      end

      if Contact.column_names.include?('fax_phone') && contact.fax_phone.present?
        ContactPhone.where(contact_id: contact.id, phone_number: contact.fax_phone, phone_type: 'fax').destroy_all
      end
    end
  end
end
