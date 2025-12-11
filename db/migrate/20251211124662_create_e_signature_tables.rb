class CreateESignatureTables < ActiveRecord::Migration[8.0]
  def change
    # =========================================
    # E-Signature Requests (The envelope)
    # =========================================
    create_table :e_signature_requests do |t|
      t.string :request_number, null: false  # ESR-2024-00001
      t.string :title, null: false
      t.text :description

      # Status tracking
      t.string :status, default: "draft", null: false
      # draft, sent, in_progress, completed, declined, expired, cancelled

      # Polymorphic association to document owner (Job, Contact, etc)
      t.references :documentable, polymorphic: true

      # Document hashes for tamper detection
      t.string :original_document_hash  # SHA256 before signatures
      t.string :signed_document_hash    # SHA256 after all signatures

      # SharePoint references
      t.string :original_sharepoint_file_id
      t.string :signed_sharepoint_file_id
      t.string :sharepoint_site_id
      t.string :sharepoint_drive_id

      # Timestamps
      t.datetime :sent_at
      t.datetime :expires_at
      t.datetime :completed_at
      t.datetime :declined_at

      # Who created this request
      t.references :created_by, foreign_key: { to_table: :users }

      # Signing order: 0 = all can sign in parallel, 1+ = sequential order
      t.integer :signing_order, default: 0

      # Optional: auto-reminder settings
      t.boolean :send_reminders, default: true
      t.integer :reminder_interval_days, default: 3
      t.datetime :last_reminder_sent_at

      # Message for signers
      t.text :message_to_signers

      t.timestamps
    end

    add_index :e_signature_requests, :request_number, unique: true
    add_index :e_signature_requests, :status
    add_index :e_signature_requests, :expires_at

    # =========================================
    # E-Signature Signers (Who signs)
    # =========================================
    create_table :e_signature_signers do |t|
      t.references :e_signature_request, null: false, foreign_key: true

      # Signer identity
      t.string :name, null: false
      t.string :email, null: false
      t.string :role  # builder, client, witness, guarantor

      # Signing order within the request (for sequential signing)
      t.integer :signing_order, default: 0

      # Status tracking
      t.string :status, default: "pending", null: false
      # pending, notified, viewed, signed, declined

      # Timestamps for audit
      t.datetime :notified_at
      t.datetime :viewed_at
      t.datetime :signed_at
      t.datetime :declined_at

      # Secure access token (hashed)
      t.string :access_token_hash
      t.datetime :access_token_expires_at

      # Email verification (6-digit code)
      t.string :email_verification_code
      t.datetime :email_verification_expires_at
      t.datetime :email_verified_at
      t.integer :email_verification_attempts, default: 0

      # Signature capture
      t.text :signature_data  # Base64 encoded signature image
      t.string :signature_type  # drawn, typed, uploaded
      t.string :typed_signature_font  # If typed, which font was used

      # Forensic data for legal compliance
      t.string :ip_address
      t.string :user_agent
      t.string :signing_device  # desktop, mobile, tablet
      t.string :browser_fingerprint

      # Optional: link to Contact record
      t.references :contact, foreign_key: true

      # Decline reason (if declined)
      t.text :decline_reason

      t.timestamps
    end

    add_index :e_signature_signers, :access_token_hash
    add_index :e_signature_signers, :email
    add_index :e_signature_signers, :status
    add_index :e_signature_signers, [ :e_signature_request_id, :signing_order ]

    # =========================================
    # E-Signature Events (Audit trail)
    # =========================================
    create_table :e_signature_events do |t|
      t.references :e_signature_request, null: false, foreign_key: true
      t.references :e_signature_signer, foreign_key: true  # Optional - some events are request-level

      # Event details
      t.string :event_type, null: false
      # created, sent, viewed, verified, signed, declined, completed, expired,
      # reminder_sent, document_downloaded, access_attempt

      t.string :event_description
      t.jsonb :event_data, default: {}  # Additional event metadata

      # Who performed the action
      t.string :actor_type  # user, signer, system
      t.string :actor_name
      t.string :actor_email
      t.references :actor_user, foreign_key: { to_table: :users }

      # Forensic data
      t.string :ip_address
      t.string :user_agent

      # Document hash at event time (for chain of custody)
      t.string :document_hash

      # When the event occurred
      t.datetime :occurred_at, null: false

      t.timestamps
    end

    add_index :e_signature_events, :event_type
    add_index :e_signature_events, :occurred_at
    add_index :e_signature_events, [ :e_signature_request_id, :occurred_at ]

    # =========================================
    # E-Signature Certificates (Completion certificate)
    # =========================================
    create_table :e_signature_certificates do |t|
      t.references :e_signature_request, null: false, foreign_key: true

      # Unique certificate number
      t.string :certificate_number, null: false  # ESC-2024-00001

      # Document integrity
      t.string :original_document_hash, null: false
      t.string :signed_document_hash, null: false

      # Complete signature chain (JSON array of hashes)
      t.text :signature_chain  # [{signer_id, hash_before, hash_after, timestamp}, ...]

      # Summary of all signers
      t.jsonb :signers_summary, default: []
      # [{name, email, role, signed_at, ip_address}, ...]

      # Certificate PDF stored in SharePoint
      t.string :certificate_sharepoint_file_id

      # Verification URL
      t.string :verification_token  # For public verification endpoint

      t.datetime :generated_at

      t.timestamps
    end

    add_index :e_signature_certificates, :certificate_number, unique: true
    add_index :e_signature_certificates, :verification_token, unique: true
  end
end
