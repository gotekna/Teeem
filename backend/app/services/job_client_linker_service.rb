# Service to automatically link clients to jobs based on invoice contacts
# A "client" is the contact who appears on sales invoices for a job
class JobClientLinkerService
  attr_reader :stats

  def initialize
    @stats = {
      jobs_processed: 0,
      clients_linked: 0,
      already_linked: 0,
      no_invoices: 0,
      no_contact: 0,
      errors: []
    }
  end

  # Link clients to all jobs based on their invoices
  def link_all_jobs
    Job.find_each do |job|
      link_client_to_job(job)
    end

    @stats
  end

  # Link client to a specific job based on invoices
  def link_client_to_job(job)
    @stats[:jobs_processed] += 1

    # Get sales invoices for this job that have a contact linked
    sales_invoices = ExternalInvoice.where(job_id: job.id)
                                    .sales_invoices
                                    .where.not(contact_id: nil)

    if sales_invoices.empty?
      @stats[:no_invoices] += 1
      return nil
    end

    # Find the most common contact (client) from invoices
    # Group by contact_id and count, pick the one with most invoices
    contact_counts = sales_invoices.group(:contact_id).count
    primary_client_id = contact_counts.max_by { |_, count| count }&.first

    unless primary_client_id
      @stats[:no_contact] += 1
      return nil
    end

    contact = Contact.find_by(id: primary_client_id)
    unless contact
      @stats[:no_contact] += 1
      return nil
    end

    # Check if already linked as client
    existing_link = JobContact.find_by(job_id: job.id, contact_id: contact.id, role: "client")
    if existing_link
      @stats[:already_linked] += 1
      return existing_link
    end

    # Create the job_contact link with role 'client'
    job_contact = JobContact.new(
      job_id: job.id,
      contact_id: contact.id,
      role: "client",
      primary: !job.job_contacts.primary.exists? # Make primary if no primary exists
    )

    if job_contact.save
      @stats[:clients_linked] += 1
      Rails.logger.info "Linked client '#{contact.display_name}' to job '#{job.title}'"
      job_contact
    else
      error_msg = "Failed to link client to job #{job.id}: #{job_contact.errors.full_messages.join(', ')}"
      @stats[:errors] << error_msg
      Rails.logger.error error_msg
      nil
    end
  rescue StandardError => e
    error_msg = "Error linking client to job #{job.id}: #{e.message}"
    @stats[:errors] << error_msg
    Rails.logger.error error_msg
    nil
  end

  # Get suggested client for a job (without saving)
  def suggest_client_for_job(job)
    sales_invoices = ExternalInvoice.where(job_id: job.id)
                                    .sales_invoices
                                    .where.not(contact_id: nil)

    return nil if sales_invoices.empty?

    # Group by contact and sum invoice totals
    contact_totals = sales_invoices.group(:contact_id).sum(:total)
    contact_counts = sales_invoices.group(:contact_id).count

    primary_client_id = contact_totals.max_by { |_, total| total }&.first

    return nil unless primary_client_id

    contact = Contact.find_by(id: primary_client_id)
    return nil unless contact

    {
      contact: contact,
      invoice_count: contact_counts[primary_client_id] || 0,
      total_invoiced: contact_totals[primary_client_id] || 0
    }
  end
end
