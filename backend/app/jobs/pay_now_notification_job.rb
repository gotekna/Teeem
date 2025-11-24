class PayNowNotificationJob < ApplicationJob
  queue_as :default

  def perform(request_id, notification_type)
    request = PayNowRequest.find_by(id: request_id)

    unless request
      Rails.logger.error "PayNowNotificationJob: PayNowRequest #{request_id} not found"
      return
    end

    case notification_type
    when 'submitted'
      notify_supervisors(request)
    when 'approved'
      notify_supplier_approved(request)
    when 'rejected'
      notify_supplier_rejected(request)
    when 'paid'
      notify_supplier_paid(request)
    else
      Rails.logger.warn "PayNowNotificationJob: Unknown notification type '#{notification_type}'"
    end
  rescue StandardError => e
    Rails.logger.error "PayNowNotificationJob failed for request #{request_id}: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    raise
  end

  private

  def notify_supervisors(request)
    # Get all supervisors and builders
    supervisors = User.where(role: ['supervisor', 'builder', 'admin'])

    supervisors.each do |supervisor|
      PayNowMailer.supervisor_review_needed(request, supervisor).deliver_now
    end

    Rails.logger.info "PayNowNotificationJob: Notified #{supervisors.count} supervisors about request ##{request.id}"
  end

  def notify_supplier_approved(request)
    supplier_email = request.contact.email || request.requested_by_portal_user&.email

    if supplier_email.present?
      PayNowMailer.request_approved(request, supplier_email).deliver_now
      Rails.logger.info "PayNowNotificationJob: Notified supplier about approval for request ##{request.id}"
    else
      Rails.logger.warn "PayNowNotificationJob: No email found for supplier on request ##{request.id}"
    end
  end

  def notify_supplier_rejected(request)
    supplier_email = request.contact.email || request.requested_by_portal_user&.email

    if supplier_email.present?
      PayNowMailer.request_rejected(request, supplier_email).deliver_now
      Rails.logger.info "PayNowNotificationJob: Notified supplier about rejection for request ##{request.id}"
    else
      Rails.logger.warn "PayNowNotificationJob: No email found for supplier on request ##{request.id}"
    end
  end

  def notify_supplier_paid(request)
    supplier_email = request.contact.email || request.requested_by_portal_user&.email

    if supplier_email.present?
      PayNowMailer.payment_completed(request, supplier_email).deliver_now
      Rails.logger.info "PayNowNotificationJob: Notified supplier about payment for request ##{request.id}"
    else
      Rails.logger.warn "PayNowNotificationJob: No email found for supplier on request ##{request.id}"
    end
  end
end
