# Service for automatically linking all emails from a contact to a case
# Used when include_all_emails flag is enabled on a CaseContact
class AutoLinkContactEmailsService
  def initialize(case_contact)
    @case_contact = case_contact
    @case_record = case_contact.case_record
    @contact = case_contact.contact
  end

  def link_all_emails
    return unless @case_contact.include_all_emails?

    # SSoT: Use primary_email from contact_emails table
    contact_email = @contact.primary_email
    return 0 unless contact_email.present?

    # Find all emails involving this contact
    emails = SyncedEmail.involving_email(contact_email)

    linked_count = 0

    emails.find_each do |email|
      # Skip if email is classified as irrelevant (marketing/spam)
      next if email.classified_as_irrelevant?

      # Skip if already linked
      next if @case_record.case_emails.exists?(email_warehouse_id: email.id)

      # Link email to case
      @case_record.add_email(
        email,
        relevance: "supporting",
        notes: "Auto-linked from #{@contact.display_name || contact_email}",
        added_by: @case_contact.added_by || @case_record.created_by
      )

      # Mark as auto-linked
      case_email = @case_record.case_emails.find_by(email_warehouse_id: email.id)
      case_email.update_columns(
        auto_linked: true,
        auto_linked_via_contact_id: @contact.id
      )

      linked_count += 1
    end

    Rails.logger.info "[AutoLinkEmails] Linked #{linked_count} emails from #{contact_email} to case #{@case_record.id}"
    linked_count
  end

  def unlink_auto_linked_emails
    @case_record.case_emails
      .where(auto_linked: true, auto_linked_via_contact_id: @contact.id)
      .destroy_all
  end
end
