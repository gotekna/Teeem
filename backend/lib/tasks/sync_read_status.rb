require 'net/imap'

cred = ImapCredential.find_by(email_address: 'rachelharder72@gmail.com')
unless cred
  puts 'Credential not found'
  exit
end

puts 'Connecting to Gmail IMAP...'
imap = Net::IMAP.new(cred.imap_host, port: cred.imap_port, ssl: cred.imap_ssl)
imap.login(cred.username, cred.password)
imap.select('INBOX')

# Get all emails from last 90 days
search_criteria = ['SINCE', 90.days.ago.strftime('%d-%b-%Y')]
message_ids = imap.search(search_criteria)
puts "Found #{message_ids.count} emails in Gmail INBOX"

# Fetch just UID, FLAGS, and Message-ID (no body - won't mark as read!)
updated = 0
message_ids.each_slice(100) do |batch|
  fetch_data = imap.fetch(batch, ['UID', 'FLAGS', 'ENVELOPE'])
  fetch_data&.each do |msg|
    envelope = msg.attr['ENVELOPE']
    flags = msg.attr['FLAGS'] || []
    is_read = flags.include?(:Seen)

    message_id = envelope&.message_id&.gsub(/[<>]/, '')
    next unless message_id

    # Find existing email and update is_read if different
    email = SyncedEmail.find_by(internet_message_id: message_id)
    if email && email.is_read != is_read
      email.update_column(:is_read, is_read)
      updated += 1
    end
  end
end

imap.logout
imap.disconnect

puts "Updated is_read status for #{updated} emails"
