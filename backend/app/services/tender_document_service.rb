# frozen_string_literal: true

# TenderDocumentService - Creates versioned tender documents from a job's POs.
#
# Flow:
#   1. Snapshot PO line items, grouped by tender section (from SM Schedule Master)
#   2. Snapshot job + client contact info (frozen at creation time)
#   3. Calculate section subtotals, GST, and grand total
#   4. Lock all PO budgets to prevent modification
#   5. Return the created TenderDocument
#
# Usage:
#   service = TenderDocumentService.new(job: job, user: current_user)
#   tender_doc = service.create!
#
class TenderDocumentService
  class CreationError < StandardError; end

  def initialize(job:, user:, item_classifications: {}, po_classifications: {}, item_overrides: {}, additional_items: [], section_notes: {}, builder_state: {})
    @job = job
    @user = user
    @item_classifications = item_classifications.transform_keys(&:to_s)
    @po_classifications = po_classifications.transform_keys(&:to_s)
    @item_overrides = item_overrides.transform_keys(&:to_i)
    @additional_items = additional_items
    @section_notes = section_notes.transform_keys(&:to_s)
    @builder_state = builder_state.presence || {}
  end

  def create!
    TenderDocument.transaction do
      version = next_version_number

      doc = TenderDocument.create!(
        job: @job,
        created_by: @user,
        document_number: "TD-TEMP-#{SecureRandom.hex(4)}",
        version: version,
        date_prepared: Date.current,
        valid_until: Date.current + 30.days,
        validity_days: 30,
        previous_version_id: current_version&.id,
        status: "draft",
        **snapshot_job_data,
        **snapshot_client_data,
        **snapshot_tender_details
      )

      snapshot_po_items!(doc)
      calculate_totals!(doc)
      doc.lock_pos!(@user)

      doc
    end
  rescue ActiveRecord::RecordInvalid => e
    raise CreationError, "Failed to create tender document: #{e.message}"
  end

  private

  def snapshot_po_items!(doc)
    line_counter_by_section = Hash.new(0)
    sections_with_items = Set.new

    @job.purchase_orders.includes(:line_items, sm_task: :sm_schedule_master).find_each do |po|
      tender_section = resolve_tender_section(po)
      tender_header = tender_section&.parent

      po_cls = @po_classifications[po.id.to_s]

      # PO-level classifications: skip or roll up the entire PO
      if po_cls.in?(%w[per_po_nt per_po_exc])
        # Skip entire PO
        next
      elsif po_cls.in?(%w[per_po_incl per_po_pc per_po_ps])
        # Create ONE summary line for the entire PO
        section_name = tender_section&.name || "Unallocated"
        line_counter_by_section[section_name] += 1
        sections_with_items << tender_section&.id if tender_section

        po_total = po.line_items.sum { |li| (li.quantity || 0).to_d * (li.unit_price || 0).to_d }
        summary_type = case po_cls
                       when "per_po_incl" then "included"
                       when "per_po_pc" then "priced"
                       when "per_po_ps" then "provisional"
                       end

        task_name = po.sm_task&.name || po.description || "Purchase Order"

        doc.tender_document_items.create!(
          tender_section_name: section_name,
          tender_section_code: tender_section&.code,
          section_sort_order: tender_section&.sort_order || 999,
          section_type: tender_section&.section_type || "priced",
          tender_header_name: tender_header&.name,
          tender_header_code: tender_header&.code,
          header_sort_order: tender_header&.sort_order || 999,
          line_number: line_counter_by_section[section_name],
          description: clean_task_name(task_name),
          quantity: summary_type == "included" ? nil : 1,
          unit: nil,
          unit_price: summary_type == "included" ? nil : po_total,
          total_amount: summary_type == "included" ? BigDecimal("0") : po_total,
          gst_code: "GST",
          item_type: summary_type,
          source_purchase_order_id: po.id,
          source_po_number: po.purchase_order_number,
          cost_centre_name: po.cost_centre_from_task,
          trade_name: po.trade_from_task
        )
        next
      end

      # per_item (default): process each line item with individual classifications
      po.line_items.ordered.each do |item|
        item_cls = @item_classifications[item.id.to_s] || "included"

        # Skip excluded / hidden items
        next if item_cls.in?(%w[excluded incl_hidden])

        section_name = tender_section&.name || "Unallocated"
        line_counter_by_section[section_name] += 1
        sections_with_items << tender_section&.id if tender_section

        # Map classification to item_type
        mapped_type = case item_cls
                      when "included" then "included"
                      when "ps" then "provisional"
                      else "priced" # "pc" or default
                      end

        # Apply user overrides from the Tender Builder (description, quantity, unit_price)
        override = @item_overrides[item.id] || {}
        eff_description = override[:description] || override["description"] || item.description
        eff_quantity = (override[:quantity] || override["quantity"] || item.quantity).to_d
        eff_unit_price = (override[:unit_price] || override["unit_price"] || item.unit_price).to_d
        eff_total = mapped_type == "included" ? BigDecimal("0") : eff_quantity * eff_unit_price

        doc.tender_document_items.create!(
          tender_section_name: section_name,
          tender_section_code: tender_section&.code,
          section_sort_order: tender_section&.sort_order || 999,
          section_type: tender_section&.section_type || "priced",
          tender_header_name: tender_header&.name,
          tender_header_code: tender_header&.code,
          header_sort_order: tender_header&.sort_order || 999,
          line_number: line_counter_by_section[section_name],
          description: eff_description,
          quantity: mapped_type == "included" ? nil : eff_quantity,
          unit: mapped_type == "included" ? nil : item.pricebook_item&.unit_of_measure,
          unit_price: mapped_type == "included" ? nil : eff_unit_price,
          total_amount: eff_total,
          gst_code: item.gst_code || "GST",
          item_type: mapped_type,
          source_purchase_order_id: po.id,
          source_po_number: po.purchase_order_number,
          source_line_item_id: item.id,
          cost_centre_name: po.cost_centre_from_task,
          trade_name: po.trade_from_task
        )
      end
    end

    # Insert default note items for sections that have no PO items
    insert_default_note_items!(doc, sections_with_items)

    # Insert custom lines added by the user in the Tender Builder
    insert_additional_items!(doc, line_counter_by_section)
  end

  # Insert placeholder items for ALL sections that have no PO items.
  # Uses default_note → description → section name as fallback text.
  # This ensures EVERY tender section/header appears in the document even when empty.
  def insert_default_note_items!(doc, sections_with_items)
    Tender.sections.active.ordered.includes(:parent).find_each do |section|
      next if sections_with_items.include?(section.id)

      # User-edited note takes priority, then default_note, then description, then section name
      note_text = @section_notes[section.name].presence ||
                  section.default_note.presence ||
                  section.description.presence ||
                  section.name

      header = section.parent
      doc.tender_document_items.create!(
        tender_section_name: section.name,
        tender_section_code: section.code,
        section_sort_order: section.sort_order || 999,
        section_type: "note",
        tender_header_name: header&.name,
        tender_header_code: header&.code,
        header_sort_order: header&.sort_order || 999,
        line_number: 1,
        description: note_text,
        item_type: "note",
        default_note: note_text
      )
    end
  end

  # Insert custom lines added by the user in the Tender Builder UI.
  # These are not linked to any PO - they're user-created tender items.
  def insert_additional_items!(doc, line_counter_by_section)
    @additional_items.each do |ai|
      ai = ai.symbolize_keys if ai.respond_to?(:symbolize_keys)
      section_name = ai[:section_name] || "Unallocated"
      header_name = ai[:header_name]
      line_counter_by_section[section_name] += 1

      # Resolve tender section from name for sort_order / code
      tender_section = Tender.sections.active.find_by(name: section_name)
      tender_header = tender_section&.parent || Tender.headers.active.find_by(name: header_name)

      qty = (ai[:quantity] || 1).to_d
      price = (ai[:unit_price] || 0).to_d

      doc.tender_document_items.create!(
        tender_section_name: section_name,
        tender_section_code: tender_section&.code,
        section_sort_order: tender_section&.sort_order || 999,
        section_type: tender_section&.section_type || "priced",
        tender_header_name: tender_header&.name || header_name,
        tender_header_code: tender_header&.code,
        header_sort_order: tender_header&.sort_order || 999,
        line_number: line_counter_by_section[section_name],
        description: ai[:description] || "",
        quantity: qty,
        unit_price: price,
        total_amount: qty * price,
        gst_code: "GST",
        item_type: tender_section&.section_type || "priced"
      )
    end
  end

  # Clean task name for PO-level summary lines (strips "SM:" prefix, codes like "0101", etc.)
  def clean_task_name(name)
    cleaned = name.to_s.dup
    cleaned.sub!(/\ASM:\s*/i, "")         # Remove "SM:" prefix
    cleaned.sub!(/\A\d{3,4}\s+/, "")      # Remove leading numeric codes like "0101 "
    cleaned.strip!
    cleaned.presence || "Allowance"
  end

  def resolve_tender_section(po)
    tender_id = po.sm_task&.sm_schedule_master&.tender_id
    return nil unless tender_id

    Tender.find_by(id: tender_id)
  end

  def calculate_totals!(doc)
    # Include both priced and provisional items in totals (not "included" or "note")
    countable_items = doc.tender_document_items.where(item_type: %w[priced provisional], excluded: false)
    subtotal = countable_items.sum(:total_amount)

    # Calculate GST per item using GstCode rates
    gst_total = BigDecimal("0")
    countable_items.find_each do |item|
      rate = begin
        GstCode.rate_for(item.gst_code)
      rescue StandardError
        0.1 # Default to 10% GST if code not found
      end
      gst_total += (item.total_amount || 0) * rate
    end

    doc.update!(
      subtotal: subtotal,
      gst: gst_total.round(2),
      total: (subtotal + gst_total).round(2)
    )
  end

  def next_version_number
    (TenderDocument.where(job: @job).maximum(:version) || 0) + 1
  end

  def current_version
    TenderDocument.where(job: @job)
                  .where.not(status: "superseded")
                  .order(:version)
                  .last
  end

  def snapshot_job_data
    # Build full address with suburb, state, postcode
    address_parts = [@job.name]
    postcode_state = [@job.suburb, @job.state, @job.postcode].compact.reject(&:blank?)
    full_address = if @job.name.include?(@job.suburb.to_s) && @job.postcode.present?
      # Name already has suburb - just append postcode if missing
      @job.name.include?(@job.postcode.to_s) ? @job.name : "#{@job.name} #{@job.postcode}"
    else
      @job.name
    end

    {
      job_name: @job.name,
      job_address: full_address,
      job_code: @job.job_code
    }
  end

  def snapshot_tender_details
    {
      council: @job.council,
      estate: @job.estate,
      facade: @job.facade,
      design_name: @job.design_name,
      specification: @job.specification,
      developer_approval: @job.developer_approval,
      developer_contact: @job.developer_contact,
      land_registration: @job.land_registration,
      building_contract_type: @job.building_contract_type,
      development_application: @job.development_application,
      sales_centre: @job.sales_centre,
      wind_classification: @job.wind_classification,
      soil_classification: @job.soil_classification,
      lot_address: format_lot_address(@job),
      plan_number: @job.plan_number
    }
  end

  def format_lot_address(job)
    parts = []
    parts << "Lot #{job.lot_number}" if job.lot_number.present?
    street = [job.street_number, job.street_name, job.street_type].compact.reject(&:blank?).join(" ")
    parts << street if street.present?
    location = [job.suburb, job.state, job.postcode].compact.reject(&:blank?).join(" ")
    parts << location if location.present?
    parts.join(", ")
  end

  def snapshot_client_data
    # Get ALL clients (job owners) - not just the first one
    client_contacts = @job.job_contacts.where(role: "client").includes(:contact)
    return {} if client_contacts.empty?

    primary_client = client_contacts.first&.contact
    all_client_names = client_contacts.map { |jc| jc.contact&.display_name }.compact
    salesperson = @job.job_contacts.find_by(role: "internal_sales")

    {
      client_name: all_client_names.join(" & "),
      client_address: primary_client&.full_address,
      client_email: primary_client&.primary_email,
      client_phone: primary_client&.primary_mobile,
      salesperson_name: salesperson&.person_name
    }
  end
end
