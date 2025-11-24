class PayNowMailer < ApplicationMailer
  default from: 'noreply@trapid.app'

  # Sent to supervisors when a new Pay Now request is submitted
  def supervisor_review_needed(request, supervisor)
    @request = request
    @supervisor = supervisor
    @purchase_order = request.purchase_order
    @supplier = request.contact
    @construction = @purchase_order.construction

    mail(
      to: supervisor.email,
      subject: "New Pay Now Request - #{@supplier.full_name} - PO ##{@purchase_order.purchase_order_number}"
    )
  end

  # Sent to supplier when their request is approved
  def request_approved(request, supplier_email)
    @request = request
    @purchase_order = request.purchase_order
    @supplier = request.contact
    @payment = request.payment

    mail(
      to: supplier_email,
      subject: "Pay Now Request Approved - PO ##{@purchase_order.purchase_order_number}"
    )
  end

  # Sent to supplier when their request is rejected
  def request_rejected(request, supplier_email)
    @request = request
    @purchase_order = request.purchase_order
    @supplier = request.contact
    @rejection_reason = request.rejection_reason

    mail(
      to: supplier_email,
      subject: "Pay Now Request Declined - PO ##{@purchase_order.purchase_order_number}"
    )
  end

  # Sent to supplier when payment is completed
  def payment_completed(request, supplier_email)
    @request = request
    @purchase_order = request.purchase_order
    @supplier = request.contact
    @payment = request.payment

    mail(
      to: supplier_email,
      subject: "Payment Processed - PO ##{@purchase_order.purchase_order_number}"
    )
  end

  # Sent to builder when weekly limit is reached
  def weekly_limit_reached(weekly_limit, builder_email)
    @weekly_limit = weekly_limit
    @requests_this_week = PayNowRequest.for_week(weekly_limit.week_start_date)

    mail(
      to: builder_email,
      subject: "Pay Now Weekly Limit Reached - #{weekly_limit.formatted_total_limit}"
    )
  end

  # Sent to builder when weekly limit is close to being reached (e.g., 80%)
  def weekly_limit_warning(weekly_limit, builder_email)
    @weekly_limit = weekly_limit
    @requests_this_week = PayNowRequest.for_week(weekly_limit.week_start_date)

    mail(
      to: builder_email,
      subject: "Pay Now Weekly Limit Warning - #{weekly_limit.utilization_percentage}% Used"
    )
  end
end
