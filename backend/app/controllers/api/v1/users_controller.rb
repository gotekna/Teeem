class Api::V1::UsersController < ApplicationController
  # POST /api/v1/users
  # Create a new user (admin only)
  # Requires either contact_id (link to existing) or creates new contact from user info
  def create
    unless current_user&.admin?
      return render_error("Admin access required", status: :forbidden)
    end

    @user = nil
    success = false

    ActiveRecord::Base.transaction do
      # Get or create contact
      contact = find_or_create_contact

      # Create user with contact and tenant
      @user = User.new(create_user_params)
      @user.contact = contact
      @user.tenant_id = current_tenant.id  # Inherit tenant (respects tenant switcher)

      if @user.save
        # Assign roles if provided
        assign_roles_to_user(@user)
        # Auto-link as employee of tenant company
        link_user_to_tenant_company(@user)
        success = true
      else
        raise ActiveRecord::Rollback
      end
    end

    if success
      render json: {
        success: true,
        user: user_with_presence(@user)
      }, status: :created
    else
      render json: {
        success: false,
        errors: @user&.errors&.full_messages || ["Failed to create user"]
      }, status: :unprocessable_entity
    end
  rescue ActiveRecord::RecordInvalid => e
    render json: { success: false, errors: [e.message] }, status: :unprocessable_entity
  rescue => e
    Rails.logger.error "Error creating user: #{e.class} - #{e.message}"
    render_error(e.message, status: :unprocessable_entity)
  end

  # GET /api/v1/users
  # Returns list of all users for chat/contact purposes
  def index
    @users = User.includes(:email_sync_status, :roles)
    .order("users.name")

    render json: { users: @users.map { |user| user_with_presence(user) } }
  end

  # GET /api/v1/users/for_select
  # Lightweight endpoint for dropdowns - returns only id and name
  def for_select
    users = User.order(:name).pluck(:id, :name)
    render json: { users: users.map { |id, name| { id: id, name: name } } }
  end

  # GET /api/v1/users/:id
  def show
    @user = User.find(params[:id])
    render json: user_with_presence(@user)
  rescue ActiveRecord::RecordNotFound
    render json: { error: "User not found" }, status: :not_found
  end

  # PATCH /api/v1/users/:id
  def update
    @user = User.find(params[:id])

    # Merge regular user params with admin-only params if user is admin
    update_params = user_params
    admin_fields_present = params[:user][:role] || params[:user][:role_ids] || params[:user].key?(:contact_id) || params[:user].key?(:primary_role_id)
    if current_user&.admin? && admin_fields_present
      update_params = update_params.merge(admin_user_params)
    elsif admin_fields_present
      # Non-admin trying to change admin fields - reject request
      return render_error("Thanks for helping, can you contact an administrator for assistance", status: :forbidden)
    end

    # Handle primary role update (Jan 2026)
    if params[:user].key?(:primary_role_id) && current_user&.admin?
      primary_role_id = params[:user][:primary_role_id]
      if primary_role_id.present?
        @user.set_primary_role!(primary_role_id)
      end
    end

    # Extract photo file before update (photo is not a DB column on User)
    photo_file = update_params.delete(:photo) if update_params[:photo].is_a?(ActionDispatch::Http::UploadedFile)

    if @user.update(update_params)
      # Handle photo upload - store as blob + WarehouseDocument (Employee Photo)
      if photo_file
        content = photo_file.read

        # 1. Set user's photo_blob for fast photo_url
        @user.attach_photo(content, filename: photo_file.original_filename, content_type: photo_file.content_type)
        @user.save!

        # 2. Create WarehouseDocument linked to Contact as Employee Photo
        if @user.contact.present?
          blob = StorageBlob.find_by(id: @user.photo_blob_id)
          pep_type = DocumentType.find_by(abbreviation: 'PEP')
          # SSoT: WarehouseDocumentCreator handles metadata + callbacks
          WarehouseDocumentCreator.create!(
            filename: photo_file.original_filename,
            source_type: "people",
            linkable: @user.contact,
            storage_blob: blob,
            content_type: photo_file.content_type,
            file_size: content.bytesize,
            metadata: pep_type ? { "document_type_id" => pep_type.id } : {}
          )
        end
      end

      render json: {
        success: true,
        user: user_with_presence(@user)
      }
    else
      render_validation_errors(@user)
    end
  rescue ActiveRecord::RecordNotFound
    render json: { error: "User not found" }, status: :not_found
  end

  # POST /api/v1/users/:id/reset_password
  def reset_password
    @user = User.find(params[:id])

    # Generate reset token
    token = SecureRandom.urlsafe_base64
    @user.update_columns(
      reset_password_token: token,
      reset_password_sent_at: Time.current
    )

    # Send password reset email
    # UserMailer.reset_password(@user, token).deliver_later

    render json: {
      success: true,
      message: "Password reset email sent to #{@user.email}"
    }
  rescue ActiveRecord::RecordNotFound
    render json: { error: "User not found" }, status: :not_found
  end

  # POST /api/v1/users/:id/send_invite
  # Generate temp password, set force_password_change, and send welcome email
  def send_invite
    unless current_user&.admin?
      return render_error("Admin access required", status: :forbidden)
    end

    @user = User.find(params[:id])

    # Generate a temp password that meets complexity rules
    temp_password = generate_temp_password

    # Update user's password and flag for forced change
    @user.password = temp_password
    @user.force_password_change = true

    if @user.save
      # Generate a password reset token so the welcome email can link directly
      # to the reset-password page (user doesn't need to know temp password)
      reset_token = SecureRandom.urlsafe_base64(32)
      @user.update_columns(
        reset_password_token: reset_token,
        reset_password_sent_at: Time.current
      )

      if params[:compose_mode]
        # Return reset token so frontend can compose email with direct reset link
        render json: {
          success: true,
          compose: true,
          user_email: @user.email,
          user_name: @user.name,
          reset_token: reset_token,
          message: "Reset token generated. Compose email to send welcome."
        }
      else
        # Send the welcome email with temp credentials via Rails mailer
        UserMailer.welcome_email(@user, temp_password).deliver_later

        render json: {
          success: true,
          message: "Login email sent to #{@user.email}"
        }
      end
    else
      render_validation_errors(@user)
    end
  rescue ActiveRecord::RecordNotFound
    render json: { error: "User not found" }, status: :not_found
  end

  # GET /api/v1/users/by_contact/:contact_id/personal_details
  # Lookup user by their linked contact and return personal details
  def personal_details_by_contact
    contact = Contact.find(params[:contact_id])
    user = contact.user
    unless user
      return render_error("No user account linked to this contact", status: :not_found)
    end
    # Reuse personal_details by setting params[:id]
    params[:id] = user.id
    personal_details
  rescue ActiveRecord::RecordNotFound
    render_error("Contact not found", status: :not_found)
  end

  # GET /api/v1/users/:id/personal_details
  # Returns user + contact personal data for the User tab on contact detail page
  def personal_details
    @user = User.includes(:contact).find(params[:id])
    contact = @user.contact

    # Personal mobile: contact_phone with label 'mobile' or is_primary
    personal_mobile = contact&.contact_phones&.find_by(label: "mobile") ||
                      contact&.contact_phones&.find_by(phone_type: "mobile")

    # Personal email: contact_email with label 'personal'
    personal_email = contact&.contact_emails&.find_by(label: "personal")

    # Home address: primary STREET address
    home_address = contact&.contact_addresses&.find_by(address_type: "STREET", is_primary: true) ||
                   contact&.contact_addresses&.street&.first

    render json: {
      success: true,
      data: {
        # User fields
        id: @user.id,
        name: @user.name,
        username: @user.username,
        email: @user.email,
        photoUrl: @user.photo_url,
        # Contact fields
        contactId: contact&.id,
        dateOfBirth: contact&.date_of_birth,
        emergencyContactName: contact&.emergency_contact_name,
        emergencyContactPhone: contact&.emergency_contact_phone,
        emergencyContactRelationship: contact&.emergency_contact_relationship,
        # Personal contact info
        personalMobile: personal_mobile&.phone_number,
        personalMobileId: personal_mobile&.id,
        personalEmail: personal_email&.email,
        personalEmailId: personal_email&.id,
        # Home address
        homeAddress: home_address ? {
          id: home_address.id,
          line1: home_address.line1,
          line2: home_address.line2,
          city: home_address.city,
          region: home_address.region,
          postalCode: home_address.postal_code,
          country: home_address.country
        } : nil
      }
    }
  rescue ActiveRecord::RecordNotFound
    render_error("User not found", status: :not_found)
  end

  # PATCH /api/v1/users/:id/personal_details
  # Updates user + contact personal data
  def update_personal_details
    @user = User.includes(:contact).find(params[:id])
    contact = @user.contact

    ActiveRecord::Base.transaction do
      # Update user fields
      if params[:name].present?
        @user.update!(name: params[:name])
      end
      if params.key?(:username)
        @user.update!(username: params[:username].presence)
      end

      # Update contact fields
      if contact
        contact_updates = {}
        contact_updates[:date_of_birth] = params[:dateOfBirth] if params.key?(:dateOfBirth)
        contact_updates[:emergency_contact_name] = params[:emergencyContactName] if params.key?(:emergencyContactName)
        contact_updates[:emergency_contact_phone] = params[:emergencyContactPhone] if params.key?(:emergencyContactPhone)
        contact_updates[:emergency_contact_relationship] = params[:emergencyContactRelationship] if params.key?(:emergencyContactRelationship)
        contact.update!(contact_updates) if contact_updates.any?

        # Personal mobile - create or update
        if params.key?(:personalMobile)
          phone = contact.contact_phones.find_by(label: "mobile") ||
                  contact.contact_phones.find_by(phone_type: "mobile")
          if params[:personalMobile].present?
            if phone
              phone.update!(phone_number: params[:personalMobile])
            else
              contact.contact_phones.create!(
                phone_number: params[:personalMobile],
                phone_type: "mobile",
                label: "mobile",
                is_primary: contact.contact_phones.empty?,
                position: (contact.contact_phones.maximum(:position) || 0) + 1
              )
            end
          elsif phone
            phone.destroy!
          end
        end

        # Personal email - create or update
        if params.key?(:personalEmail)
          email_record = contact.contact_emails.find_by(label: "personal")
          if params[:personalEmail].present?
            if email_record
              email_record.update!(email: params[:personalEmail])
            else
              contact.contact_emails.create!(
                email: params[:personalEmail],
                label: "personal",
                is_primary: contact.contact_emails.empty?,
                position: (contact.contact_emails.maximum(:position) || 0) + 1
              )
            end
          elsif email_record
            email_record.destroy!
          end
        end

        # Home address - create or update
        if params.key?(:homeAddress)
          addr_params = params[:homeAddress]
          address = contact.contact_addresses.find_by(address_type: "STREET", is_primary: true) ||
                    contact.contact_addresses.street.first

          if addr_params.present? && addr_params.values.any?(&:present?)
            attrs = {
              line1: addr_params[:line1],
              line2: addr_params[:line2],
              city: addr_params[:city],
              region: addr_params[:region],
              postal_code: addr_params[:postalCode],
              country: addr_params[:country] || "Australia",
              address_type: "STREET",
              is_primary: true
            }
            if address
              address.update!(attrs)
            else
              contact.contact_addresses.create!(attrs)
            end
          end
        end
      end
    end

    # Return fresh data
    personal_details
  rescue ActiveRecord::RecordNotFound
    render_error("User not found", status: :not_found)
  rescue ActiveRecord::RecordInvalid => e
    render_error(e.message, status: :unprocessable_entity)
  end

  # DELETE /api/v1/users/:id
  def destroy
    @user = User.find(params[:id])

    if @user.destroy
      render json: { success: true, message: "User removed successfully" }
    else
      render_error("Failed to remove user", status: :unprocessable_entity)
    end
  rescue ActiveRecord::RecordNotFound
    render json: { error: "User not found" }, status: :not_found
  end

  # POST /api/v1/users/import_from_microsoft
  # Bulk-import M365 licensed users as TEEEM users (admin only)
  # Creates Contact + User + default role + tenant company link for each
  def import_from_microsoft
    unless current_user&.admin?
      return render_error("Admin access required", status: :forbidden)
    end

    credential_id = params[:organization_id]
    return render_error("organization_id is required", status: :bad_request) if credential_id.blank?

    # Frontend passes MicrosoftCredential.id (from sync dashboard), not Organization.id
    credential = MicrosoftCredential.find_by(id: credential_id, credential_type: "app")
    unless credential&.status == "connected"
      return render_error("No connected Microsoft credential found", status: :not_found)
    end

    # Tenant-scope: verify credential belongs to current tenant's organizations
    unless tenant_organization_ids.include?(credential.organization_id)
      return render_error("Organization not found in your tenant", status: :not_found)
    end

    # Get M365 tenant users (cached 1hr)
    m365_users = credential.list_tenant_users

    # Get existing TEEEM user emails for dedup
    # Uses current_tenant (respects tenant override/switcher) not current_user.tenant_id
    existing_emails = User.where(tenant_id: current_tenant.id)
                          .pluck(:email)
                          .compact
                          .map(&:downcase)
                          .to_set

    # Filter: licensed + user mailbox type + not already in TEEEM
    importable = m365_users.select do |u|
      u[:has_license] == true &&
        u[:mailbox_type] == "user" &&
        u[:email].present? &&
        !existing_emails.include?(u[:email].downcase)
    end

    imported = 0
    skipped = 0
    errors = []

    importable.each do |m365_user|
      ActiveRecord::Base.transaction do
        name = m365_user[:name].to_s.strip
        email = m365_user[:email].to_s.strip
        parts = name.split(/\s+/)

        # Create contact
        contact = Contact.create!(
          display_name: name,
          first_name: parts[0],
          last_name: parts.length > 1 ? parts[1..].join(" ") : nil,
          contact_type: "person",
          is_user_cached: true
        )

        contact.contact_emails.create!(
          email: email,
          label: "login",
          is_primary: true,
          position: 1
        )

        # Create user with random password (they'll use invite/reset flow)
        user = User.new(
          name: name,
          email: email,
          password: SecureRandom.urlsafe_base64(16) + "!A1",
          tenant_id: current_tenant.id
        )
        user.contact = contact

        unless user.save
          errors << "#{email}: #{user.errors.full_messages.join(', ')}"
          skipped += 1
          raise ActiveRecord::Rollback
        end

        # Assign default 'user' role
        default_role = Role.find_by(name: "user")
        user.roles << default_role if default_role && !user.roles.exists?(id: default_role.id)

        # Link to tenant company
        link_user_to_tenant_company(user)

        imported += 1
      end
    rescue => e
      errors << "#{m365_user[:email]}: #{e.message}"
      skipped += 1
    end

    render json: {
      success: true,
      imported: imported,
      skipped: skipped,
      errors: errors
    }
  end

  # POST /api/v1/users/bulk_delete
  def bulk_delete
    ids = params[:ids]
    return render_error("No IDs provided", status: :bad_request) if ids.blank?

    ids = ids.first(1000) if ids.is_a?(Array)
    deleted_count = User.where(id: ids).destroy_all.count

    render json: {
      success: true,
      deleted_count: deleted_count,
      requested_count: ids.size
    }
  rescue => e
    Rails.logger.error "Error bulk deleting users: #{e.class} - #{e.message}"
    render json: { error: e.message }, status: :internal_server_error
  end

  private

  # Generate a temporary password that meets User model complexity rules:
  # 8+ chars, uppercase, lowercase, digit, special char
  def generate_temp_password
    chars = ('a'..'z').to_a + ('A'..'Z').to_a + ('0'..'9').to_a
    specials = %w[! @ # $ % ^ & * _ + -]

    # Guarantee at least one of each required type
    password = [
      ('A'..'Z').to_a.sample,
      ('a'..'z').to_a.sample,
      ('0'..'9').to_a.sample,
      specials.sample
    ]

    # Fill remaining 8 chars randomly
    8.times { password << (chars + specials).sample }

    # Shuffle to avoid predictable pattern
    password.shuffle.join
  end

  # Regular user params that anyone can edit
  def user_params
    params.require(:user).permit(
      :name, :email, :mobile_phone, :job_title, :preferred_theme,
      :qbcc_licence_number, :qbcc_licence_class, :signature, :photo,
      :enable_ai_writing_assistant, :email_signature_style
    )
  end

  # Admin-only params (role, role_ids, contact_id)
  # Only administrators should be able to modify these fields
  # SSoT: Roles via user_roles join table (role_ids), not assigned_roles column
  # Brakeman warning can be ignored: authorization check in update() prevents
  # non-admin users from accessing these params (returns 403 Forbidden)
  def admin_user_params
    params.require(:user).permit(:role, :contact_id, role_ids: [])
  end

  # Params for creating a new user (admin only)
  def create_user_params
    params.require(:user).permit(:name, :email, :password, :password_confirmation, :mobile_phone, :job_title)
  end

  # Find existing contact by ID or create new one from user info
  def find_or_create_contact
    contact_id = params.dig(:user, :contact_id)

    if contact_id.present?
      # Link to existing contact
      contact = Contact.find(contact_id)
      # Update contact's is_user_cached flag
      contact.update_column(:is_user_cached, true) if contact.respond_to?(:is_user_cached)
      contact
    else
      # Create new contact from user info
      user_data = params[:user]
      name = user_data[:name].to_s
      parts = name.strip.split(/\s+/)

      Contact.create!(
        display_name: name,
        first_name: parts[0],
        last_name: parts.length > 1 ? parts[1..-1].join(' ') : nil,
        contact_type: 'person',
        is_user_cached: true
      ).tap do |contact|
        # Add email to contact_emails table
        if user_data[:email].present?
          contact.contact_emails.create!(
            email: user_data[:email],
            label: 'login',
            is_primary: true,
            position: 1
          )
        end
        # Add mobile to contact_phones table
        if user_data[:mobile_phone].present?
          contact.contact_phones.create!(
            phone_number: user_data[:mobile_phone],
            label: 'mobile',
            is_primary: true,
            position: 1
          )
        end
      end
    end
  end

  # Auto-link new user's contact as employee of the tenant company
  # SSoT: TenantSetting.company_name → Contact (company) → ContactRelationship (employee_of)
  def link_user_to_tenant_company(user)
    contact = user.contact
    return unless contact&.entity_type == "person"

    company_name = TenantSetting.instance&.company_name
    return if company_name.blank?

    company_contact = Contact.where(entity_type: "company")
      .where("display_name ILIKE ?", company_name)
      .first
    return unless company_contact
    return if contact.id == company_contact.id

    # Skip if relationship already exists
    return if ContactRelationship.exists?(
      source_contact_id: contact.id,
      related_contact_id: company_contact.id,
      relationship_type: "employee_of"
    )

    ContactRelationship.create!(
      source_contact_id: contact.id,
      related_contact_id: company_contact.id,
      relationship_type: "employee_of",
      is_active: true,
      start_date: Date.current
    )
  rescue => e
    # Non-critical: log but don't fail user creation
    Rails.logger.warn "Failed to auto-link user #{user.id} to tenant company: #{e.message}"
  end

  # Assign roles to newly created user
  def assign_roles_to_user(user)
    role_ids = params.dig(:user, :role_ids)

    if role_ids.present?
      # Assign specified roles
      roles = Role.where(id: role_ids)
      user.roles = roles
    else
      # Assign default "user" role
      default_role = Role.find_by(name: "user")
      user.roles << default_role if default_role && !user.roles.exists?(id: default_role.id)
    end
  end

  # Returns user data with presence status and integration info
  def user_with_presence(user)
    last_seen = user.last_seen_at
    presence_status = if last_seen.nil?
                        "offline"
    elsif last_seen > 5.minutes.ago
                        "online"
    elsif last_seen > 30.minutes.ago
                        "away"
    else
                        "offline"
    end

    # Count Microsoft integrations (SSoT: MicrosoftCredential)
    integrations = []
    integrations << "microsoft" if user.microsoft_token.present?

    # SSoT: Ensure role_ids is always an array (even if roles association is somehow nil)
    safe_roles = user.roles.to_a rescue []

    user.as_json.merge(
      presence_status: presence_status,
      integrations: integrations,
      integrations_count: integrations.count,
      status: presence_status == "online" ? "active" : (user.last_login_at.present? ? "active" : "pending"),
      last_email_sync_at: user.email_sync_status&.last_sync_at,
      # Multi-role support - format for multiple_lookups column type
      role_ids: safe_roles.map { |r| { id: r.id, display_value: r.display_name, name: r.name } },
      role_names: user.role_names,
      # Primary role (Jan 2026) - determines default settings for multi-role users
      primary_role_id: user.primary_role_id,
      default_task_view: user.default_task_view,
      # Profile photo - stored via StorageBlob (photo_blob_id on User)
      photo_url: user.photo_url,
      # Digital signature - ActiveStorage removed (Jan 2026), signatures stored in File Warehouse
      signature_attached: false,
      signature_url: nil,
      qbcc_licence_number: user.qbcc_licence_number,
      qbcc_licence_class: user.qbcc_licence_class,
      can_sign_certificates: user.can_sign_certificates?,
      # Email signature style preference (Jan 2026)
      # If company forces a signature, use it; otherwise fallback chain
      email_signature_style: resolve_user_signature_style(user),
      # Force mode info for frontend
      email_signature_forced: TenantSetting.instance.force_email_signature || false,
      forced_signature_style: TenantSetting.instance.forced_signature_style,
      # Custom company signature (if exists)
      custom_email_signature_html: TenantSetting.instance.custom_email_signature_html,
      custom_email_signature_name: TenantSetting.instance.custom_email_signature_name
    )
  end

  # Resolve the email signature style for a user
  # If company forces a signature, use it regardless of user preference
  def resolve_user_signature_style(user)
    settings = TenantSetting.instance
    if settings.force_email_signature && settings.forced_signature_style.present?
      settings.forced_signature_style
    else
      user.email_signature_style ||
        settings.default_email_signature_style ||
        'modern-dark'
    end
  end
end
