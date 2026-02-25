# frozen_string_literal: true

# CustomQuoteRfqAdapter - Wraps CustomQuoteSupplier to work with RfqSendingService
#
# RfqSendingService expects a "tracker" object with specific methods.
# This adapter wraps a CustomQuoteSupplier to provide that interface,
# so we can reuse the existing email sending infrastructure.
#
# Usage:
#   adapted = CustomQuoteRfqAdapter.wrap(custom_quote_supplier)
#   RfqSendingService.send_rfq(tracker: adapted, user: current_user, ...)
#
#   # Or for bulk:
#   adapted_list = suppliers.map { |s| CustomQuoteRfqAdapter.wrap(s) }
#   RfqSendingService.send_bulk(trackers: adapted_list, user: current_user, ...)
#
class CustomQuoteRfqAdapter
  attr_reader :custom_quote_supplier

  delegate :id, :supplier, :supplier_id, :contact_person, :contact_email,
           :status, :email_message_id, :sent_at, :sent_by, :sent_by_id,
           to: :custom_quote_supplier

  def self.wrap(custom_quote_supplier)
    new(custom_quote_supplier)
  end

  def initialize(custom_quote_supplier)
    @custom_quote_supplier = custom_quote_supplier
  end

  # --- RfqSendingService expects these methods ---

  def job
    custom_quote_supplier.custom_quote_line.custom_quote.job
  end

  def task_name
    custom_quote_supplier.custom_quote_line.name
  end

  # RfqSendingService calls tracker.contact to get ContactPerson
  def contact
    custom_quote_supplier.contact_person
  end

  # RfqSendingService calls tracker.update! to mark as sent
  def update!(attrs)
    mapped = {}
    mapped[:status] = attrs[:status] if attrs.key?(:status)
    mapped[:sent_at] = attrs[:sent_at] if attrs.key?(:sent_at)
    mapped[:sent_by] = attrs[:sent_by] if attrs.key?(:sent_by)
    mapped[:email_message_id] = attrs[:email_message_id] if attrs.key?(:email_message_id)

    if attrs[:sent_at].present? && !mapped.key?(:date_sent)
      mapped[:date_sent] = attrs[:sent_at].to_date
    end

    custom_quote_supplier.update!(mapped)
  end

  # RfqSendingService reads tracker.quote_request_instructions
  def quote_request_instructions
    custom_quote_supplier.custom_quote_line.rfq_instructions
  end

  # SmScheduleMaster (for template context)
  def sm_schedule_master
    custom_quote_supplier.custom_quote_line.sm_schedule_master
  end

  def sm_schedule_master_id
    custom_quote_supplier.custom_quote_line.sm_schedule_master_id
  end

  def sm_task
    custom_quote_supplier.custom_quote_line.sm_task
  end

  def sm_trade
    nil # Custom quotes don't use legacy trades
  end

  def sm_trade_id
    nil
  end

  def quote_template
    nil
  end

  def quote_number
    custom_quote_supplier.quote_number
  end
end
