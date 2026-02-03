class EmailParserService
  # Parse email content and extract relevant information
  # This service handles parsing of email data from various sources
  # (e.g., forwarded emails, email webhooks, IMAP, etc.)

  def initialize(email_data)
    @email_data = email_data
  end

  def parse
    {
      from_email: extract_from_email,
      to_emails: extract_to_emails,
      cc_emails: extract_cc_emails,
      bcc_emails: extract_bcc_emails,
      subject: extract_subject,
      body_text: extract_body_text,
      body_html: extract_body_html,
      message_id: extract_message_id,
      in_reply_to: extract_in_reply_to,
      references: extract_references,
      received_at: extract_received_at,
      has_attachments: has_attachments?,
      attachment_count: count_attachments,
      raw_email: @email_data.to_s
    }
  end

  # Try to match email to a construction job based on various criteria
  def match_construction
    # Strategy 1: Look for job number or reference in subject
    job_reference = extract_job_reference_from_subject
    return Job.find_by(id: job_reference) if job_reference

    # Strategy 2: Look for job number in body
    job_reference = extract_job_reference_from_body
    return Job.find_by(id: job_reference) if job_reference

    # Strategy 3: Match by sender email to contact/supplier
    construction_from_sender = match_by_sender_email
    return construction_from_sender if construction_from_sender

    # Strategy 4: Look for address in email content
    construction_from_address = match_by_address
    return construction_from_address if construction_from_address

    nil
  end

  private

  def extract_from_email
    if @email_data.is_a?(Hash)
      @email_data[:from] || @email_data["from"]
    elsif @email_data.respond_to?(:from)
      @email_data.from.first
    else
      nil
    end
  end

  def extract_to_emails
    emails = if @email_data.is_a?(Hash)
      @email_data[:to] || @email_data["to"]
    elsif @email_data.respond_to?(:to)
      @email_data.to
    else
      []
    end
    Array(emails)
  end

  def extract_cc_emails
    emails = if @email_data.is_a?(Hash)
      @email_data[:cc] || @email_data["cc"]
    elsif @email_data.respond_to?(:cc)
      @email_data.cc
    else
      []
    end
    Array(emails)
  end

  def extract_bcc_emails
    emails = if @email_data.is_a?(Hash)
      @email_data[:bcc] || @email_data["bcc"]
    elsif @email_data.respond_to?(:bcc)
      @email_data.bcc
    else
      []
    end
    Array(emails)
  end

  def extract_subject
    if @email_data.is_a?(Hash)
      @email_data[:subject] || @email_data["subject"]
    elsif @email_data.respond_to?(:subject)
      @email_data.subject
    else
      nil
    end
  end

  def extract_body_text
    if @email_data.is_a?(Hash)
      @email_data[:text_body] || @email_data["text_body"] || @email_data[:body_text] || @email_data["body_text"]
    elsif @email_data.respond_to?(:text_part)
      @email_data.text_part&.decoded
    elsif @email_data.respond_to?(:body)
      @email_data.body.to_s
    else
      nil
    end
  end

  def extract_body_html
    if @email_data.is_a?(Hash)
      @email_data[:html_body] || @email_data["html_body"] || @email_data[:body_html] || @email_data["body_html"]
    elsif @email_data.respond_to?(:html_part)
      @email_data.html_part&.decoded
    else
      nil
    end
  end

  def extract_message_id
    if @email_data.is_a?(Hash)
      @email_data[:message_id] || @email_data["message_id"]
    elsif @email_data.respond_to?(:message_id)
      @email_data.message_id
    else
      nil
    end
  end

  def extract_in_reply_to
    if @email_data.is_a?(Hash)
      @email_data[:in_reply_to] || @email_data["in_reply_to"]
    elsif @email_data.respond_to?(:in_reply_to)
      @email_data.in_reply_to
    else
      nil
    end
  end

  def extract_references
    refs = if @email_data.is_a?(Hash)
      @email_data[:references] || @email_data["references"]
    elsif @email_data.respond_to?(:references)
      @email_data.references
    else
      []
    end
    Array(refs)
  end

  def extract_received_at
    if @email_data.is_a?(Hash)
      date = @email_data[:date] || @email_data["date"] || @email_data[:received_at] || @email_data["received_at"]
      date.is_a?(String) ? Time.parse(date) : date
    elsif @email_data.respond_to?(:date)
      @email_data.date
    else
      Time.current
    end
  rescue ArgumentError
    Time.current
  end

  def has_attachments?
    attachment_count > 0
  end

  def count_attachments
    if @email_data.is_a?(Hash)
      attachments = @email_data[:attachments] || @email_data["attachments"] || []
      Array(attachments).size
    elsif @email_data.respond_to?(:attachments)
      @email_data.attachments.size
    else
      0
    end
  end

  # Extract job reference from subject line
  # Looks for patterns like: "Job #123", "JOB-123", "Construction 123", etc.
  def extract_job_reference_from_subject
    subject = extract_subject
    return nil unless subject

    # Match patterns: Job #123, JOB-123, Job 123, etc.
    matches = subject.scan(/(?:job|construction|project)[:\s#-]*(\d+)/i)
    matches.first&.first&.to_i
  end

  # Extract job reference from email body
  def extract_job_reference_from_body
    body = extract_body_text || extract_body_html
    return nil unless body

    # Match patterns in body
    matches = body.scan(/(?:job|construction|project)[:\s#-]*(\d+)/i)
    matches.first&.first&.to_i
  end

  # Match construction by sender's email address
  # Look for contacts/suppliers associated with this email
  def match_by_sender_email
    from_email = extract_from_email
    return nil unless from_email

    # Find contact with this email
    contact = Contact.find_by(email: from_email)
    return nil unless contact

    # Find recent constructions associated with this contact
    # (via purchase orders from suppliers linked to this contact)
    if contact.supplier_id
      recent_po = PurchaseOrder.where(supplier_id: contact.supplier_id)
                              .order(created_at: :desc)
                              .first
      recent_po&.job
    end
  end

  # Match job by address mentioned in email
  def match_by_address
    body = [ extract_subject, extract_body_text, extract_body_html ].compact.join(" ")
    return nil if body.blank?

    # Find jobs and check if their title/address appears in email
    Job.active.find_each do |construction|
      next if construction.title.blank?

      # Simple substring match (could be improved with fuzzy matching)
      return construction if body.downcase.include?(construction.title.downcase)
    end

    nil
  end
end
