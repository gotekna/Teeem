# frozen_string_literal: true

# Starts BPMN approval workflows for bills
# Uses company-specific rules to determine workflow and approvers
#
class BillApprovalWorkflowService
  def initialize(bill_inbox)
    @bill = bill_inbox
  end

  def start!
    Rails.logger.info "[BillApprovalWorkflow] Starting for BillInbox ##{@bill.id}"

    # Find applicable approval rule
    rule = find_applicable_rule

    if rule&.bpmn_process.present?
      # Use BPMN workflow
      start_bpmn_workflow(rule.bpmn_process)
    else
      # Simple approval - create task directly
      create_approval_task(rule)
    end
  rescue StandardError => e
    Rails.logger.error "[BillApprovalWorkflow] Failed for BillInbox ##{@bill.id}: #{e.message}"
    raise
  end

  private

  def find_applicable_rule
    return nil unless @bill.corporate_company

    CompanyApprovalRule.find_for_bill(
      company: @bill.corporate_company,
      amount: @bill.total_amount.to_d,
      variance_percent: variance_percent
    )
  end

  def variance_percent
    return nil unless @bill.matched_purchase_order && @bill.variance_amount

    po_total = @bill.matched_purchase_order.total.to_d
    return nil if po_total.zero?

    ((@bill.variance_amount / po_total) * 100).round(2)
  end

  def start_bpmn_workflow(process)
    instance = Bpmn::EngineService.start_process(
      process_id: process.id,
      subject: @bill,
      variables: {
        bill_id: @bill.id,
        amount: @bill.total_amount,
        supplier: @bill.supplier_name_raw || @bill.supplier&.display_name,
        invoice_number: @bill.invoice_number,
        variance_amount: @bill.variance_amount,
        variance_percent: variance_percent,
        company_id: @bill.corporate_company_id,
        match_status: @bill.match_status,
        po_id: @bill.matched_purchase_order_id,
        po_number: @bill.matched_purchase_order&.purchase_order_number
      }
    )

    @bill.update!(
      status: "approval_pending",
      bpmn_process_instance_id: instance.id
    )

    Rails.logger.info "[BillApprovalWorkflow] Started BPMN process instance ##{instance.id}"
  end

  def create_approval_task(rule)
    # Determine approval level based on amount thresholds
    config = CompanyApprovalRule.default_bill_config(@bill.corporate_company)

    amount = @bill.total_amount.to_d
    approver_role = determine_approver_role(amount, config)

    # Check if auto-approve threshold is met
    if config[:auto_approve_threshold].present? && amount <= config[:auto_approve_threshold]
      # Auto-approve small amounts
      @bill.update!(
        status: "approved",
        approved_at: Time.current,
        notes: "Auto-approved: amount under threshold"
      )
      Rails.logger.info "[BillApprovalWorkflow] Auto-approved BillInbox ##{@bill.id} (amount: $#{amount})"
      return
    end

    # Get approvers from rule or use role-based
    approvers = rule&.get_approvers || []
    assigned_to = approvers.first

    # Create approval task
    task = BpmnTaskInstance.create!(
      task_type: "user_task",
      status: "pending",
      bpmn_node: nil,
      assigned_to: assigned_to,
      assigned_to_role: assigned_to.blank? ? approver_role : nil,
      due_date: calculate_due_date(approver_role),
      form_data: {
        task_type: "bill_approval",
        bill_inbox_id: @bill.id,
        supplier: @bill.supplier_name_raw || @bill.supplier&.display_name,
        invoice_number: @bill.invoice_number,
        amount: @bill.total_amount,
        due_date: @bill.due_date,
        variance_amount: @bill.variance_amount,
        variance_reason: @bill.variance_reason,
        po_number: @bill.matched_purchase_order&.purchase_order_number
      }
    )

    @bill.update!(status: "approval_pending")

    Rails.logger.info "[BillApprovalWorkflow] Created approval task ##{task.id} for BillInbox ##{@bill.id}"
  end

  def determine_approver_role(amount, config)
    if config[:director_threshold].present? && amount >= config[:director_threshold]
      "director"
    elsif amount >= config[:finance_manager_threshold].to_d
      "finance_manager"
    elsif amount >= config[:team_lead_threshold].to_d
      "team_lead"
    else
      "finance_admin"
    end
  end

  def calculate_due_date(approver_role)
    case approver_role
    when "director"
      3.business_days.from_now
    when "finance_manager"
      2.business_days.from_now
    else
      1.business_day.from_now
    end
  end
end
