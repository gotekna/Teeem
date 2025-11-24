class SubcontractorActivationService
  # Activate a subcontractor account for a supplier contact
  def self.activate(contact, invited_by: nil, send_welcome: true)
    unless contact.supplier?
      return { success: false, error: 'Contact must be a supplier' }
    end

    # Check if already has portal access
    existing_portal_user = PortalUser.find_by(contact: contact, portal_type: 'supplier')
    if existing_portal_user
      return { success: false, error: 'Contact already has portal access' }
    end

    ActiveRecord::Base.transaction do
      # Generate temporary password
      temp_password = generate_temporary_password

      # Create portal user
      portal_user = PortalUser.create!(
        contact: contact,
        email: contact.email || generate_placeholder_email(contact),
        password: temp_password,
        portal_type: 'supplier',
        active: true
      )

      # Create subcontractor account
      subcontractor_account = portal_user.create_subcontractor_account!(
        invited_by: invited_by
      )

      # Send welcome email with credentials
      if send_welcome && contact.email.present?
        # TODO: SubcontractorMailer.welcome_email(portal_user, temp_password).deliver_later
      end

      {
        success: true,
        portal_user: portal_user,
        subcontractor_account: subcontractor_account,
        temporary_password: temp_password,
        message: 'Subcontractor account activated successfully'
      }
    end
  rescue ActiveRecord::RecordInvalid => e
    { success: false, error: e.message, errors: e.record.errors.full_messages }
  rescue => e
    { success: false, error: e.message }
  end

  # Bulk activate multiple subcontractors
  def self.bulk_activate(contact_ids, invited_by: nil)
    contacts = Contact.where(id: contact_ids, contact_type: 'supplier')

    results = {
      total: contacts.count,
      activated: 0,
      skipped: 0,
      failed: 0,
      details: []
    }

    contacts.each do |contact|
      result = activate(contact, invited_by: invited_by)

      if result[:success]
        results[:activated] += 1
        results[:details] << {
          contact_id: contact.id,
          contact_name: contact.display_name,
          status: 'activated',
          temporary_password: result[:temporary_password]
        }
      elsif result[:error]&.include?('already has portal access')
        results[:skipped] += 1
        results[:details] << {
          contact_id: contact.id,
          contact_name: contact.display_name,
          status: 'skipped',
          reason: result[:error]
        }
      else
        results[:failed] += 1
        results[:details] << {
          contact_id: contact.id,
          contact_name: contact.display_name,
          status: 'failed',
          error: result[:error]
        }
      end
    end

    results
  end

  # Deactivate a subcontractor account
  def self.deactivate(contact, reason: nil)
    portal_user = PortalUser.find_by(contact: contact, portal_type: 'supplier')

    unless portal_user
      return { success: false, error: 'No portal account found for this contact' }
    end

    ActiveRecord::Base.transaction do
      # Deactivate portal user
      portal_user.deactivate!

      # Deactivate subcontractor account
      subcontractor_account = portal_user.subcontractor_account
      subcontractor_account&.update(active: false)

      # Log deactivation reason
      if reason.present? && subcontractor_account
        metadata = subcontractor_account.metadata || {}
        metadata['deactivation'] = {
          reason: reason,
          deactivated_at: Time.current
        }
        subcontractor_account.update(metadata: metadata)
      end

      # TODO: Send deactivation notification

      {
        success: true,
        message: 'Subcontractor account deactivated'
      }
    end
  rescue => e
    { success: false, error: e.message }
  end

  # Reactivate a deactivated account
  def self.reactivate(contact)
    portal_user = PortalUser.find_by(contact: contact, portal_type: 'supplier')

    unless portal_user
      return { success: false, error: 'No portal account found for this contact' }
    end

    ActiveRecord::Base.transaction do
      portal_user.activate!

      subcontractor_account = portal_user.subcontractor_account
      subcontractor_account&.update(active: true)

      # Log reactivation
      if subcontractor_account
        metadata = subcontractor_account.metadata || {}
        metadata['reactivation'] = {
          reactivated_at: Time.current
        }
        subcontractor_account.update(metadata: metadata)
      end

      # TODO: Send reactivation notification

      {
        success: true,
        message: 'Subcontractor account reactivated'
      }
    end
  rescue => e
    { success: false, error: e.message }
  end

  # Send password reset instructions
  def self.send_password_reset(email)
    portal_user = PortalUser.find_by(email: email, portal_type: 'supplier')

    unless portal_user
      return { success: false, error: 'No account found with that email' }
    end

    unless portal_user.active?
      return { success: false, error: 'Account is not active' }
    end

    token = portal_user.generate_reset_token!

    # TODO: SubcontractorMailer.password_reset_email(portal_user, token).deliver_later

    {
      success: true,
      message: 'Password reset instructions sent',
      reset_token: token # For testing only, remove in production
    }
  rescue => e
    { success: false, error: e.message }
  end

  # Reset password with token
  def self.reset_password(token, new_password)
    portal_user = PortalUser.find_by(reset_password_token: token, portal_type: 'supplier')

    unless portal_user
      return { success: false, error: 'Invalid reset token' }
    end

    unless portal_user.reset_token_valid?
      return { success: false, error: 'Reset token has expired' }
    end

    if portal_user.update(password: new_password)
      portal_user.clear_reset_token!

      {
        success: true,
        message: 'Password reset successfully'
      }
    else
      {
        success: false,
        error: 'Password reset failed',
        errors: portal_user.errors.full_messages
      }
    end
  rescue => e
    { success: false, error: e.message }
  end

  # Upgrade account tier (free -> paid)
  def self.upgrade_tier(subcontractor_account, new_tier, payment_details: nil)
    unless SubcontractorAccount::ACCOUNT_TIERS.include?(new_tier)
      return { success: false, error: 'Invalid account tier' }
    end

    old_tier = subcontractor_account.account_tier

    if subcontractor_account.update(account_tier: new_tier)
      # Log tier change
      metadata = subcontractor_account.metadata || {}
      metadata['tier_changes'] ||= []
      metadata['tier_changes'] << {
        from: old_tier,
        to: new_tier,
        changed_at: Time.current,
        payment_details: payment_details
      }
      subcontractor_account.update(metadata: metadata)

      # TODO: Send upgrade confirmation email

      {
        success: true,
        message: "Account upgraded to #{new_tier}",
        old_tier: old_tier,
        new_tier: new_tier
      }
    else
      {
        success: false,
        error: 'Failed to upgrade account',
        errors: subcontractor_account.errors.full_messages
      }
    end
  end

  # Get activation statistics
  def self.statistics
    total_suppliers = Contact.where(contact_type: 'supplier').count
    activated_suppliers = PortalUser.where(portal_type: 'supplier').count
    active_accounts = SubcontractorAccount.where(active: true).count
    accounts_with_accounting = SubcontractorAccount.where(accounting_system_connected: true).count

    {
      total_suppliers: total_suppliers,
      activated_suppliers: activated_suppliers,
      activation_rate: total_suppliers.zero? ? 0 : (activated_suppliers.to_f / total_suppliers * 100).round(2),
      active_accounts: active_accounts,
      inactive_accounts: activated_suppliers - active_accounts,
      accounts_with_accounting: accounts_with_accounting,
      accounting_connection_rate: activated_suppliers.zero? ? 0 : (accounts_with_accounting.to_f / activated_suppliers * 100).round(2),
      tier_breakdown: SubcontractorAccount.group(:account_tier).count,
      average_kudos_score: SubcontractorAccount.where(active: true).average(:kudos_score)&.round(2) || 0,
      recent_activations: PortalUser.where(portal_type: 'supplier')
                                   .order(created_at: :desc)
                                   .limit(10)
                                   .map { |pu| activation_summary(pu) }
    }
  end

  # Send invitation to join portal
  def self.send_invitation(contact, invited_by: nil)
    unless contact.supplier?
      return { success: false, error: 'Contact must be a supplier' }
    end

    unless contact.email.present?
      return { success: false, error: 'Contact must have an email address' }
    end

    # Check if already activated
    if PortalUser.exists?(contact: contact, portal_type: 'supplier')
      return { success: false, error: 'Contact already has portal access' }
    end

    # Generate invitation token
    invitation_token = SecureRandom.urlsafe_base64(32)

    # Store invitation in contact metadata
    metadata = contact.metadata || {}
    metadata['portal_invitation'] = {
      token: invitation_token,
      invited_by_id: invited_by&.id,
      invited_at: Time.current,
      expires_at: 7.days.from_now
    }
    contact.update(metadata: metadata)

    # TODO: SubcontractorMailer.invitation_email(contact, invitation_token, invited_by).deliver_later

    {
      success: true,
      message: 'Invitation sent',
      invitation_token: invitation_token,
      expires_at: 7.days.from_now
    }
  rescue => e
    { success: false, error: e.message }
  end

  # Accept invitation and create account
  def self.accept_invitation(invitation_token, password)
    contact = Contact.where("metadata->>'portal_invitation' LIKE ?", "%#{invitation_token}%").first

    unless contact
      return { success: false, error: 'Invalid invitation token' }
    end

    invitation_data = contact.metadata&.dig('portal_invitation')
    unless invitation_data && invitation_data['expires_at'] && Time.parse(invitation_data['expires_at']) > Time.current
      return { success: false, error: 'Invitation has expired' }
    end

    # Activate account
    invited_by = User.find_by(id: invitation_data['invited_by_id'])
    result = activate(contact, invited_by: invited_by&.contact, send_welcome: false)

    if result[:success]
      # Update password to user's choice
      result[:portal_user].update(password: password)

      # Clear invitation
      metadata = contact.metadata
      metadata.delete('portal_invitation')
      contact.update(metadata: metadata)

      result.merge(message: 'Account activated successfully')
    else
      result
    end
  end

  private

  def self.generate_temporary_password
    # Generate a secure 16-character password
    charset = ('A'..'Z').to_a + ('a'..'z').to_a + ('0'..'9').to_a + ['@', '$', '!', '%', '*', '?', '&']
    password = Array.new(16) { charset.sample }.join

    # Ensure it meets all requirements
    password = "Aa1@" + password[4..-1] if password.length >= 4
    password
  end

  def self.generate_placeholder_email(contact)
    # Generate placeholder email for contacts without email
    sanitized_name = contact.display_name.parameterize
    "#{sanitized_name}@placeholder.trapid.local"
  end

  def self.activation_summary(portal_user)
    {
      id: portal_user.id,
      contact_name: portal_user.contact.display_name,
      company_name: portal_user.contact.company_name,
      email: portal_user.email,
      activated_at: portal_user.created_at,
      active: portal_user.active?,
      account_tier: portal_user.subcontractor_account&.account_tier,
      kudos_score: portal_user.subcontractor_account&.kudos_score
    }
  end
end
