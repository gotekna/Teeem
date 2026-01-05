# EmailJobMatcherJob - Scan warehouse for emails matching a job
#
# Triggered when:
# - Job is created (scans by address/name)
# - JobContact is added (scans by contact email)
#
# This is the REVERSE flow of email sync:
# - Email sync: Email arrives → Find matching job
# - This job: Job created → Find matching emails in warehouse
#
class EmailJobMatcherJob < ApplicationJob
  queue_as :default

  def perform(job_id, trigger:, contact_email: nil)
    job = Job.find_by(id: job_id)
    return unless job

    case trigger
    when :job_created
      match_emails_by_address(job)
    when :contact_added
      match_emails_by_contact(job, contact_email) if contact_email.present?
    end
  end

  private

  # Match unassigned emails that mention this job's address/name
  def match_emails_by_address(job)
    return unless job.name.present?

    # Get search terms for this job
    search_terms = job.job_address_searches.pluck(:search_term)
    return if search_terms.empty?

    # Find unassigned emails from last 90 days that match
    unassigned_emails = EmailWarehouse
      .where(job_id: nil)
      .where("received_at > ?", 90.days.ago)

    matched_count = 0
    unassigned_emails.find_each do |email|
      next unless email.subject.present?

      subject_lower = email.subject.downcase

      # Check if subject contains any of our search terms
      matching_term = search_terms.find { |term| subject_lower.include?(term) }

      if matching_term
        email.update!(
          job_id: job.id,
          match_type: "auto_reverse",
          match_confidence: 0.7,
          matched_at: Time.current
        )
        matched_count += 1
        Rails.logger.info "[EmailJobMatcherJob] Linked email #{email.id} to job #{job.id} via '#{matching_term}'"
      end
    end

    Rails.logger.info "[EmailJobMatcherJob] Matched #{matched_count} emails to job #{job.id} by address"
  end

  # Match unassigned emails from/to a specific contact email
  def match_emails_by_contact(job, contact_email)
    email_lower = contact_email.downcase

    # Find unassigned emails involving this contact from last 90 days
    unassigned_emails = EmailWarehouse
      .where(job_id: nil)
      .where("received_at > ?", 90.days.ago)
      .where(
        "LOWER(from_email) = :email OR :email = ANY(LOWER(to_emails::text)::text[]) OR :email = ANY(LOWER(cc_emails::text)::text[])",
        email: email_lower
      )

    matched_count = 0
    unassigned_emails.find_each do |email|
      # Check if email mentions job context (address, job number, etc.)
      next unless email.email_mentions_job_context?(job)

      email.update!(
        job_id: job.id,
        match_type: "auto_reverse_contact",
        match_confidence: 0.75,
        matched_at: Time.current
      )
      matched_count += 1
      Rails.logger.info "[EmailJobMatcherJob] Linked email #{email.id} to job #{job.id} via contact #{contact_email}"
    end

    Rails.logger.info "[EmailJobMatcherJob] Matched #{matched_count} emails to job #{job.id} by contact #{contact_email}"
  end
end
