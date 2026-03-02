# frozen_string_literal: true

# MarkupChargeCalculator - SSoT for computing job-level markup charges
#
# Pricing formula:
#   sell_subtotal = sum(SmTask.sell_price)
#   cost_total = sum(SmTask.cost_basis)
#
#   + Construction Insurance (% x sell_subtotal, or $ override)
#   + QLeave (0.575% x cost_total if > threshold, or $ override)
#   + Overheads (% x sell_subtotal, or $ override)
#   = charges_total
#
#   subtotal_with_charges = sell_subtotal + charges_total
#   contract_ex_gst = subtotal_with_charges x (1 + builder_margin / 100)
#   contract_inc_gst = contract_ex_gst x 1.10
#
#   insurable_value = contract_inc_gst (QBCC excludes its own premium)
#   + QBCC premium (from bracket table lookup, or $ override)
#
#   FINAL CONTRACT (inc GST) = contract_inc_gst + QBCC premium
#
class MarkupChargeCalculator
  attr_reader :job, :settings

  def initialize(job)
    @job = job
    @settings = SmSetting.instance
    @template = job.schedule_template
  end

  # Resolve a rate from template override → global default fallback.
  # Template values are nullable — nil means "use global SmSetting".
  def effective_rate(field)
    template_val = @template&.send(field)
    return template_val if template_val.present?

    settings.send(field)
  end

  # Calculate all charges and return a comprehensive result hash.
  # Persists calculated amounts to JobMarkupCharge records if persist: true.
  def calculate(persist: false)
    tasks = job.sm_tasks
               .where(po_required: true)
               .includes(:purchase_order, tender: :tender_header)

    sell_subtotal = tasks.sum(&:sell_price).round(2)
    cost_total = tasks.sum(&:cost_basis).round(2)

    charges = {}

    # Construction Insurance: % of sell subtotal (template override → global default)
    charges[:construction_insurance] = calc_charge(
      :construction_insurance,
      basis: sell_subtotal,
      default_rate: effective_rate(:default_construction_insurance_percent)
    )

    # QLeave: % of cost total (only if cost > threshold)
    qleave_threshold = settings.qleave_threshold || 150_000
    qleave_basis = cost_total > qleave_threshold ? cost_total : 0
    charges[:qleave] = calc_charge(
      :qleave,
      basis: qleave_basis,
      default_rate: effective_rate(:default_qleave_rate_percent)
    )

    # Overheads: % of sell subtotal (template override → global default)
    charges[:overheads] = calc_charge(
      :overheads,
      basis: sell_subtotal,
      default_rate: effective_rate(:default_overheads_percent)
    )

    # Sum non-QBCC charges
    charges_total = charges.values.sum { |c| c[:effective_amount] }.round(2)
    subtotal_with_charges = (sell_subtotal + charges_total).round(2)

    # Builder margin applied to subtotal WITH charges
    builder_margin = job.builder_margin_percent || 0
    contract_ex_gst = (subtotal_with_charges * (1 + builder_margin / 100.0)).round(2)
    contract_inc_gst = (contract_ex_gst * 1.10).round(2)

    # QBCC: based on contract inc GST (insurable value excludes QBCC itself)
    qbcc_minimum = settings.qbcc_minimum_threshold || 3_300
    insurable_value = contract_inc_gst
    charges[:qbcc_insurance] = calc_qbcc_charge(insurable_value, qbcc_minimum)

    qbcc_amount = charges[:qbcc_insurance][:effective_amount]
    final_contract_inc_gst = (contract_inc_gst + qbcc_amount).round(2)

    # Auto-link charges to POs via SM template task mapping
    auto_link_charge_pos(charges) if persist

    # Persist if requested
    persist_charges(charges) if persist

    {
      sell_subtotal: sell_subtotal,
      cost_total: cost_total,
      charges: charges,
      charges_total: charges_total,
      subtotal_with_charges: subtotal_with_charges,
      builder_margin_percent: builder_margin,
      contract_ex_gst: contract_ex_gst,
      gst_amount: (contract_inc_gst - contract_ex_gst).round(2),
      contract_inc_gst: contract_inc_gst,
      insurable_value: insurable_value,
      qbcc_amount: qbcc_amount,
      final_contract_inc_gst: final_contract_inc_gst
    }
  end

  # Back-calculate the builder margin % needed to hit a target final contract price (inc GST).
  #
  # The QBCC premium depends on contract_inc_gst, which depends on margin,
  # creating a circular dependency. We solve iteratively (converges in 2-3 rounds).
  #
  # Returns hash with :required_margin_percent, :contract_inc_gst, :qbcc_amount, :final_contract_inc_gst
  def calculate_margin_for_target(target_final_inc_gst)
    base = calculate
    subtotal_with_charges = base[:subtotal_with_charges]

    return { error: "No charges to calculate from" } if subtotal_with_charges <= 0

    qbcc_minimum = settings.qbcc_minimum_threshold || 3_300
    qbcc_charge_record = existing_charges["qbcc_insurance"]
    qbcc_override = qbcc_charge_record&.override_amount
    qbcc_using_override = qbcc_override.present? && qbcc_override > 0

    # Iteratively solve: target = contract_inc_gst + qbcc(contract_inc_gst)
    guess = target_final_inc_gst
    contract_inc_gst = guess
    qbcc_amount = 0.0

    5.times do
      if qbcc_using_override
        qbcc_amount = qbcc_override.to_f
      elsif guess >= qbcc_minimum
        qbcc_amount = QbccPremiumBracket.lookup_premium(guess - qbcc_amount)
      else
        qbcc_amount = 0.0
      end

      contract_inc_gst = (target_final_inc_gst - qbcc_amount).round(2)

      # Re-derive QBCC from this contract_inc_gst
      new_qbcc = if qbcc_using_override
                   qbcc_override.to_f
                 elsif contract_inc_gst >= qbcc_minimum
                   QbccPremiumBracket.lookup_premium(contract_inc_gst)
                 else
                   0.0
                 end

      break if (new_qbcc - qbcc_amount).abs < 0.01
      qbcc_amount = new_qbcc
      contract_inc_gst = (target_final_inc_gst - qbcc_amount).round(2)
    end

    contract_ex_gst = (contract_inc_gst / 1.10).round(2)

    if subtotal_with_charges > 0
      required_margin = ((contract_ex_gst / subtotal_with_charges - 1) * 100).round(4)
    else
      required_margin = 0.0
    end

    {
      required_margin_percent: required_margin.round(2),
      subtotal_with_charges: subtotal_with_charges,
      contract_ex_gst: contract_ex_gst,
      contract_inc_gst: contract_inc_gst,
      qbcc_amount: qbcc_amount.round(2),
      final_contract_inc_gst: (contract_inc_gst + qbcc_amount).round(2)
    }
  end

  # Sync charge amounts to linked Purchase Orders.
  #
  # For each charge with a purchase_order_id, finds or creates a line item
  # prefixed with "[Charge]" and sets its unit_price to the effective amount.
  # Skips POs that are cancelled or paid.
  def sync_charge_purchase_orders(calculated_charges)
    calculated_charges.each do |_type, charge_data|
      po_id = charge_data[:purchase_order_id]
      next unless po_id

      po = PurchaseOrder.find_by(id: po_id)
      next unless po
      next if po.cancelled? || po.paid?

      label = JobMarkupCharge::LABELS[charge_data[:charge_type]] || charge_data[:charge_type].humanize
      description = "[Charge] #{label}"
      amount = charge_data[:effective_amount].to_f

      line_item = po.line_items.find_by(description: description)
      line_item ||= po.line_items.build(
        description: description,
        line_number: (po.line_items.maximum(:line_number) || 0) + 1,
        gst_code: "GST"
      )

      line_item.quantity = 1
      line_item.unit_price = amount
      line_item.save!

      # Trigger PO totals recalculation
      po.save!
    end
  end

  private

  def calc_charge(type, basis:, default_rate:)
    charge_record = existing_charges[type.to_s]
    rate = charge_record&.rate_percent || default_rate || 0
    override = charge_record&.override_amount
    using_override = override.present? && override > 0

    calculated = (basis * rate / 100.0).round(2)
    effective = using_override ? override : calculated

    {
      charge_type: type.to_s,
      rate_percent: rate.to_f,
      override_amount: override&.to_f,
      calculated_amount: calculated,
      effective_amount: effective.to_f,
      basis_value: basis.to_f,
      using_override: using_override,
      purchase_order_id: charge_record&.purchase_order_id,
      purchase_order_number: charge_record&.purchase_order&.purchase_order_number
    }
  end

  def calc_qbcc_charge(insurable_value, minimum_threshold)
    charge_record = existing_charges["qbcc_insurance"]
    override = charge_record&.override_amount
    using_override = override.present? && override > 0

    # Look up from bracket table
    calculated = if insurable_value >= minimum_threshold
                   QbccPremiumBracket.lookup_premium(insurable_value)
                 else
                   0.0
                 end

    effective = using_override ? override : calculated

    {
      charge_type: "qbcc_insurance",
      rate_percent: nil,
      override_amount: override&.to_f,
      calculated_amount: calculated.to_f,
      effective_amount: effective.to_f,
      basis_value: insurable_value.to_f,
      using_override: using_override,
      purchase_order_id: charge_record&.purchase_order_id,
      purchase_order_number: charge_record&.purchase_order&.purchase_order_number
    }
  end

  # Map charge type → SmScheduleMasterTemplate FK column for the linked SM template task
  CHARGE_SM_FIELDS = {
    "construction_insurance" => :charge_construction_insurance_sm_id,
    "qleave" => :charge_qleave_sm_id,
    "overheads" => :charge_overheads_sm_id,
    "qbcc_insurance" => :charge_qbcc_insurance_sm_id
  }.freeze

  # Auto-link charges to POs by finding the job's SmTask that was copied from
  # the SM template task configured on the job's template.
  # Only sets PO if the charge doesn't already have one (won't override manual selection).
  def auto_link_charge_pos(charges)
    return unless @template

    charges.each do |type, data|
      # Skip if charge already has a PO linked (manual selection takes precedence)
      next if data[:purchase_order_id].present?

      sm_field = CHARGE_SM_FIELDS[type.to_s]
      next unless sm_field

      template_sm_id = @template.send(sm_field)
      next unless template_sm_id

      # Find the SmTask on this job that was copied from the template task
      sm_task = job.sm_tasks.find_by(sm_schedule_master_id: template_sm_id)
      next unless sm_task&.purchase_order_id

      # Update the charge record with the PO link
      charge_record = job.job_markup_charges.find_or_initialize_by(charge_type: type.to_s)
      charge_record.purchase_order_id = sm_task.purchase_order_id
      charge_record.tenant_id = job.tenant_id
      charge_record.save!

      # Update the in-memory hash so sync_charge_purchase_orders sees it
      data[:purchase_order_id] = sm_task.purchase_order_id
      data[:purchase_order_number] = sm_task.purchase_order&.purchase_order_number
    end
  end

  def existing_charges
    @existing_charges ||= job.job_markup_charges
                             .includes(:purchase_order)
                             .index_by(&:charge_type)
  end

  def persist_charges(charges)
    charges.each do |type, data|
      record = job.job_markup_charges.find_or_initialize_by(charge_type: type.to_s)
      record.assign_attributes(
        rate_percent: data[:rate_percent],
        calculated_amount: data[:calculated_amount],
        basis_value: data[:basis_value],
        tenant_id: job.tenant_id
      )
      record.save!
    end
  end
end
