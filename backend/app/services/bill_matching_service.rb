# frozen_string_literal: true

# Matches incoming bills to existing Purchase Orders
# Creates internal tasks for mismatches or variance review
#
# SSoT: Uses Gl::AiPoInvoiceMatcher for AI-enhanced matching
# Rule-based matching is tried first, then AI suggestions
#
class BillMatchingService
  # Default variance thresholds (can be overridden by company rules)
  DEFAULT_VARIANCE_THRESHOLD_PERCENT = 5.0
  DEFAULT_VARIANCE_THRESHOLD_AMOUNT = 100.0

  def initialize(bill_inbox, enable_ai: true)
    @bill = bill_inbox
    @enable_ai = enable_ai
    @match_confidence = nil
    @match_source = nil
  end

  def match!
    @bill.update!(status: "matching")
    Rails.logger.info "[BillMatching] Starting match for BillInbox ##{@bill.id}"

    # Load company-specific config
    @config = load_company_config

    # Try to find matching PO
    po = find_matching_po

    if po
      variance = calculate_variance(po)
      handle_matched_po(po, variance)
    else
      handle_no_match
    end

    @bill.reload
  rescue StandardError => e
    Rails.logger.error "[BillMatching] Error matching BillInbox ##{@bill.id}: #{e.message}"
    @bill.update!(status: "error", notes: "Matching failed: #{e.message}")
    raise
  end

  private

  def load_company_config
    return {} unless @bill.corporate_company

    CompanyApprovalRule.default_bill_config(@bill.corporate_company)
  end

  def find_matching_po
    return nil unless @bill.supplier.present? || @bill.supplier_abn_raw.present? || @enable_ai

    # Strategy 1: Match by PO number in extraction
    if po_number_from_invoice.present?
      po = PurchaseOrder.find_by(purchase_order_number: po_number_from_invoice)
      if po
        Rails.logger.info "[BillMatching] Matched by PO number: #{po_number_from_invoice}"
        @match_confidence = 100
        @match_source = "po_number"
        return po
      end
    end

    # Strategy 2: Match by supplier and approximate amount
    if @bill.supplier.present? && @bill.total_amount.present?
      candidates = find_po_candidates_by_supplier
      if candidates.any?
        # Return the best match (closest amount)
        best_match = candidates.min_by { |po| (po.total - @bill.total_amount).abs }
        Rails.logger.info "[BillMatching] Matched by supplier + amount: PO #{best_match.purchase_order_number}"
        @match_confidence = 85
        @match_source = "supplier_amount"
        return best_match
      end
    end

    # Strategy 3: Match by ABN if no linked supplier yet
    if @bill.supplier_abn_raw.present? && @bill.supplier.blank?
      candidates = find_po_candidates_by_abn
      if candidates.any?
        best_match = candidates.min_by { |po| (po.total - @bill.total_amount.to_d).abs }
        Rails.logger.info "[BillMatching] Matched by ABN + amount: PO #{best_match.purchase_order_number}"
        @match_confidence = 75
        @match_source = "abn_amount"
        return best_match
      end
    end

    # Strategy 4: AI-enhanced matching (when rules fail)
    if @enable_ai
      ai_match = try_ai_match
      return ai_match if ai_match
    end

    nil
  end

  def try_ai_match
    return nil unless @enable_ai

    matcher = Gl::AiPoInvoiceMatcher.new(@bill, corporate_company: @bill.corporate_company)
    result = matcher.find_best_match
    return nil unless result && result[:confidence] >= 60

    Rails.logger.info "[BillMatching] AI match found: PO #{result[:po].purchase_order_number} (#{result[:confidence]}% confidence)"
    @match_confidence = result[:confidence]
    @match_source = result[:source]
    result[:po]
  rescue StandardError => e
    Rails.logger.warn "[BillMatching] AI matching failed: #{e.message}"
    nil
  end

  def po_number_from_invoice
    @bill.ai_extraction_result&.dig("po_number")
  end

  def find_po_candidates_by_supplier
    return [] unless @bill.supplier && @bill.total_amount

    PurchaseOrder
      .where(supplier: @bill.supplier)
      .where(status: %w[sent received invoiced])
      .where("total BETWEEN ? AND ?",
             @bill.total_amount * 0.8,
             @bill.total_amount * 1.2)
      .order(created_at: :desc)
      .limit(5)
  end

  def find_po_candidates_by_abn
    return [] unless @bill.supplier_abn_raw

    abn = @bill.supplier_abn_raw.gsub(/\s/, "")

    # Find contacts with this ABN
    contacts = Contact.where("REPLACE(tax_number, ' ', '') = ?", abn)
    return [] if contacts.empty?

    PurchaseOrder
      .where(supplier: contacts)
      .where(status: %w[sent received invoiced])
      .where("total BETWEEN ? AND ?",
             (@bill.total_amount || 0) * 0.8,
             (@bill.total_amount || 0) * 1.2)
      .order(created_at: :desc)
      .limit(5)
  end

  def calculate_variance(po)
    bill_amount = @bill.total_amount.to_d
    po_amount = po.total.to_d

    return { status: "matched", amount: 0, reason: nil } if bill_amount == po_amount

    variance = bill_amount - po_amount
    percentage = po_amount.zero? ? 100.0 : ((variance / po_amount) * 100).abs.round(2)

    # Get thresholds from config
    threshold_percent = @config[:variance_threshold_percent] || DEFAULT_VARIANCE_THRESHOLD_PERCENT
    threshold_amount = @config[:variance_threshold_amount] || DEFAULT_VARIANCE_THRESHOLD_AMOUNT

    if percentage <= threshold_percent && variance.abs <= threshold_amount
      { status: "matched", amount: variance, reason: "Within tolerance (#{percentage}%)" }
    else
      { status: "variance", amount: variance, reason: "Exceeds tolerance: #{percentage}% ($#{variance.abs.round(2)})" }
    end
  end

  def handle_matched_po(po, variance)
    @bill.update!(
      matched_purchase_order: po,
      match_status: variance[:status],
      variance_amount: variance[:amount],
      variance_reason: variance[:reason],
      match_confidence: @match_confidence,
      match_source: @match_source,
      status: "matched"
    )

    # Update PO with bill info
    po.update!(
      last_bill_inbox: @bill,
      total_billed: po.total_billed.to_d + @bill.total_amount.to_d
    )

    if variance[:status] == "variance"
      Rails.logger.info "[BillMatching] Variance detected for BillInbox ##{@bill.id}: #{variance[:reason]}"
      create_variance_review_task!
    else
      Rails.logger.info "[BillMatching] Successfully matched BillInbox ##{@bill.id} to PO #{po.purchase_order_number}"
    end
  end

  def handle_no_match
    # Check if company requires PO for all bills
    if requires_po?
      @bill.update!(
        match_status: "unmatched",
        status: "error",
        notes: "No matching PO found - manual review required"
      )
      create_no_po_task!
      Rails.logger.info "[BillMatching] No PO found for BillInbox ##{@bill.id} - task created"
    else
      @bill.update!(
        match_status: "no_po_required",
        status: "matched"
      )
      Rails.logger.info "[BillMatching] No PO required for BillInbox ##{@bill.id}"
    end
  end

  def requires_po?
    # Check company settings - default to requiring PO
    @config[:require_po] != false
  end

  def create_variance_review_task!
    # Create internal task for variance review (no email per user requirement)
    BpmnTaskInstance.create!(
      task_type: "user_task",
      status: "pending",
      bpmn_node: nil, # Manual task, not from workflow
      assigned_to_role: "finance_manager",
      due_date: 1.business_day.from_now,
      form_data: {
        task_type: "variance_review",
        bill_inbox_id: @bill.id,
        po_id: @bill.matched_purchase_order_id,
        po_number: @bill.matched_purchase_order&.purchase_order_number,
        supplier: @bill.supplier_name_raw || @bill.supplier&.display_name,
        invoice_amount: @bill.total_amount,
        po_amount: @bill.matched_purchase_order&.total,
        variance_amount: @bill.variance_amount,
        variance_reason: @bill.variance_reason
      }
    )
  end

  def create_no_po_task!
    # Determine if we should auto-create PO (for subsidiaries)
    if should_auto_create_po?
      auto_create_po!
    else
      # Create manual review task
      BpmnTaskInstance.create!(
        task_type: "user_task",
        status: "pending",
        bpmn_node: nil,
        assigned_to_role: "finance_admin",
        due_date: 2.business_days.from_now,
        form_data: {
          task_type: "no_po_review",
          bill_inbox_id: @bill.id,
          supplier: @bill.supplier_name_raw || @bill.supplier&.display_name,
          supplier_abn: @bill.supplier_abn_raw,
          invoice_amount: @bill.total_amount,
          invoice_number: @bill.invoice_number,
          action_required: "Create or match PO"
        }
      )
    end
  end

  def should_auto_create_po?
    return false unless @config[:auto_create_po_for_subsidiaries]
    return false unless @bill.corporate_company

    # Auto-create if not the primary company
    !@bill.corporate_company.is_primary?
  end

  def auto_create_po!
    # Auto-create a draft PO from the bill
    po = PurchaseOrder.create!(
      job: find_or_create_default_job,
      supplier: @bill.supplier,
      status: "draft",
      purchase_order_number: PurchaseOrder.generate_next_number,
      total: @bill.total_amount,
      sub_total: @bill.subtotal || @bill.total_amount,
      gst_amount: @bill.tax_amount || 0,
      notes: "Auto-created from Bill ##{@bill.id} - #{@bill.invoice_number}"
    )

    # Create line items from bill
    @bill.line_items.each do |item|
      po.line_items.create!(
        description: item["description"],
        quantity: item["quantity"] || 1,
        unit_price: item["unit_price"] || item["amount"],
        total: item["amount"]
      )
    end

    @bill.update!(
      matched_purchase_order: po,
      match_status: "matched",
      status: "matched",
      variance_amount: 0,
      variance_reason: "Auto-created PO"
    )

    # Create task to review auto-created PO
    BpmnTaskInstance.create!(
      task_type: "user_task",
      status: "pending",
      bpmn_node: nil,
      assigned_to_role: "finance_admin",
      due_date: 1.business_day.from_now,
      form_data: {
        task_type: "review_auto_po",
        bill_inbox_id: @bill.id,
        po_id: po.id,
        po_number: po.purchase_order_number,
        supplier: @bill.supplier_name_raw,
        amount: @bill.total_amount
      }
    )

    Rails.logger.info "[BillMatching] Auto-created PO #{po.purchase_order_number} for BillInbox ##{@bill.id}"
  end

  def find_or_create_default_job
    # Find a default job for the company, or create one
    Job.find_by(corporate_company: @bill.corporate_company, is_default: true) ||
      Job.where(corporate_company: @bill.corporate_company).first ||
      create_default_job
  end

  def create_default_job
    Job.create!(
      name: "General Expenses - #{@bill.corporate_company.name}",
      corporate_company: @bill.corporate_company,
      status: "active",
      is_default: true
    )
  end
end
