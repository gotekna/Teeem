# Sync newtask emails and create tasks
mc = MicrosoftCredential.first
client = MicrosoftAppGraphClient.new(mc)

# Sync the newtask inbox to warehouse
folders = client.get_user_mail_folders("newtask@tekna.com.au")
inbox = folders.find { |f| f[:name] == "Inbox" }

emails = client.get_user_emails("newtask@tekna.com.au", folder: inbox[:id], top: 10, since: 7.days.ago)
puts "Found #{emails.count} emails to sync"

emails.each do |email_data|
  internet_message_id = email_data["internetMessageId"] || email_data["id"]

  email = EmailWarehouse.find_or_initialize_by(internet_message_id: internet_message_id)

  from_data = email_data["from"]&.dig("emailAddress") || {}
  to_emails = (email_data["toRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact
  cc_emails = (email_data["ccRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact

  body_data = email_data["body"] || {}
  body_content = body_data["content"]

  email.assign_attributes(
    outlook_id: email_data["id"],
    subject: email_data["subject"],
    from_email: from_data["address"],
    from_name: from_data["name"],
    to_emails: to_emails,
    cc_emails: cc_emails,
    received_at: email_data["receivedDateTime"],
    sent_at: email_data["sentDateTime"],
    has_attachments: email_data["hasAttachments"] || false,
    body_preview: email_data["bodyPreview"],
    body_text: body_content,
    conversation_id: email_data["conversationId"],
    folder_name: "Inbox",
    is_read: email_data["isRead"] || false,
    importance: email_data["importance"],
    last_synced_at: Time.current,
    microsoft_credential_id: mc.id,
    mailbox_owner_email: "newtask@tekna.com.au"
  )
  email.first_synced_at ||= Time.current
  email.save!
  puts "Synced: #{email.subject} from #{email.from_email}"
end

# Now run the ProcessNewTaskEmailsJob
puts ""
puts "Running ProcessNewTaskEmailsJob..."
ProcessNewTaskEmailsJob.perform_now
puts "Done!"

# Check for new tasks
puts ""
puts "Recent tasks:"
SmTask.order(created_at: :desc).limit(5).each do |t|
  puts "  ##{t.id}: #{t.name} (created #{t.created_at})"
end
