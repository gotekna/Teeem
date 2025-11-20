class QuoteRequestService
  # Creates a quote request and sends to suppliers
  def self.create_and_send(quote_request_params, supplier_contact_ids, created_by_user)
    quote_request = QuoteRequest.new(quote_request_params)
    quote_request.created_by = created_by_user

    ActiveRecord::Base.transaction do
      unless quote_request.save
        return { success: false, errors: quote_request.errors.full_messages }
      end

      # Send to suppliers
      if supplier_contact_ids.present?
        result = send_to_suppliers(quote_request, supplier_contact_ids)
        unless result[:success]
          raise ActiveRecord::Rollback
        end
      end

      { success: true, quote_request: quote_request }
    end
  end

  # Send quote request to additional suppliers
  def self.send_to_suppliers(quote_request, contact_ids)
    contact_ids = Array(contact_ids).map(&:to_i)

    # Validate all contacts exist and are suppliers
    contacts = Contact.where(id: contact_ids, contact_type: 'supplier')
    if contacts.count != contact_ids.count
      return { success: false, error: 'Some contacts are invalid or not suppliers' }
    end

    # Filter out already invited suppliers
    existing_contact_ids = quote_request.contacts.pluck(:id)
    new_contacts = contacts.where.not(id: existing_contact_ids)

    if new_contacts.empty?
      return { success: false, error: 'All selected suppliers already invited' }
    end

    # Create quote_request_contacts records
    new_contacts.each do |contact|
      quote_request.quote_request_contacts.create!(
        contact: contact,
        notified_at: Time.current,
        notification_method: 'email' # Will be updated when notification is sent
      )
    end

    # Queue notifications
    # TODO: Enqueue QuoteRequestNotificationJob.perform_later(quote_request.id, new_contacts.pluck(:id))

    { success: true, invited_count: new_contacts.count }
  end

  # Accept a quote and reject others
  def self.accept_quote(quote_request, quote_response)
    unless quote_response.submitted?
      return { success: false, error: 'Can only accept submitted quotes' }
    end

    ActiveRecord::Base.transaction do
      # Mark quote as accepted
      quote_response.accept!

      # Update quote request
      quote_request.update!(
        selected_quote_response: quote_response,
        status: 'closed'
      )

      # Reject all other responses
      quote_request.quote_responses.where.not(id: quote_response.id).each do |other_response|
        other_response.reject! if other_response.submitted? || other_response.pending?
      end

      # TODO: Send notification to winning supplier
      # TODO: Send rejection notifications to other suppliers

      { success: true, quote_request: quote_request, quote_response: quote_response }
    end
  rescue => e
    { success: false, error: e.message }
  end

  # Close quote request without accepting any quote
  def self.close_without_acceptance(quote_request, reason: nil)
    ActiveRecord::Base.transaction do
      quote_request.update!(status: 'closed')

      # Reject all pending/submitted responses
      quote_request.quote_responses.where(status: %w[pending submitted]).each(&:reject!)

      # Log closure reason if provided
      if reason.present?
        metadata = quote_request.metadata || {}
        metadata['closure_reason'] = reason
        metadata['closed_at'] = Time.current
        quote_request.update!(metadata: metadata)
      end

      # TODO: Send notifications to all invited suppliers

      { success: true, quote_request: quote_request }
    end
  rescue => e
    { success: false, error: e.message }
  end

  # Convert accepted quote to purchase order
  def self.convert_to_purchase_order(quote_request, po_params = {})
    unless quote_request.selected_quote_response
      return { success: false, error: 'No quote has been accepted yet' }
    end

    # Check if PO already exists
    existing_po = PurchaseOrder.find_by(quote_response: quote_request.selected_quote_response)
    if existing_po
      return { success: false, error: 'Purchase order already exists', purchase_order: existing_po }
    end

    quote_response = quote_request.selected_quote_response

    # Build PO from quote
    purchase_order = PurchaseOrder.new(
      construction: quote_request.construction,
      contact: quote_response.contact,
      po_number: po_params[:po_number] || generate_po_number,
      total: quote_response.price,
      notes: build_po_notes(quote_request, quote_response, po_params[:notes]),
      status: po_params[:status] || 'pending',
      quote_response: quote_response
    )

    if purchase_order.save
      # TODO: Send PO notification to supplier
      { success: true, purchase_order: purchase_order }
    else
      { success: false, errors: purchase_order.errors.full_messages }
    end
  end

  # Get analytics for quote requests
  def self.analytics(filters = {})
    quote_requests = QuoteRequest.all

    # Apply filters
    if filters[:construction_id]
      quote_requests = quote_requests.where(construction_id: filters[:construction_id])
    end

    if filters[:date_from]
      quote_requests = quote_requests.where('created_at >= ?', filters[:date_from])
    end

    if filters[:date_to]
      quote_requests = quote_requests.where('created_at <= ?', filters[:date_to])
    end

    {
      total_requests: quote_requests.count,
      pending_requests: quote_requests.where(status: 'pending_response').count,
      closed_requests: quote_requests.where(status: 'closed').count,
      requests_with_responses: quote_requests.joins(:quote_responses).distinct.count,
      total_responses: QuoteResponse.where(quote_request: quote_requests).count,
      accepted_quotes: QuoteResponse.where(quote_request: quote_requests, status: 'accepted').count,
      average_responses_per_request: calculate_average_responses(quote_requests),
      average_response_time_hours: calculate_average_response_time(quote_requests),
      average_quote_value: calculate_average_quote_value(quote_requests),
      trade_category_breakdown: trade_category_breakdown(quote_requests),
      supplier_response_rates: supplier_response_rates(quote_requests)
    }
  end

  # Send reminder to suppliers who haven't responded
  def self.send_reminders(quote_request)
    # Find suppliers who were invited but haven't responded
    invited_contact_ids = quote_request.contacts.pluck(:id)
    responded_contact_ids = quote_request.quote_responses.pluck(:contact_id)
    non_responded_contact_ids = invited_contact_ids - responded_contact_ids

    return { success: true, reminder_count: 0 } if non_responded_contact_ids.empty?

    # TODO: Queue reminder notifications
    # QuoteReminderJob.perform_later(quote_request.id, non_responded_contact_ids)

    { success: true, reminder_count: non_responded_contact_ids.count }
  end

  private

  def self.generate_po_number
    last_po = PurchaseOrder.order(created_at: :desc).first
    if last_po && last_po.po_number =~ /PO-(\d+)/
      number = $1.to_i + 1
    else
      number = 1000
    end
    "PO-#{number}"
  end

  def self.build_po_notes(quote_request, quote_response, additional_notes = nil)
    notes = "Created from quote request: #{quote_request.title}\n\n"
    notes += "Trade Category: #{quote_request.trade_category}\n" if quote_request.trade_category
    notes += "Requested Date: #{quote_request.requested_date}\n\n" if quote_request.requested_date
    notes += "Quote Notes:\n#{quote_response.notes}\n\n" if quote_response.notes.present?
    notes += "Additional Notes:\n#{additional_notes}" if additional_notes.present?
    notes
  end

  def self.calculate_average_responses(quote_requests)
    total_responses = QuoteResponse.where(quote_request: quote_requests).count
    return 0 if quote_requests.count.zero?
    (total_responses.to_f / quote_requests.count).round(2)
  end

  def self.calculate_average_response_time(quote_requests)
    responses = QuoteResponse.where(quote_request: quote_requests).where.not(submitted_at: nil)
    return 0 if responses.empty?

    total_hours = responses.sum { |r| r.response_time_hours || 0 }
    (total_hours / responses.count).round(2)
  end

  def self.calculate_average_quote_value(quote_requests)
    responses = QuoteResponse.where(quote_request: quote_requests, status: 'submitted')
    return 0 if responses.empty?
    responses.average(:price)&.round(2) || 0
  end

  def self.trade_category_breakdown(quote_requests)
    quote_requests.group(:trade_category).count
  end

  def self.supplier_response_rates(quote_requests)
    # Get all invited suppliers
    invitations = QuoteRequestContact.where(quote_request: quote_requests)
                                     .group(:contact_id)
                                     .count

    # Get responses
    responses = QuoteResponse.where(quote_request: quote_requests)
                             .where(status: %w[submitted accepted rejected])
                             .group(:contact_id)
                             .count

    # Calculate response rate per supplier
    invitations.map do |contact_id, invitation_count|
      response_count = responses[contact_id] || 0
      response_rate = (response_count.to_f / invitation_count * 100).round(1)

      {
        contact_id: contact_id,
        contact_name: Contact.find(contact_id).display_name,
        invitations: invitation_count,
        responses: response_count,
        response_rate: response_rate
      }
    end.sort_by { |s| -s[:response_rate] }
  end
end
