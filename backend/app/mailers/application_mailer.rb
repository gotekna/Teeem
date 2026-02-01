class ApplicationMailer < ActionMailer::Base
  # From address must match SMTP_USERNAME for PolarisMail authentication
  default from: -> { "TEEEM <#{ENV.fetch('SMTP_USERNAME', 'robert@teeem.com.au')}>" }
  layout "mailer"
end
