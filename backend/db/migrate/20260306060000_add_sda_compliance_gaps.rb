class AddSdaComplianceGaps < ActiveRecord::Migration[7.1]
  def change
    # ═══════════════════════════════════════════════════════════════
    # 1. INCIDENT 5-DAY FOLLOW-UP NOTIFICATION
    #    NDIS requires: 24hr immediate notification + 5-day detailed form
    # ═══════════════════════════════════════════════════════════════
    add_column :sda_incidents, :five_day_form_due_date, :date
    add_column :sda_incidents, :five_day_form_submitted, :boolean, default: false
    add_column :sda_incidents, :five_day_form_submitted_date, :date
    add_column :sda_incidents, :five_day_form_submitted_by_user_id, :bigint
    add_column :sda_incidents, :ndis_commission_portal_ref, :string
    add_column :sda_incidents, :ri_approver_user_id, :bigint
    add_column :sda_incidents, :ri_notifier_user_id, :bigint

    add_foreign_key :sda_incidents, :users, column: :five_day_form_submitted_by_user_id
    add_foreign_key :sda_incidents, :users, column: :ri_approver_user_id
    add_foreign_key :sda_incidents, :users, column: :ri_notifier_user_id

    # ═══════════════════════════════════════════════════════════════
    # 2. PRODA / NDIA API INTEGRATION FIELDS ON CLAIMS
    # ═══════════════════════════════════════════════════════════════
    add_column :sda_claims, :proda_service_booking_id, :string
    add_column :sda_claims, :proda_claim_reference, :string
    add_column :sda_claims, :proda_submitted_at, :datetime
    add_column :sda_claims, :proda_response, :jsonb, default: {}
    add_column :sda_claims, :ndia_payment_request_id, :string

    add_index :sda_claims, :proda_service_booking_id
    add_index :sda_claims, :proda_claim_reference

    # ═══════════════════════════════════════════════════════════════
    # 3. RESTRICTIVE PRACTICES REGISTER
    #    Tracks authorized & unauthorized use of restrictive practices
    #    Must report unauthorized within 5 business days
    # ═══════════════════════════════════════════════════════════════
    create_table :sda_restrictive_practices do |t|
      t.references :property, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true  # The participant
      t.references :tenant, null: false, foreign_key: true
      t.references :sda_incident, foreign_key: true           # Linked incident if any

      t.string :practice_type, null: false                    # chemical, mechanical, physical, seclusion, environmental
      t.string :status, default: "active", null: false        # active, ceased, under_review
      t.boolean :authorized, default: false, null: false      # Is this in the behaviour support plan?
      t.string :authorization_source                          # behaviour_support_plan, emergency, other

      # Behaviour Support Plan reference
      t.string :bsp_reference                                 # Behaviour Support Plan reference number
      t.date :bsp_start_date
      t.date :bsp_end_date
      t.string :bsp_practitioner_name                         # Registered behaviour support practitioner
      t.string :bsp_practitioner_number                       # NDIS registration number

      # Usage tracking
      t.datetime :used_at, null: false
      t.integer :duration_minutes
      t.text :reason, null: false                             # Why the practice was used
      t.text :description                                     # What happened
      t.text :participant_response                            # How the participant responded
      t.text :debrief_notes                                   # Post-incident debrief

      # Reporting
      t.boolean :ndis_reportable, default: false
      t.boolean :ndis_reported, default: false
      t.date :ndis_reported_date
      t.string :ndis_report_reference
      t.boolean :reported_within_5_days                       # Must report unauthorized within 5 business days

      t.references :recorded_by_user, foreign_key: { to_table: :users }, null: true
      t.references :approved_by_user, foreign_key: { to_table: :users }, null: true
      t.timestamps
    end

    add_index :sda_restrictive_practices, [:contact_id, :practice_type]
    add_index :sda_restrictive_practices, :authorized
    add_index :sda_restrictive_practices, :status

    # ═══════════════════════════════════════════════════════════════
    # 4. CONFLICT OF INTEREST REGISTER
    #    Track COI declarations for staff, SIL providers, contractors
    # ═══════════════════════════════════════════════════════════════
    create_table :sda_conflict_of_interests do |t|
      t.references :tenant, null: false, foreign_key: true

      t.string :declarant_type, null: false                   # staff, sil_provider, contractor, board_member
      t.references :declarant_user, foreign_key: { to_table: :users }, null: true  # If staff
      t.references :declarant_contact, foreign_key: { to_table: :contacts }, null: true  # If external
      t.string :declarant_name                                # Fallback name if no user/contact

      t.string :conflict_type, null: false                    # financial, personal, professional, familial, other
      t.string :status, default: "declared", null: false      # declared, under_review, managed, resolved, dismissed
      t.string :severity, default: "low", null: false         # low, medium, high, critical

      t.text :description, null: false                        # Description of the conflict
      t.text :parties_involved                                # Who else is involved
      t.references :related_property, foreign_key: { to_table: :properties }, null: true
      t.references :related_contact, foreign_key: { to_table: :contacts }, null: true

      # Management plan
      t.text :management_plan                                 # How the conflict will be managed
      t.text :mitigation_actions                              # What actions are being taken
      t.date :review_date                                     # When to review the management plan
      t.date :resolved_date

      # Approval
      t.references :reviewed_by_user, foreign_key: { to_table: :users }, null: true
      t.date :reviewed_date
      t.text :reviewer_notes

      t.date :declaration_date, null: false
      t.timestamps
    end

    add_index :sda_conflict_of_interests, :declarant_type
    add_index :sda_conflict_of_interests, :status
    add_index :sda_conflict_of_interests, :review_date

    # ═══════════════════════════════════════════════════════════════
    # 5. SDA POLICIES & PROCEDURES REGISTER
    #    Track policy documents, versions, review dates
    # ═══════════════════════════════════════════════════════════════
    create_table :sda_policies do |t|
      t.references :tenant, null: false, foreign_key: true

      t.string :policy_type, null: false                      # policy, procedure, guideline, form, template
      t.string :category, null: false                         # governance, safety, complaints, incidents, restrictive_practices,
                                                              # conflict_of_interest, maintenance, tenancy, privacy, rights,
                                                              # emergency, medication, infection_control, sda_specific
      t.string :title, null: false
      t.string :reference_number                              # e.g., POL-SDA-001
      t.string :status, default: "draft", null: false         # draft, active, under_review, archived, superseded
      t.string :version, default: "1.0"

      # Dates
      t.date :effective_date
      t.date :review_date                                     # Next review due
      t.date :last_reviewed_date
      t.date :expiry_date
      t.integer :review_interval_months, default: 12          # How often to review

      # Content
      t.text :summary                                         # Brief description
      t.text :content                                         # Full policy text (optional if using blob)
      t.references :document_blob, foreign_key: { to_table: :storage_blobs }, null: true

      # Ownership
      t.references :owner_user, foreign_key: { to_table: :users }, null: true  # Policy owner
      t.references :approved_by_user, foreign_key: { to_table: :users }, null: true
      t.date :approved_date

      # NDIS Practice Standards mapping
      t.string :ndis_practice_standard                        # Which NDIS Practice Standard this addresses
      t.boolean :ndis_required, default: false                # Is this required by NDIS?

      t.timestamps
    end

    add_index :sda_policies, [:category, :status]
    add_index :sda_policies, :status
    add_index :sda_policies, :review_date

    # ═══════════════════════════════════════════════════════════════
    # 6. SDA NOTIFICATION LOG
    #    Track all NDIS-related notifications sent/received
    # ═══════════════════════════════════════════════════════════════
    create_table :sda_notifications do |t|
      t.references :tenant, null: false, foreign_key: true
      t.references :property, foreign_key: true, null: true

      t.string :notification_type, null: false                # vacancy_5day, incident_24hr, incident_5day,
                                                              # restrictive_practice, plan_expiry, agreement_expiry,
                                                              # compliance_overdue, price_guide_expiry, claim_rejected,
                                                              # arrears_escalation, policy_review_due, coi_review_due
      t.string :channel, null: false                          # email, sms, in_app, ndis_portal, sda_finder
      t.string :status, default: "pending", null: false       # pending, sent, delivered, failed, acknowledged
      t.string :priority, default: "normal"                   # low, normal, high, urgent

      # What triggered this notification
      t.string :notifiable_type                               # Polymorphic: SdaIncident, SdaVacancy, etc.
      t.bigint :notifiable_id

      # Recipients
      t.references :recipient_user, foreign_key: { to_table: :users }, null: true
      t.references :recipient_contact, foreign_key: { to_table: :contacts }, null: true
      t.string :recipient_email
      t.string :recipient_phone

      # Content
      t.string :subject
      t.text :body
      t.jsonb :metadata, default: {}                          # Extra data (template vars, portal refs, etc.)

      # Delivery tracking
      t.datetime :sent_at
      t.datetime :delivered_at
      t.datetime :acknowledged_at
      t.string :delivery_error
      t.integer :retry_count, default: 0

      # Due date for compliance notifications
      t.datetime :due_at                                      # When this notification MUST be sent by
      t.boolean :overdue, default: false

      t.timestamps
    end

    add_index :sda_notifications, [:notification_type, :status]
    add_index :sda_notifications, [:notifiable_type, :notifiable_id], name: "idx_sda_notif_polymorphic"
    add_index :sda_notifications, :due_at
    add_index :sda_notifications, :overdue

    # ═══════════════════════════════════════════════════════════════
    # 7. PARTICIPANT MATCHING PLATFORM REFERENCES
    #    Track listings on SDA Finder, Housing Hub, GoNest
    # ═══════════════════════════════════════════════════════════════
    add_column :sda_vacancies, :housing_hub_listing_id, :string
    add_column :sda_vacancies, :housing_hub_listed_date, :date
    add_column :sda_vacancies, :gonest_listing_id, :string
    add_column :sda_vacancies, :gonest_listed_date, :date
  end
end
