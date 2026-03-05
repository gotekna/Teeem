# Tenancy Billing Service
#
# Creates and manages recurring invoices for tenancies.
# Integrates with the GL module for invoice generation.
#
# For standard tenancies:
#   - Creates one recurring invoice for rent (billed to tenant contact)
#
# For SDA tenancies:
#   - Creates recurring invoice for participant contribution (billed to participant)
#   - Creates recurring invoice for NDIA balance (billed to NDIA contact, quarterly)

class TenancyBillingService
  attr_reader :tenancy

  def initialize(tenancy)
    @tenancy = tenancy
  end

  # Set up billing for a tenancy (call when tenancy becomes active)
  def setup_billing!
    return unless tenancy.active?

    if tenancy.sda?
      setup_sda_billing!
    else
      setup_standard_billing!
    end
  end

  # Remove billing when tenancy is terminated
  def teardown_billing!
    deactivate_recurring_invoice(tenancy.rent_recurring_invoice_id)
    deactivate_recurring_invoice(tenancy.sda_recurring_invoice_id) if tenancy.sda?
  end

  private

  def setup_standard_billing!
    return unless gl_module_available?

    invoice = find_or_create_recurring_invoice(
      description: "Rent - #{tenancy.property.name || tenancy.property.street_address}",
      amount: tenancy.weekly_rent,
      frequency: tenancy.rent_frequency,
      contact: tenant_contact,
      start_date: tenancy.start_date,
      end_date: tenancy.end_date
    )

    tenancy.update_column(:rent_recurring_invoice_id, invoice.id) if invoice
  end

  def setup_sda_billing!
    return unless gl_module_available?

    # Calculate SDA payment split
    calculator = SdaPaymentCalculator.new(tenancy)
    calculator.apply!

    # 1. Participant contribution invoice
    if tenancy.participant_rent_contribution&.positive?
      participant_invoice = find_or_create_recurring_invoice(
        description: "SDA Participant Rent - #{tenancy.property.name || tenancy.property.street_address}",
        amount: tenancy.participant_rent_contribution,
        frequency: tenancy.rent_frequency,
        contact: tenancy.sda_participant_contact,
        start_date: tenancy.start_date,
        end_date: tenancy.end_date
      )

      tenancy.update_column(:rent_recurring_invoice_id, participant_invoice.id) if participant_invoice
    end

    # 2. NDIA balance invoice (quarterly)
    if tenancy.ndia_payment_amount&.positive?
      ndia_invoice = find_or_create_recurring_invoice(
        description: "SDA NDIA Payment - #{tenancy.property.name || tenancy.property.street_address} (Plan: #{tenancy.sda_plan_number})",
        amount: tenancy.ndia_payment_amount * 13, # Quarterly = 13 weeks
        frequency: "quarterly",
        contact: ndia_contact,
        start_date: tenancy.start_date,
        end_date: tenancy.end_date
      )

      tenancy.update_column(:sda_recurring_invoice_id, ndia_invoice.id) if ndia_invoice
    end
  end

  def find_or_create_recurring_invoice(description:, amount:, frequency:, contact:, start_date:, end_date:)
    return nil unless contact

    # Check if Gl::RecurringInvoice exists
    return nil unless defined?(Gl::RecurringInvoice)

    Gl::RecurringInvoice.create!(
      description: description,
      amount: amount,
      frequency: map_frequency(frequency),
      contact_id: contact.id,
      start_date: start_date,
      end_date: end_date,
      status: "active",
      tenant_id: tenancy.tenant_id
    )
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error("TenancyBillingService: Failed to create recurring invoice: #{e.message}")
    nil
  end

  def deactivate_recurring_invoice(invoice_id)
    return unless invoice_id && defined?(Gl::RecurringInvoice)

    invoice = Gl::RecurringInvoice.find_by(id: invoice_id)
    invoice&.update(status: "inactive")
  end

  def tenant_contact
    tenancy.property.property_contacts.find_by(role: "tenant", is_primary: true)&.contact
  end

  def ndia_contact
    # NDIA contact should be set up as a Contact in the system
    # Look for a contact named "NDIA" or "National Disability Insurance Agency"
    Contact.find_by(
      tenant_id: tenancy.tenant_id,
      display_name: ["NDIA", "National Disability Insurance Agency"]
    )
  end

  def map_frequency(frequency)
    case frequency
    when "weekly" then "weekly"
    when "fortnightly" then "fortnightly"
    when "monthly" then "monthly"
    when "quarterly" then "quarterly"
    else "weekly"
    end
  end

  def gl_module_available?
    defined?(Gl::RecurringInvoice)
  end
end
