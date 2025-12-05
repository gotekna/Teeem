# frozen_string_literal: true

module HealthChecks
  # Health checks for Contacts
  # Table name: 'contacts'
  #
  # Checks:
  #   - Duplicate contacts by name (warning)
  #   - Duplicate contacts by email (warning)
  #   - Contacts without email or phone (info)
  #
  class ContactsCheck < BaseCheck
    def self.check_type
      'contacts'
    end

    def self.table_name
      'contacts'
    end

    # Find contacts that appear to be duplicates based on name
    def check_duplicate_names
      duplicates = find_duplicate_groups(:name)

      build_result(
        name: 'Possible Duplicate Contacts',
        description: 'Contacts with identical or very similar names that may need to be merged.',
        severity: :warning,
        items: duplicates,
        icon: 'users',
        action_path: '/contacts/:id'
      )
    end

    # Find contacts with duplicate emails
    def check_duplicate_emails
      duplicates = find_duplicate_groups(:email)

      build_result(
        name: 'Duplicate Email Addresses',
        description: 'Multiple contacts sharing the same email address.',
        severity: :warning,
        items: duplicates,
        icon: 'envelope',
        action_path: '/contacts/:id'
      )
    end

    # Contacts missing both email and phone
    def check_missing_contact_info
      contacts = Contact.where(deleted: [false, nil])
                       .where("(email IS NULL OR email = '') AND (mobile_phone IS NULL OR mobile_phone = '') AND (office_phone IS NULL OR office_phone = '')")
                       .select(:id, :full_name)

      build_result(
        name: 'Contacts Missing Contact Info',
        description: 'Contacts without email or phone number - difficult to reach.',
        severity: :info,
        items: contacts,
        icon: 'phone-x-mark',
        action_path: '/contacts/:id'
      )
    end

    protected

    def format_items(items)
      items.map do |item|
        if item.is_a?(Hash)
          item
        elsif item.respond_to?(:full_name)
          {
            id: item.id,
            display: item.full_name.presence || "Contact ##{item.id}",
            full_name: item.full_name,
            email: item.try(:email)
          }
        else
          super
        end
      end
    end

    private

    def find_duplicate_groups(type)
      groups = []
      seen_ids = Set.new

      contacts = Contact.where(deleted: [false, nil])
                       .select(:id, :full_name, :first_name, :last_name, :email, :mobile_phone, :office_phone, :xero_id)

      case type
      when :name
        # Group by normalized full name
        by_name = contacts.group_by { |c| normalize_name(c.full_name) }
        by_name.each do |normalized, group|
          next if normalized.blank? || group.size < 2
          next if group.all? { |c| seen_ids.include?(c.id) }

          groups << format_duplicate_group('name', normalized, group)
          group.each { |c| seen_ids << c.id }
        end

      when :email
        # Group by email (case-insensitive)
        by_email = contacts.reject { |c| c.email.blank? }
                          .group_by { |c| c.email.to_s.downcase.strip }
        by_email.each do |email, group|
          next if email.blank? || group.size < 2
          next if group.all? { |c| seen_ids.include?(c.id) }

          groups << format_duplicate_group('email', email, group)
          group.each { |c| seen_ids << c.id }
        end
      end

      groups.first(10)
    end

    def normalize_name(name)
      return nil if name.blank?
      name.to_s.downcase.gsub(/\s+/, ' ').strip
    end

    def format_duplicate_group(match_type, match_value, contacts)
      {
        id: contacts.first.id,
        display: "#{contacts.size} contacts: #{contacts.map { |c| c.full_name }.compact.join(', ')}",
        match_type: match_type,
        match_value: match_value,
        count: contacts.size,
        contacts: contacts.map do |c|
          {
            id: c.id,
            full_name: c.full_name,
            email: c.email,
            mobile_phone: c.mobile_phone,
            has_xero: c.xero_id.present?
          }
        end
      }
    end
  end
end
