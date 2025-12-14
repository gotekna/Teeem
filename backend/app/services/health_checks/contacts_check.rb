# frozen_string_literal: true

module HealthChecks
  # Health checks for Contacts
  # Table name: 'contacts'
  #
  # Checks:
  #   - Duplicate contacts by name (warning)
  #   - Duplicate contacts by email (warning)
  #   - Contacts without email or phone (info)
  #   - Person contacts missing first_name (critical)
  #   - Company contacts missing display_name (critical)
  #   - Invalid entity_type (warning)
  #   - Invalid website URL - must be http:// or https:// (warning)
  #
  # Naming Convention Checks:
  #   - Person names in ALL CAPS (warning) - should be Title Case
  #   - Person names in all lowercase (warning) - should be Title Case
  #   - Email used as name (warning) - first/last name should be proper names
  #   - Person missing last name (info) - persons should have both first and last name
  #   - Team contact missing company (warning) - is_team_contact requires primary_company
  #   - Company/Trust missing business name (critical) - must use company_name_or_trust
  #   - Sole trader missing business name (info) - should have company_name_or_trust
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
      contacts = Contact.all
                       .where.not(entity_type: "price_only")
                       .where("(email IS NULL OR email = '') AND (mobile_phone IS NULL OR mobile_phone = '') AND (office_phone IS NULL OR office_phone = '')")
                       .select(:id, :display_name, :entity_type, :is_team_contact, :primary_company_id)

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
      contacts = Contact.all
                       .where(entity_type: "person")
                       .where("first_name IS NULL OR first_name = ''")
                       .select(:id, :display_name, :first_name, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Person Contacts Missing First Name",
        description: "Person contacts must have a first name. Fix by adding a first name or changing entity type to 'company'.",
        severity: :critical,
        items: contacts,
        icon: "user-x",
        action_path: "/contacts/:id"
      )
    end

    # Company contacts missing display_name
    def check_company_missing_display_name
      contacts = Contact.all
                       .where(entity_type: "company")
                       .where("display_name IS NULL OR display_name = ''")
                       .select(:id, :display_name, :first_name, :last_name, :entity_type, :is_team_contact, :primary_company_id)

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
      contacts = Contact.all
                       .where.not(entity_type: valid_types)
                       .select(:id, :display_name, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Contacts with Invalid Entity Type",
        description: "Contacts with entity_type not in: #{Contact::ENTITY_TYPES.join(', ')}.",
        severity: :warning,
        items: contacts,
        icon: "alert-triangle",
        action_path: "/contacts/:id"
      )
    end

    # Contacts with invalid website URLs (not starting with http:// or https://)
    def check_invalid_website
      # Find contacts with website that doesn't start with http:// or https://
      contacts = Contact.all
                       .where.not(website: [ nil, "" ])
                       .where.not("website LIKE 'http://%' OR website LIKE 'https://%'")
                       .select(:id, :display_name, :website, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Contacts with Invalid Website URL",
        description: "Website must start with http:// or https://. Click Fix All to add https:// prefix.",
        severity: :warning,
        items: contacts,
        icon: "globe",
        action_path: "/contacts/:id",
        check_name: "invalid_website",
        auto_fixable: true,
        fix_type: "website_prefix"
      )
    end

    # ============================================
    # NAMING CONVENTION HEALTH CHECKS
    # ============================================

    # Person contacts with names in ALL CAPS (should be Title Case)
    # Excludes single-letter names (initials like "V" or "M" are fine as uppercase)
    def check_all_caps_names
      contacts = Contact.all
                       .where(entity_type: "person")
                       .where("(first_name IS NOT NULL AND LENGTH(first_name) > 1 AND first_name = UPPER(first_name) AND first_name != LOWER(first_name)) OR (last_name IS NOT NULL AND LENGTH(last_name) > 1 AND last_name = UPPER(last_name) AND last_name != LOWER(last_name))")
                       .select(:id, :display_name, :first_name, :last_name, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Person Names in ALL CAPS",
        description: "Person names should be Title Case (e.g., 'John Smith' not 'JOHN SMITH'). Click Fix All to auto-fix.",
        severity: :warning,
        items: contacts,
        icon: "text-cursor",
        action_path: "/contacts/:id",
        check_name: "all_caps_names",
        auto_fixable: true,
        fix_type: "name_casing"
      )
    end

    # Person contacts with names in all lowercase (should be Title Case)
    def check_all_lowercase_names
      # PostgreSQL compatible - check if name equals its lowercase version and contains letters
      contacts = Contact.all
                       .where(entity_type: "person")
                       .where("(first_name IS NOT NULL AND first_name != '' AND first_name = LOWER(first_name) AND first_name ~ '[a-z]') OR (last_name IS NOT NULL AND last_name != '' AND last_name = LOWER(last_name) AND last_name ~ '[a-z]')")
                       .select(:id, :display_name, :first_name, :last_name, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Person Names in lowercase",
        description: "Person names should be Title Case (e.g., 'John Smith' not 'john smith'). Click Fix All to auto-fix.",
        severity: :warning,
        items: contacts,
        icon: "text-cursor-input",
        action_path: "/contacts/:id",
        check_name: "all_lowercase_names",
        auto_fixable: true,
        fix_type: "name_casing"
      )
    end

    # Contacts with email address used as first_name or last_name
    def check_email_as_name
      contacts = Contact.all
                       .where("first_name LIKE '%@%' OR last_name LIKE '%@%'")
                       .select(:id, :display_name, :first_name, :last_name, :email, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Email Used as Name",
        description: "First or last name contains an email address. Fix by using proper names instead.",
        severity: :warning,
        items: contacts,
        icon: "at-sign",
        action_path: "/contacts/:id",
        check_name: "email_as_name"
      )
    end

    # Person contacts missing last_name (should have first + last)
    def check_person_missing_last_name
      contacts = Contact.all
                       .where(entity_type: "person")
                       .where("first_name IS NOT NULL AND first_name != ''")
                       .where("last_name IS NULL OR last_name = ''")
                       .select(:id, :display_name, :first_name, :last_name, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Person Missing Last Name",
        description: "Person contacts should have both first and last name for proper identification.",
        severity: :info,
        items: contacts,
        icon: "user-minus",
        action_path: "/contacts/:id",
        check_name: "person_missing_last_name"
      )
    end

    # Team contacts (is_team_contact=true) without a linked primary_company
    def check_team_contact_missing_company
      contacts = Contact.all
                       .where(is_team_contact: true)
                       .where(primary_company_id: nil)
                       .select(:id, :display_name, :first_name, :last_name, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Team Contact Missing Company",
        description: "Team contacts (is_team_contact=true) must have a primary company linked. Fix by setting the primary_company field.",
        severity: :warning,
        items: contacts,
        icon: "building-2",
        action_path: "/contacts/:id",
        check_name: "team_contact_missing_company"
      )
    end

    # Company or Trust contacts missing company_name_or_trust
    def check_company_missing_business_name
      contacts = Contact.all
                       .where(entity_type: [ "company", "trust" ])
                       .where("company_name_or_trust IS NULL OR company_name_or_trust = ''")
                       .select(:id, :display_name, :company_name_or_trust, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Company/Trust Missing Business Name",
        description: "Company and Trust contacts must have company_name_or_trust filled in. This is the primary identifier.",
        severity: :critical,
        items: contacts,
        icon: "building-x",
        action_path: "/contacts/:id",
        check_name: "company_missing_business_name"
      )
    end

    # Sole trader contacts missing company_name_or_trust (optional but recommended)
    def check_sole_trader_missing_business_name
      contacts = Contact.all
                       .where(entity_type: "sole_trader")
                       .where("company_name_or_trust IS NULL OR company_name_or_trust = ''")
                       .select(:id, :display_name, :first_name, :last_name, :company_name_or_trust, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Sole Trader Missing Business Name",
        description: "Sole trader contacts should have a trading name in company_name_or_trust for business identification.",
        severity: :info,
        items: contacts,
        icon: "store",
        action_path: "/contacts/:id",
        check_name: "sole_trader_missing_business_name"
      )
    end

    # ============================================
    # DATA FORMATTING CHECKS (Auto-fixable)
    # ============================================

    # Contacts with uppercase email addresses (should be lowercase)
    def check_uppercase_emails
      contacts = Contact.all
                       .where.not(email: [ nil, "" ])
                       .where("email != LOWER(email)")
                       .select(:id, :display_name, :email, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Emails with Uppercase",
        description: "Email addresses should be lowercase. Click Fix All to convert to lowercase.",
        severity: :info,
        items: contacts,
        icon: "at-sign",
        action_path: "/contacts/:id",
        check_name: "uppercase_emails",
        auto_fixable: true,
        fix_type: "email_lowercase"
      )
    end

    # Contacts with unformatted phone numbers
    def check_unformatted_phone
      # Find contacts with phone numbers that aren't properly formatted
      # Properly formatted: 0X XXXX XXXX or +61 X XXXX XXXX
      contacts = Contact.all
                       .where.not(mobile_phone: [ nil, "" ])
                       .where("mobile_phone !~ '^[0-9]{2} [0-9]{4} [0-9]{4}$' AND mobile_phone !~ '^\\+61 [0-9] [0-9]{4} [0-9]{4}$'")
                       .select(:id, :display_name, :mobile_phone, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Unformatted Phone Numbers",
        description: "Phone numbers should be formatted as 0X XXXX XXXX or +61 X XXXX XXXX. Click Fix All to format.",
        severity: :info,
        items: contacts,
        icon: "phone",
        action_path: "/contacts/:id",
        check_name: "unformatted_phone",
        auto_fixable: true,
        fix_type: "phone_format"
      )
    end

    # ============================================
    # BUSINESS DATA ENRICHMENT CHECKS
    # ============================================

    # Company/Trust contacts missing website URL
    def check_company_missing_website
      contacts = Contact.all
                       .where(entity_type: [ "company", "trust" ])
                       .where("website IS NULL OR website = ''")
                       .select(:id, :display_name, :company_name_or_trust, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Company Missing Website",
        description: "Company and Trust contacts should have a website URL for easy lookup and verification.",
        severity: :info,
        items: contacts,
        icon: "globe",
        action_path: "/contacts/:id",
        check_name: "company_missing_website"
      )
    end

    # Company/Trust contacts missing ABN/Tax Number
    def check_company_missing_abn
      contacts = Contact.all
                       .where(entity_type: [ "company", "trust", "sole_trader" ])
                       .where("tax_number IS NULL OR tax_number = ''")
                       .select(:id, :display_name, :company_name_or_trust, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Company Missing ABN",
        description: "Australian business contacts should have an ABN for tax compliance and verification.",
        severity: :info,
        items: contacts,
        icon: "file-text",
        action_path: "/contacts/:id",
        check_name: "company_missing_abn"
      )
    end

    # Company/Trust/Price_only contacts with person name fields that should be cleared
    def check_non_person_with_person_fields
      contacts = Contact.all
                       .where(entity_type: [ "company", "trust", "price_only" ])
                       .where("first_name IS NOT NULL AND first_name != '' OR middle_name IS NOT NULL AND middle_name != '' OR last_name IS NOT NULL AND last_name != ''")
                       .select(:id, :display_name, :first_name, :middle_name, :last_name, :entity_type, :is_team_contact, :primary_company_id)

      build_result(
        name: "Non-Person with Person Fields",
        description: "Company, Trust, and Price Only contacts should not have first_name, middle_name, or last_name. These fields are for persons only.",
        severity: :warning,
        items: contacts,
        icon: "user-x",
        action_path: "/contacts/:id",
        check_name: "non_person_with_person_fields"
      )
    end

    # Orphaned relationships - relationships pointing to deleted or non-existent contacts
    def check_orphaned_relationships
      # Find relationships where the related contact doesn't exist
      all_contact_ids = Contact.unscoped.pluck(:id)
      orphaned = ContactRelationship
                   .where.not(related_contact_id: all_contact_ids)
                   .or(ContactRelationship.where.not(source_contact_id: all_contact_ids))
                   .includes(:source_contact)
                   .limit(50)

      items = orphaned.map do |rel|
        source_name = rel.source_contact&.display_name || "Contact ##{rel.source_contact_id} (deleted)"
        {
          id: rel.id,
          display: "#{source_name} -> #{rel.relationship_type} -> Contact ##{rel.related_contact_id} (missing)",
          relationship_id: rel.id,
          source_contact_id: rel.source_contact_id,
          related_contact_id: rel.related_contact_id,
          relationship_type: rel.relationship_type
        }
      end

      build_result(
        name: "Orphaned Relationships",
        description: "Contact relationships pointing to deleted or non-existent contacts. These should be cleaned up to prevent errors.",
        severity: :critical,
        items: items,
        icon: "link-off",
        action_path: nil,
        check_name: "orphaned_relationships"
      )
    end

    # ============================================
    # DATA INTEGRITY CHECKS
    # ============================================

    # Self-referencing contacts (primary_company_id = id)
    def check_self_referencing_contacts
      contacts = Contact.all
                       .where("primary_company_id = id")
                       .select(:id, :display_name, :entity_type, :primary_company_id)

      build_result(
        name: "Self-Referencing Contacts",
        description: "Contacts where primary_company_id points to themselves. This is invalid data that should be cleared.",
        severity: :critical,
        items: contacts,
        icon: "refresh-ccw",
        action_path: "/contacts/:id",
        check_name: "self_referencing_contacts"
      )
    end

    # Primary company pointing to non-company entity type
    def check_invalid_primary_company_type
      contacts = Contact.all
                       .joins("JOIN contacts pc ON contacts.primary_company_id = pc.id")
                       .where("pc.entity_type NOT IN ('company', 'trust', 'sole_trader')")
                       .select("contacts.id, contacts.display_name, contacts.entity_type, contacts.primary_company_id")

      build_result(
        name: "Invalid Primary Company Type",
        description: "Contacts with primary_company pointing to a person instead of company/trust. Primary company should be a business entity.",
        severity: :critical,
        items: contacts,
        icon: "building-x",
        action_path: "/contacts/:id",
        check_name: "invalid_primary_company_type"
      )
    end

    # Duplicate Xero IDs
    def check_duplicate_xero_ids
      # Find xero_ids that appear more than once
      duplicate_xero_ids = Contact.all
                                 .where.not(xero_id: [ nil, "" ])
                                 .group(:xero_id)
                                 .having("COUNT(*) > 1")
                                 .pluck(:xero_id)

      items = duplicate_xero_ids.map do |xero_id|
        # Load all columns - display_name method needs is_team_contact, entity_type, etc.
        contacts = Contact.where(xero_id: xero_id).includes(:primary_company)
        {
          id: contacts.first.id,
          display: "Xero ID #{xero_id[0..7]}... shared by: #{contacts.map(&:display_name).join(', ')}",
          xero_id: xero_id,
          contact_ids: contacts.map(&:id),
          contact_names: contacts.map(&:display_name)
        }
      end

      build_result(
        name: "Duplicate Xero IDs",
        description: "Multiple contacts sharing the same Xero ID. These should be merged to prevent sync issues.",
        severity: :critical,
        items: items,
        icon: "copy",
        action_path: "/contacts/:id",
        check_name: "duplicate_xero_ids"
      )
    end

    # Team contacts without primary company (validation violation)
    def check_team_contacts_without_company
      contacts = Contact.all
                       .where(is_team_contact: true)
                       .where(primary_company_id: nil)
                       .select(:id, :display_name, :entity_type, :email, :is_team_contact)

      build_result(
        name: "Team Contacts Without Company",
        description: "Contacts marked as team contacts (is_team_contact=true) but missing primary_company. Team contacts must be linked to a company.",
        severity: :warning,
        items: contacts,
        icon: "users-x",
        action_path: "/contacts/:id",
        check_name: "team_contacts_without_company"
      )
    end

    # Relationship type violations (wrong entity types)
    def check_relationship_type_violations
      # Check employee_of relationships where target is not company/trust/sole_trader
      bad_relationships = ContactRelationship
                           .joins("JOIN contacts c ON contact_relationships.related_contact_id = c.id")
                           .where(relationship_type: "employee_of")
                           .where("c.entity_type NOT IN ('company', 'trust', 'sole_trader')")
                           .includes(:source_contact, :related_contact)
                           .limit(50)

      items = bad_relationships.map do |rel|
        {
          id: rel.id,
          display: "#{rel.source_contact&.display_name} → employee_of → #{rel.related_contact&.display_name} (#{rel.related_contact&.entity_type})",
          relationship_id: rel.id,
          source_contact_id: rel.source_contact_id,
          related_contact_id: rel.related_contact_id
        }
      end

      build_result(
        name: "Invalid Relationship Types",
        description: "Relationships where the entity types don't match the relationship rules. employee_of must point to company/trust/sole_trader.",
        severity: :critical,
        items: items,
        icon: "link-off",
        action_path: nil,
        check_name: "relationship_type_violations"
      )
    end

    # === DATA QUALITY CHECKS ===
    # These checks identify contacts that may be misclassified or need company links

    # Person contacts with business email prefixes (admin@, info@, sales@, etc.)
    def check_person_business_email
      business_prefixes = %w[admin info sales accounts office reception support contact enquiries billing finance hr operations]
      personal_domains = %w[gmail.com yahoo.com hotmail.com outlook.com icloud.com live.com bigpond.com optusnet.com.au]

      # Build SQL conditions for business prefixes
      prefix_conditions = business_prefixes.map { |p| "email ILIKE '#{p}@%'" }.join(" OR ")
      domain_exclusions = personal_domains.map { |d| "'#{d}'" }.join(", ")

      contacts = Contact.where(entity_type: "person")
                        .where("email IS NOT NULL AND email != ''")
                        .where("(#{prefix_conditions})")
                        .where("NOT (LOWER(SPLIT_PART(email, '@', 2)) IN (#{domain_exclusions}))")
                        .select(:id, :display_name, :email, :entity_type, :primary_company_id)
                        .limit(50)

      build_result(
        name: "Persons with Business Email Addresses",
        description: "Person contacts using business email prefixes (admin@, info@, sales@) - may be employees or should be companies.",
        severity: :warning,
        items: contacts,
        icon: "user-search",
        action_path: "/contacts/quality-review?filter=admin_email_pattern",
        check_name: "person_business_email"
      )
    end

    # Person contacts linked to multiple Xero tenants - unusual for individuals
    def check_person_multiple_xero_tenants
      contacts = Contact.where(entity_type: "person")
                        .joins(:external_links)
                        .where(contact_external_links: { source: "xero" })
                        .group("contacts.id")
                        .having("COUNT(DISTINCT contact_external_links.tenant_id) > 1")
                        .select("contacts.id, contacts.display_name, contacts.email, contacts.entity_type, COUNT(DISTINCT contact_external_links.tenant_id) as xero_tenant_count")
                        .limit(50)

      items = contacts.map do |c|
        {
          id: c.id,
          display: "#{c.display_name} - #{c.xero_tenant_count} Xero tenants",
          display_name: c.display_name,
          email: c.email,
          entity_type: c.entity_type,
          xero_tenant_count: c.xero_tenant_count
        }
      end

      build_result(
        name: "Persons with Multiple Xero Tenants",
        description: "Person contacts linked to multiple Xero companies - may be employees or key contacts that should be linked to companies.",
        severity: :info,
        items: items,
        icon: "users",
        action_path: "/contacts/quality-review?filter=multiple_xero_links",
        check_name: "person_multiple_xero_tenants"
      )
    end

    # Company contacts without typical company attributes (no ABN, person-like name)
    def check_company_person_like
      # Company without ABN AND has first/last name AND name doesn't have company indicators
      contacts = Contact.where(entity_type: "company")
                        .where("(tax_number IS NULL OR tax_number = '')")
                        .where("first_name IS NOT NULL AND first_name != ''")
                        .where("last_name IS NOT NULL AND last_name != ''")
                        .where("LOWER(COALESCE(company_name_or_trust, display_name)) NOT SIMILAR TO '%(pty|ltd|limited|holdings|group|trust|inc|corp|services|consulting)%'")
                        .select(:id, :display_name, :first_name, :last_name, :company_name_or_trust, :entity_type, :tax_number)
                        .limit(50)

      build_result(
        name: "Companies with Person-like Attributes",
        description: "Company contacts that have first/last name fields set, no ABN, and no typical company name indicators - may actually be persons.",
        severity: :warning,
        items: contacts,
        icon: "building-user",
        action_path: "/contacts/quality-review?filter=misclassified_company",
        check_name: "company_person_like"
      )
    end

    # ABN entity type mismatch - ABR shows different entity type than TEEEM
    def check_abn_entity_type_mismatch
      # Contacts where ABN has been verified and entity type doesn't match
      person_as_company = Contact.where(entity_type: "person")
                                 .where(abn_valid: true)
                                 .where("abn_entity_type IS NOT NULL")
                                 .where("LOWER(abn_entity_type) SIMILAR TO '%(company|trust|partnership)%'")
                                 .select(:id, :display_name, :entity_type, :abn_entity_type, :tax_number)

      company_as_person = Contact.where(entity_type: %w[company trust])
                                 .where(abn_valid: true)
                                 .where("abn_entity_type IS NOT NULL")
                                 .where("LOWER(abn_entity_type) SIMILAR TO '%(individual|sole trader)%'")
                                 .select(:id, :display_name, :entity_type, :abn_entity_type, :tax_number)

      all_mismatches = (person_as_company + company_as_person).first(50)

      items = all_mismatches.map do |c|
        {
          id: c.id,
          display: "#{c.display_name} - TEEEM: #{c.entity_type}, ABR: #{c.abn_entity_type}",
          display_name: c.display_name,
          entity_type: c.entity_type,
          abn_entity_type: c.abn_entity_type,
          tax_number: c.tax_number
        }
      end

      build_result(
        name: "ABN Entity Type Mismatch",
        description: "Contacts where the ABR entity type doesn't match TEEEM entity type - needs correction.",
        severity: :critical,
        items: items,
        icon: "file-warning",
        action_path: "/contacts/quality-review?filter=abn_mismatch",
        check_name: "abn_entity_type_mismatch"
      )
    end

    # Pending quality reviews that need action
    def check_pending_quality_reviews
      reviews = ContactQualityReview.pending
                                    .includes(:contact)
                                    .order(confidence_score: :desc)
                                    .limit(50)

      items = reviews.map do |r|
        {
          id: r.contact_id,
          display: "#{r.contact.display_name} - #{r.issue_type_label} (#{r.confidence_score}% confidence)",
          display_name: r.contact.display_name,
          issue_type: r.issue_type,
          recommended_action: r.recommended_action,
          confidence_score: r.confidence_score,
          review_id: r.id
        }
      end

      build_result(
        name: "Pending Quality Reviews",
        description: "Contact quality issues detected by automated scan that need human review.",
        severity: :info,
        items: items,
        icon: "clipboard-check",
        action_path: "/contacts/quality-review",
        check_name: "pending_quality_reviews"
      )
    end

    protected

    def format_items(items)
      items.map do |item|
        if item.is_a?(Hash)
          item
        elsif item.respond_to?(:display_name)
          display_parts = []
          display_parts << (item.display_name.presence || "Contact ##{item.id}")
          display_parts << "(#{item.entity_type})" if item.try(:entity_type).present?
          # Show invalid website in display if present
          display_parts << "- website: #{item.website}" if item.try(:website).present?

          {
            id: item.id,
            display: display_parts.join(" "),
            display_name: item.display_name,
            first_name: item.try(:first_name),
            last_name: item.try(:last_name),
            entity_type: item.try(:entity_type),
            email: item.try(:email),
            website: item.try(:website)
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
      # Note: Use SQL subqueries for counts instead of loading associations (performance optimization)
      contacts = Contact.all
                       .select(
                         :id, :display_name, :first_name, :middle_name, :last_name,
                         :email, :mobile_phone, :office_phone, :xero_id,
                         :entity_type, :is_team_contact, :primary_company_id,
                         # Use SQL to count without loading associations (prevents timeout on 1400+ contacts)
                         "(SELECT COUNT(*) FROM job_contacts WHERE job_contacts.contact_id = contacts.id) AS jobs_count",
                         "(SELECT COUNT(*) FROM purchase_orders WHERE purchase_orders.supplier_id = contacts.id) AS purchase_orders_count"
                       )

      case type
      when :name
        # Group by normalized full name
        by_name = contacts.group_by { |c| normalize_name(c.display_name) }
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
        display: "#{contacts.size} contacts: #{contacts.map { |c| c.display_name }.compact.join(', ')}",
        match_type: match_type,
        match_value: match_value,
        count: contacts.size,
        contacts: contacts.map do |c|
          {
            id: c.id,
            # Modal expects 'name' field for display
            name: c.display_name,
            display_name: c.display_name,
            email: c.email,
            # Modal expects 'phone' field
            phone: c.mobile_phone || c.office_phone,
            mobile_phone: c.mobile_phone,
            entity_type: c.entity_type,
            # Modal expects 'xero_contact_id' for Xero badge
            xero_contact_id: c.xero_id,
            xero_id: c.xero_id,
            # Modal needs these counts for merge preview (loaded via SQL subquery for performance)
            jobs_count: c.try(:jobs_count) || 0,
            purchase_orders_count: c.try(:purchase_orders_count) || 0,
            # completeness_score is calculated - would need to load full record
            completeness_score: 0
          }
        end
      }
    end
  end
end
