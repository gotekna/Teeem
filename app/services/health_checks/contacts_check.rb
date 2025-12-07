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
      "contacts"
    end

    def self.table_name
      "contacts"
    end

    # Find contacts that appear to be duplicates based on name
    def check_duplicate_names
      duplicates = find_duplicate_groups(:name)

      build_result(
        name: "Possible Duplicate Contacts",
        description: "Contacts with identical or very similar names that may need to be merged.",
        severity: :warning,
        items: duplicates,
        icon: "users",
        action_path: "/contacts/:id"
      )
    end

    # Find contacts with duplicate emails
    def check_duplicate_emails
      duplicates = find_duplicate_groups(:email)

      build_result(
        name: "Duplicate Email Addresses",
        description: "Multiple contacts sharing the same email address.",
        severity: :warning,
        items: duplicates,
        icon: "envelope",
        action_path: "/contacts/:id",
        check_name: "duplicate_emails"
      )
    end

    # Contacts missing both email and phone
    def check_missing_contact_info
      # Exclude price_only contacts - they don't need contact info (just pricing references)
      contacts = Contact.where(deleted: [ false, nil ])
                       .where.not(entity_type: "price_only")
                       .where("(email IS NULL OR email = '') AND (mobile_phone IS NULL OR mobile_phone = '') AND (office_phone IS NULL OR office_phone = '')")
                       .select(:id, :full_name, :entity_type)

      build_result(
        name: "Contacts Missing Contact Info",
        description: "Contacts (excluding price_only) without email or phone number - difficult to reach.",
        severity: :info,
        items: contacts,
        icon: "phone-x-mark",
        action_path: "/contacts/:id"
      )
    end

    # Person contacts missing required first_name
    def check_person_missing_first_name
      contacts = Contact.where(deleted: [ false, nil ])
                       .where(entity_type: "person")
                       .where("first_name IS NULL OR first_name = ''")
                       .select(:id, :full_name, :first_name, :entity_type)

      build_result(
        name: "Person Contacts Missing First Name",
        description: "Person contacts must have a first name. Fix by adding a first name or changing entity type to 'company'.",
        severity: :critical,
        items: contacts,
        icon: "user-x",
        action_path: "/contacts/:id"
      )
    end

    # Company contacts missing full_name
    def check_company_missing_full_name
      contacts = Contact.where(deleted: [ false, nil ])
                       .where(entity_type: "company")
                       .where("full_name IS NULL OR full_name = ''")
                       .select(:id, :full_name, :first_name, :last_name, :entity_type)

      build_result(
        name: "Company Contacts Missing Full Name",
        description: "Company contacts must have a full name. Fix by adding a name or changing entity type to 'person'.",
        severity: :critical,
        items: contacts,
        icon: "building-x",
        action_path: "/contacts/:id"
      )
    end

    # Contacts with invalid entity_type
    def check_invalid_entity_type
      # Use Contact::ENTITY_TYPES as SSoT for valid values
      valid_types = Contact::ENTITY_TYPES + [ nil ]
      contacts = Contact.where(deleted: [ false, nil ])
                       .where.not(entity_type: valid_types)
                       .select(:id, :full_name, :entity_type)

      build_result(
        name: "Contacts with Invalid Entity Type",
        description: "Contacts with entity_type not in: #{Contact::ENTITY_TYPES.join(', ')}.",
        severity: :warning,
        items: contacts,
        icon: "alert-triangle",
        action_path: "/contacts/:id"
      )
    end

    protected

    def format_items(items)
      items.map do |item|
        if item.is_a?(Hash)
          item
        elsif item.respond_to?(:full_name)
          display_parts = []
          display_parts << (item.full_name.presence || "Contact ##{item.id}")
          display_parts << "(#{item.entity_type})" if item.try(:entity_type).present?

          {
            id: item.id,
            display: display_parts.join(" "),
            full_name: item.full_name,
            first_name: item.try(:first_name),
            last_name: item.try(:last_name),
            entity_type: item.try(:entity_type),
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

      # Include all fields needed by the merge modal
      # Note: completeness_score is calculated, not a column - don't select it
      contacts = Contact.where(deleted: [ false, nil ])
                       .select(:id, :full_name, :first_name, :last_name, :email, :mobile_phone, :office_phone, :xero_id, :entity_type)
                       .includes(:jobs, :purchase_orders)

      case type
      when :name
        # Group by normalized full name
        by_name = contacts.group_by { |c| normalize_name(c.full_name) }
        by_name.each do |normalized, group|
          next if normalized.blank? || group.size < 2
          next if group.all? { |c| seen_ids.include?(c.id) }

          groups << format_duplicate_group("name", normalized, group)
          group.each { |c| seen_ids << c.id }
        end

      when :email
        # Group by email (case-insensitive)
        by_email = contacts.reject { |c| c.email.blank? }
                          .group_by { |c| c.email.to_s.downcase.strip }
        by_email.each do |email, group|
          next if email.blank? || group.size < 2
          next if group.all? { |c| seen_ids.include?(c.id) }

          groups << format_duplicate_group("email", email, group)
          group.each { |c| seen_ids << c.id }
        end
      end

      groups.first(10)
    end

    def normalize_name(name)
      return nil if name.blank?
      name.to_s.downcase.gsub(/\s+/, " ").strip
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
            # Modal expects 'name' field for display
            name: c.full_name,
            full_name: c.full_name,
            email: c.email,
            # Modal expects 'phone' field
            phone: c.mobile_phone || c.office_phone,
            mobile_phone: c.mobile_phone,
            entity_type: c.entity_type,
            # Modal expects 'xero_contact_id' for Xero badge
            xero_contact_id: c.xero_id,
            xero_id: c.xero_id,
            # Modal needs these counts for merge preview
            jobs_count: c.respond_to?(:jobs) ? c.jobs.size : 0,
            purchase_orders_count: c.respond_to?(:purchase_orders) ? c.purchase_orders.size : 0,
            # completeness_score is calculated - would need to load full record
            completeness_score: 0
          }
        end
      }
    end
  end
end
