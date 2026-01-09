# Background job for automatically linking all emails from a contact to a case
# Triggered when include_all_emails flag is toggled on a CaseContact
class AutoLinkContactEmailsJob < ApplicationJob
  queue_as :default

  def perform(case_contact_id)
    case_contact = CaseContact.find_by(id: case_contact_id)
    return unless case_contact

    service = AutoLinkContactEmailsService.new(case_contact)

    if case_contact.include_all_emails?
      service.link_all_emails
    else
      # If flag was turned off, unlink auto-linked emails
      service.unlink_auto_linked_emails
    end
  end
end
