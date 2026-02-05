# frozen_string_literal: true

# ContactDataQualityService - Analyzes contacts for entity type issues
#
# Detection Logic (ABN First, Email Backup):
# 1. If contact has ABN, verify via ABR and check entity type
# 2. Extract email domain, derive company name, search for existing company
# 3. Detect patterns: admin/info emails, multiple Xero links, etc.
#
class ContactDataQualityService
  # Common personal email domains to ignore
  COMMON_EMAIL_DOMAINS = %w[
    gmail.com gmail.com.au
    yahoo.com yahoo.com.au yahoo.co.uk
    hotmail.com hotmail.com.au hotmail.co.uk
    outlook.com outlook.com.au
    icloud.com
    live.com live.com.au
    msn.com
    aol.com
    bigpond.com bigpond.com.au bigpond.net.au
    optusnet.com.au
    tpg.com.au
    internode.on.net
    westnet.com.au
    adam.com.au
    me.com
    protonmail.com
    fastmail.com fastmail.fm
  ].freeze

  # Email prefixes that suggest business role, not personal
  BUSINESS_EMAIL_PREFIXES = %w[
    admin
    info
    sales
    accounts
    office
    reception
    support
    contact
    hello
    enquiries
    enquiry
    help
    team
    service
    orders
    billing
    finance
    hr
    operations
  ].freeze

  # ABR entity type codes that indicate individual/person
  INDIVIDUAL_ENTITY_CODES = %w[IND].freeze

  # ABR entity type codes that indicate company/organization
  COMPANY_ENTITY_CODES = %w[PRV PUB OSFA NRF FXT PTR DES SGE STR TRT].freeze

  def initialize(contact)
    @contact = contact
    @abr_service = AbrApiService.new
    @issues = []
    @abr_data = nil
  end

  # Main analysis method - returns comprehensive analysis
  def analyze
    detect_all_issues

    {
      contact_id: @contact.id,
      display_name: @contact.display_name,
      current_entity_type: @contact.entity_type,
      # SSoT: Use primary_email from contact_emails table
      email: @contact.primary_email,
      tax_number: @contact.abn,
      suggested_entity_type: detect_suggested_entity_type,
      confidence: calculate_confidence,
      issues: @issues,
      abr_data: @abr_data,
      domain_analysis: analyze_email_domain,
      existing_company_match: find_existing_company_match,
      recommended_action: determine_recommended_action
    }
  end

  # Quick check if contact needs review
  def needs_review?
    detect_all_issues
    @issues.any?
  end

  private

  def detect_all_issues
    @issues = []

    # Check ABN-related issues first (most authoritative)
    check_abn_entity_mismatch

    # Check email domain patterns
    check_business_email_prefix
    check_email_domain_company_match

    # Check Xero link patterns
    check_multiple_xero_links

    # Check for company without proper attributes
    check_company_without_business_attributes

    @issues
  end

  # If contact has ABN and ABR entity type doesn't match TEEEM entity type
  def check_abn_entity_mismatch
    return unless @contact.abn.present?

    # Lookup ABN via ABR API
    begin
      @abr_data = @abr_service.lookup(@contact.abn)
    rescue AbrApiService::AbrError => e
      Rails.logger.warn "ABN lookup failed for contact #{@contact.id}: #{e.message}"
      return
    end

    abr_entity_type = @abr_data[:entity_type_description]&.downcase || ""
    is_abr_individual = abr_entity_type.include?("individual") || abr_entity_type.include?("sole trader")
    is_abr_company = abr_entity_type.include?("company") || abr_entity_type.include?("trust") ||
                     abr_entity_type.include?("partnership") || abr_entity_type.include?("government")

    # Person in TEEEM but ABR says company
    if @contact.entity_type == "person" && is_abr_company
      @issues << {
        type: "abn_mismatch",
        severity: :critical,
        message: "ABR shows '#{@abr_data[:entity_type_description]}' but contact is marked as Person",
        suggested_action: "convert_to_company",
        abr_entity_name: @abr_data[:entity_name]
      }
    end

    # Company in TEEEM but ABR says individual
    if %w[company trust].include?(@contact.entity_type) && is_abr_individual
      @issues << {
        type: "abn_mismatch",
        severity: :critical,
        message: "ABR shows '#{@abr_data[:entity_type_description]}' but contact is marked as #{@contact.entity_type.titleize}",
        suggested_action: "convert_to_person"
      }
    end
  end

  # Person with admin@, info@, sales@, etc. email pattern
  def check_business_email_prefix
    return unless @contact.entity_type == "person"
    # SSoT: Use primary_email from contact_emails table
    email = @contact.primary_email
    return if email.blank?

    email_prefix = email.split("@").first&.downcase
    return unless BUSINESS_EMAIL_PREFIXES.include?(email_prefix)

    domain = extract_email_domain
    return if common_email_domain?(domain)

    @issues << {
      type: "admin_email_pattern",
      severity: :warning,
      message: "Person has business email prefix '#{email_prefix}@' - may be an employee or company contact",
      email_prefix: email_prefix,
      domain: domain,
      suggested_action: "needs_company_link"
    }
  end

  # Person's email domain matches an existing company's email_domains
  def check_email_domain_company_match
    return unless @contact.entity_type == "person"

    domain = extract_email_domain
    return if domain.blank? || common_email_domain?(domain)

    # Find company with this domain in email_domains
    matching_company = Contact.where(entity_type: %w[company trust])
                              .where("email_domains @> ?", [domain].to_json)
                              .where.not(id: @contact.id)
                              .first

    if matching_company
      @issues << {
        type: "needs_company_link",
        severity: :info,
        message: "Person's email domain '#{domain}' matches company '#{matching_company.display_name}'",
        suggested_company_id: matching_company.id,
        suggested_company_name: matching_company.display_name,
        domain: domain,
        suggested_action: "link_to_existing_company"
      }
    end
  end

  # Person linked to multiple Xero tenants - unusual for individuals
  def check_multiple_xero_links
    return unless @contact.entity_type == "person"

    xero_tenant_count = @contact.external_links
                                .where(source: "xero")
                                .select("DISTINCT xero_org_id")
                                .count

    if xero_tenant_count > 1
      @issues << {
        type: "multiple_xero_links",
        severity: :warning,
        message: "Person is linked to #{xero_tenant_count} Xero tenants - may be a company or key employee",
        xero_tenant_count: xero_tenant_count,
        suggested_action: "needs_company_link"
      }
    end
  end

  # Company without ABN and with person-like name
  def check_company_without_business_attributes
    return unless @contact.entity_type == "company"

    issues_found = []

    # No ABN
    if @contact.abn.blank?
      issues_found << "no ABN"
    end

    # Name doesn't contain typical company indicators
    name = (@contact.company_name_or_trust || @contact.display_name || "").downcase
    has_company_indicators = name.include?("pty") || name.include?("ltd") ||
                             name.include?("limited") || name.include?("holdings") ||
                             name.include?("group") || name.include?("trust") ||
                             name.include?("inc") || name.include?("corp") ||
                             name.include?("services") || name.include?("consulting")

    # Has first_name/last_name set (unusual for company)
    has_person_fields = @contact.first_name.present? && @contact.last_name.present?

    if !has_company_indicators && has_person_fields && @contact.abn.blank?
      @issues << {
        type: "misclassified_company",
        severity: :warning,
        message: "Company has person name fields and lacks typical company indicators (#{issues_found.join(', ')})",
        has_first_name: @contact.first_name.present?,
        has_last_name: @contact.last_name.present?,
        suggested_action: "convert_to_person"
      }
    end
  end

  def detect_suggested_entity_type
    # Priority 1: ABN-based suggestion
    if @abr_data && @abr_data[:entity_type_description]
      abr_type = @abr_data[:entity_type_description].downcase
      return "person" if abr_type.include?("individual") || abr_type.include?("sole trader")
      return "company" if abr_type.include?("company") || abr_type.include?("trust")
    end

    # Priority 2: Issue-based suggestion
    convert_issue = @issues.find { |i| i[:suggested_action] == "convert_to_company" }
    return "company" if convert_issue

    convert_issue = @issues.find { |i| i[:suggested_action] == "convert_to_person" }
    return "person" if convert_issue

    @contact.entity_type
  end

  def calculate_confidence
    return 0 if @issues.empty?

    # Critical ABN mismatch = high confidence
    return 95 if @issues.any? { |i| i[:type] == "abn_mismatch" }

    # Multiple indicators = higher confidence
    base_confidence = case @issues.count
                      when 1 then 60
                      when 2 then 75
                      else 85
                      end

    # Adjust based on issue types
    if @issues.any? { |i| i[:type] == "needs_company_link" && i[:suggested_company_id] }
      base_confidence += 15 # Existing company match
    end

    if @issues.any? { |i| i[:type] == "admin_email_pattern" }
      base_confidence += 10
    end

    [base_confidence, 99].min
  end

  def analyze_email_domain
    # SSoT: Use primary_email from contact_emails table
    email = @contact.primary_email
    return nil if email.blank?

    domain = extract_email_domain
    return nil if domain.blank? || common_email_domain?(domain)

    {
      domain: domain,
      derived_company_name: derive_company_name_from_domain(domain),
      is_common_domain: false,
      # SSoT: Search contact_emails table for domain matches
      contacts_with_same_domain: Contact.joins(:contact_emails)
                                        .where("contact_emails.email ILIKE ?", "%@#{domain}")
                                        .where.not(id: @contact.id)
                                        .distinct
                                        .count
    }
  end

  def find_existing_company_match
    # Check by ABN match
    if @contact.abn.present?
      abn_match = Contact.where(entity_type: %w[company trust])
                         .where(tax_number: @contact.abn)
                         .where.not(id: @contact.id)
                         .first
      return abn_match if abn_match
    end

    # Check by email domain
    domain = extract_email_domain
    if domain.present? && !common_email_domain?(domain)
      domain_match = Contact.where(entity_type: %w[company trust])
                            .where("email_domains @> ?", [domain].to_json)
                            .first
      return domain_match if domain_match

      # SSoT: Check if company has any email with same domain in contact_emails table
      email_match = Contact.joins(:contact_emails)
                           .where(entity_type: %w[company trust])
                           .where("contact_emails.email ILIKE ?", "%@#{domain}")
                           .where.not(id: @contact.id)
                           .first
      return email_match if email_match
    end

    nil
  end

  def determine_recommended_action
    return :no_action if @issues.empty?

    # Priority 1: ABN-based conversion
    abn_issue = @issues.find { |i| i[:type] == "abn_mismatch" }
    if abn_issue
      return abn_issue[:suggested_action]&.to_sym || :no_action
    end

    # Priority 2: Link to existing company
    link_issue = @issues.find { |i| i[:suggested_action] == "link_to_existing_company" }
    return :link_to_existing_company if link_issue

    # Priority 3: Convert misclassified company to person
    convert_issue = @issues.find { |i| i[:type] == "misclassified_company" }
    return :convert_to_person if convert_issue

    # Priority 4: Person needs company link (may need to create company)
    needs_link = @issues.find { |i| i[:suggested_action] == "needs_company_link" }
    if needs_link
      existing = find_existing_company_match
      return existing ? :link_to_existing_company : :create_new_company_and_link
    end

    :no_action
  end

  def extract_email_domain
    # SSoT: Use primary_email from contact_emails table
    email = @contact.primary_email
    return nil if email.blank?
    email.split("@").last&.downcase
  end

  def common_email_domain?(domain)
    return true if domain.blank?
    COMMON_EMAIL_DOMAINS.include?(domain.downcase)
  end

  def derive_company_name_from_domain(domain)
    return nil if domain.blank?

    # Extract base name from domain
    # e.g., "psainvest.net" -> "PSA Invest"
    # e.g., "tekna.com.au" -> "Tekna"

    base = domain.split(".").first
    return nil if base.blank?

    # Try to make it more readable
    # Handle camelCase: "psaInvest" -> "PSA Invest"
    # Handle abbreviations at start: "psainvest" -> "PSA Invest"
    readable = base.gsub(/([a-z])([A-Z])/, '\1 \2')  # Split camelCase
                   .gsub(/([A-Z]+)([A-Z][a-z])/, '\1 \2')  # Split consecutive caps
                   .split(/[_\-]/)  # Split on _ or -
                   .map(&:capitalize)
                   .join(" ")

    readable
  end
end
