# frozen_string_literal: true

# Import Chapter 1 Teacher entries

entries = [
  {
    section_number: "1.1",
    title: "JWT Token Handling Implementation",
    entry_type: "integration",
    difficulty: "intermediate",
    summary: "Complete JWT authentication pattern using JsonWebToken service for encoding and decoding tokens.",
    code_example: <<~'CODE',
      # backend/app/services/json_web_token.rb
      class JsonWebToken
        SECRET_KEY = Rails.application.secrets.secret_key_base.to_s

        def self.encode(payload, exp = 24.hours.from_now)
          payload[:exp] = exp.to_i
          JWT.encode(payload, SECRET_KEY)
        end

        def self.decode(token)
          decoded = JWT.decode(token, SECRET_KEY)[0]
          HashWithIndifferentAccess.new decoded
        rescue JWT::DecodeError, JWT::ExpiredSignature
          nil
        end
      end

      # ApplicationController authorization
      before_action :authorize_request

      def authorize_request
        header = request.headers['Authorization']
        header = header.split(' ').last if header

        decoded = JsonWebToken.decode(header)
        @current_user = User.find(decoded[:user_id]) if decoded
      rescue ActiveRecord::RecordNotFound, JWT::DecodeError
        render json: { error: 'Unauthorized' }, status: :unauthorized
      end
    CODE
    related_rules: "TEEEM_BIBLE.md RULE #1.1"
  },
  {
    section_number: "1.2",
    title: "Password Complexity Validation",
    entry_type: "util",
    difficulty: "beginner",
    summary: "12-character minimum password with complexity rules using custom validation.",
    code_example: <<~'CODE',
      # app/models/user.rb
      has_secure_password

      validates :password, length: { minimum: 12 }, if: :password_required?
      validate :password_complexity, if: :password_required?

      private

      def password_complexity
        return unless password.present?

        rules = [
          [/[A-Z]/, 'uppercase letter'],
          [/[a-z]/, 'lowercase letter'],
          [/[0-9]/, 'number'],
          [/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'special character']
        ]

        rules.each do |regex, description|
          unless password.match?(regex)
            errors.add(:password, "must include at least one #{description}")
          end
        end
      end

      def password_required?
        password_digest.nil? || password.present?
      end
    CODE
    related_rules: "TEEEM_BIBLE.md RULE #1.2"
  },
  {
    section_number: "1.3",
    title: "Role-Based Access Control",
    entry_type: "feature",
    difficulty: "intermediate",
    summary: "Permission system using database-driven roles (SSoT: Role model) and model-based permission methods.",
    code_example: <<~'CODE',
      # SSoT: Roles come from the database, not hardcoded constants
      # app/models/role.rb
      class Role < ApplicationRecord
        scope :active, -> { where(active: true) }
        scope :with_god_view, -> { where(god_view_access: true) }
        scope :with_payment_approval, -> { where(can_approve_payments: true) }

        def self.for_select
          active.ordered.pluck(:name, :display_name).map { |name, display| { value: name, label: display } }
        end
      end

      # app/models/user.rb
      # SSoT: Roles via user_roles join table
      has_many :user_roles, dependent: :destroy
      has_many :roles, through: :user_roles

      def god_view?
        roles.with_god_view.exists?
      end

      def admin?
        role_names.include?('admin')
      end

      def can_create_templates?
        admin? || product_owner?
      end

      # Controller usage:
      before_action :check_can_edit_templates

      def check_can_edit_templates
        unless @current_user.can_create_templates?
          render json: { error: 'Unauthorized' }, status: :forbidden
        end
      end
    CODE
    related_rules: "TEEEM_BIBLE.md RULE #1.3"
  },
  {
    section_number: "1.4",
    title: "Rate Limiting with Rack::Attack",
    entry_type: "integration",
    difficulty: "intermediate",
    summary: "Configure rate limiting on auth endpoints using Rack::Attack middleware.",
    code_example: <<~'CODE',
      # config/initializers/rack_attack.rb
      Rack::Attack.throttle('auth/ip', limit: 5, period: 20.seconds) do |req|
        req.ip if req.path.start_with?('/api/v1/auth/')
      end

      Rack::Attack.throttle('password_reset/email', limit: 3, period: 1.hour) do |req|
        if req.path == '/api/v1/users/reset_password' && req.post?
          req.params['email'].to_s.downcase.presence
        end
      end

      Rack::Attack.throttle('general/ip', limit: 300, period: 5.minutes) do |req|
        req.ip
      end
    CODE
    related_rules: "TEEEM_BIBLE.md RULE #1.4"
  },
  {
    section_number: "1.5",
    title: "OAuth Integration with OmniAuth",
    entry_type: "integration",
    difficulty: "advanced",
    summary: "Microsoft Office 365 OAuth integration using OmniAuth gem.",
    code_example: <<~'CODE',
      # config/initializers/omniauth.rb
      Rails.application.config.middleware.use OmniAuth::Builder do
        provider :microsoft_office365,
          ENV['ONEDRIVE_CLIENT_ID'],
          ENV['ONEDRIVE_CLIENT_SECRET'],
          scope: 'openid profile email User.Read'
      end

      # app/models/user.rb
      def self.from_omniauth(auth)
        where(provider: auth.provider, uid: auth.uid).first_or_create do |user|
          user.email = auth.info.email
          user.name = auth.info.name
          user.password = SecureRandom.hex(16)
          user.oauth_token = auth.credentials.token
          user.oauth_expires_at = Time.at(auth.credentials.expires_at)
        end
      end
    CODE
    related_rules: "TEEEM_BIBLE.md RULE #1.5"
  },
  {
    section_number: "1.6",
    title: "Password Reset Flow with Secure Tokens",
    entry_type: "feature",
    difficulty: "intermediate",
    summary: "Secure password reset using hashed tokens with 2-hour expiration.",
    code_example: <<~'CODE',
      # Generate reset token
      def reset_password
        token = SecureRandom.urlsafe_base64(32)
        @user.update!(
          reset_password_token: Digest::SHA256.hexdigest(token),
          reset_password_sent_at: Time.current
        )
        # Send token via email (not API response)
      end

      # Validate and update password
      def update_password_with_token
        hashed_token = Digest::SHA256.hexdigest(params[:token])
        user = User.find_by(reset_password_token: hashed_token)

        if user && user.reset_password_sent_at > 2.hours.ago
          user.update!(
            password: params[:password],
            reset_password_token: nil,
            reset_password_sent_at: nil
          )
          render json: { message: 'Password updated' }
        else
          render json: { error: 'Token expired' }, status: :unprocessable_entity
        end
      end
    CODE
    related_rules: "TEEEM_BIBLE.md RULE #1.6"
  },
  {
    section_number: "1.7",
    title: "Portal User Separation",
    entry_type: "feature",
    difficulty: "advanced",
    summary: "Isolated portal_users table with activity logging and account lockout.",
    code_example: <<~'CODE',
      # app/models/portal_user.rb
      class PortalUser < ApplicationRecord
        belongs_to :contact
        has_secure_password

        enum portal_type: { supplier: 'supplier', customer: 'customer' }

        def lock_account!
          update!(locked_until: 30.minutes.from_now)
        end

        def record_failed_login!
          increment!(:failed_login_attempts)
          lock_account! if failed_login_attempts >= 5
        end

        def record_successful_login!
          update!(
            failed_login_attempts: 0,
            locked_until: nil,
            last_login_at: Time.current
          )
        end
      end

      # app/models/portal_access_log.rb
      def self.log(portal_user:, action:, ip:, user_agent:)
        create!(
          portal_user: portal_user,
          action_type: action,
          ip_address: ip,
          user_agent: user_agent,
          occurred_at: Time.current
        )
      end
    CODE
    related_rules: "TEEEM_BIBLE.md RULE #1.7"
  }
]

puts "📖 Importing Chapter 1 Teacher entries..."

entries.each do |attrs|
  entry = Trinity.find_or_initialize_by(
    chapter_number: 1,
    section_number: attrs[:section_number]
  )

  entry.assign_attributes(
    chapter_name: "Authentication & Users",
    title: attrs[:title],
    entry_type: attrs[:entry_type],
    difficulty: attrs[:difficulty],
    summary: attrs[:summary],
    code_example: attrs[:code_example],
    related_rules: attrs[:related_rules]
  )

  if entry.save
    puts "✅ Saved: §#{attrs[:section_number]} - #{attrs[:title]}"
  else
    puts "❌ Failed: #{entry.errors.full_messages.join(', ')}"
  end
end

puts ""
puts "✨ Chapter 1 Complete!"
puts "📊 Total Chapter 1 Teacher entries: #{Trinity.teacher_entries.where(chapter_number: 1).count}"
