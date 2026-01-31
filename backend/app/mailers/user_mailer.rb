class UserMailer < ApplicationMailer
  def welcome_email(user, temp_password)
    @user = user
    @temp_password = temp_password
    @login_url = frontend_url("/login")

    mail(
      to: @user.email,
      subject: "Welcome to TEEEM - Your Account Has Been Created"
    )
  end

  # Invitation email sent to prospects to start a free trial
  def trial_invitation_email(invitation)
    @invitation = invitation
    @signup_url = invitation.signup_url
    @expires_at = invitation.expires_at
    @invited_by = invitation.invited_by

    mail(
      to: invitation.email,
      subject: "You're invited to try TEEEM free for 30 days"
    )
  end

  # Welcome email for new trial users (includes trial info)
  def trial_welcome_email(user, temp_password, tenant)
    @user = user
    @temp_password = temp_password
    @tenant = tenant
    @trial_ends_at = tenant.trial_ends_at
    @trial_days = tenant.trial_days || 30
    @login_url = frontend_url("/login")
    @onboarding_url = frontend_url("/onboarding")

    mail(
      to: user.email,
      subject: "Welcome to TEEEM - Your #{@trial_days}-Day Trial Has Started!"
    )
  end

  # Reminder email sent X days before trial expires
  def trial_reminder_email(user, tenant, days_remaining)
    @user = user
    @tenant = tenant
    @days_remaining = days_remaining
    @trial_ends_at = tenant.trial_ends_at
    @upgrade_url = frontend_url("/upgrade")

    subject = days_remaining == 1 ?
      "Your TEEEM trial expires tomorrow!" :
      "#{days_remaining} days left on your TEEEM trial"

    mail(to: user.email, subject: subject)
  end

  # Email sent when trial has expired
  def trial_expired_email(user, tenant)
    @user = user
    @tenant = tenant
    @upgrade_url = frontend_url("/upgrade")

    mail(
      to: user.email,
      subject: "Your TEEEM trial has ended - Upgrade to continue"
    )
  end

  private

  def frontend_url(path = "")
    base = ENV["FRONTEND_URL"] || "http://localhost:3000"
    "#{base}#{path}"
  end
end
