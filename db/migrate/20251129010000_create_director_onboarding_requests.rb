class CreateDirectorOnboardingRequests < ActiveRecord::Migration[8.0]
  def change
    create_table :director_onboarding_requests do |t|
      # Link to contact (optional - created after approval)
      t.references :contact, null: true, foreign_key: true

      # Link to company being onboarded to
      t.references :company, null: true, foreign_key: true

      # Secure access token for public form
      t.string :access_token, null: false, index: { unique: true }
      t.datetime :token_expires_at

      # Status workflow
      t.string :status, null: false, default: 'pending'
      # pending, submitted, approved, rejected

      # Personal Information (collected from director)
      t.string :first_name
      t.string :last_name
      t.string :email
      t.string :mobile_phone
      t.date :date_of_birth
      t.string :place_of_birth
      t.string :birth_state
      t.string :birth_country
      t.string :residential_address

      # ID Documents
      t.string :director_id
      t.string :drivers_licence
      t.string :passport_number

      # Document uploads (URLs to SharePoint/Cloudinary)
      t.string :drivers_licence_front_url
      t.string :drivers_licence_back_url
      t.string :passport_url
      t.string :photo_url
      t.string :director_id_confirmation_url

      # Consent
      t.boolean :consent_given, default: false
      t.datetime :consent_given_at
      t.string :consent_ip_address

      # Admin review
      t.references :reviewed_by, null: true, foreign_key: { to_table: :users }
      t.datetime :reviewed_at
      t.text :review_notes

      # Tracking
      t.datetime :submitted_at
      t.datetime :invitation_sent_at
      t.references :invited_by, null: true, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :director_onboarding_requests, :status
    add_index :director_onboarding_requests, :email
  end
end
