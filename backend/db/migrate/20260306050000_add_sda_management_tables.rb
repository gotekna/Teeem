class AddSdaManagementTables < ActiveRecord::Migration[7.1]
  def change
    # ═══════════════════════════════════════════════════════════════
    # 1. SDA VACANCY MANAGEMENT
    # ═══════════════════════════════════════════════════════════════
    create_table :sda_vacancies do |t|
      t.references :property, null: false, foreign_key: true
      t.references :tenancy, foreign_key: true              # The tenancy that ended (if any)
      t.references :tenant, null: false, foreign_key: true

      t.date :vacancy_start_date, null: false               # When the vacancy began
      t.date :vacancy_end_date                               # When filled (null = still vacant)
      t.string :status, default: "open", null: false         # open, notified, listed, filled, closed
      t.string :vacancy_reason                               # tenant_vacated, lease_expired, eviction, never_occupied

      # SDA Finder integration
      t.boolean :ndia_notified, default: false               # Notified NDIA within 5 business days
      t.date :ndia_notified_date
      t.string :sda_finder_listing_id                        # Reference from SDA Finder
      t.date :sda_finder_listed_date
      t.date :sda_finder_expiry_date                         # Auto-expires after 1 month

      # Financials
      t.decimal :daily_lost_income, precision: 10, scale: 2  # Calculated from potential weekly / 7
      t.decimal :total_lost_income, precision: 12, scale: 2  # Running total

      t.text :notes
      t.timestamps
    end

    add_index :sda_vacancies, [:property_id, :status]
    add_index :sda_vacancies, :status

    # Participant matching — link eligible participants to vacant properties
    create_table :sda_participant_matches do |t|
      t.references :sda_vacancy, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true  # The SDA participant
      t.references :tenant, null: false, foreign_key: true

      t.string :status, default: "suggested", null: false    # suggested, contacted, interested, applied, approved, rejected, withdrawn
      t.string :match_reason                                 # category_match, location_match, manual
      t.integer :match_score                                 # 0-100 compatibility score
      t.text :notes
      t.date :contacted_date
      t.date :response_date

      t.references :matched_by_user, foreign_key: { to_table: :users }, null: true
      t.timestamps
    end

    add_index :sda_participant_matches, [:sda_vacancy_id, :contact_id], unique: true, name: "idx_sda_match_unique"

    # ═══════════════════════════════════════════════════════════════
    # 2. SDA ACCOMMODATION AGREEMENTS
    # ═══════════════════════════════════════════════════════════════
    create_table :sda_agreements do |t|
      t.references :property, null: false, foreign_key: true
      t.references :tenancy, foreign_key: true
      t.references :contact, null: false, foreign_key: true  # The participant
      t.references :tenant, null: false, foreign_key: true

      t.string :agreement_type, null: false                  # sda_accommodation, service_agreement, sil_agreement
      t.string :agreement_number
      t.string :status, default: "draft", null: false        # draft, sent, signed, active, expired, terminated
      t.date :start_date
      t.date :end_date
      t.date :signed_date
      t.date :renewal_reminder_date                          # When to remind about renewal

      # Agreement details
      t.string :sda_design_category                          # What's covered in agreement
      t.string :sda_building_type
      t.decimal :agreed_weekly_rate, precision: 10, scale: 2
      t.decimal :agreed_participant_contribution, precision: 10, scale: 2
      t.text :special_conditions
      t.text :house_rules

      # Document reference
      t.references :document_blob, foreign_key: { to_table: :storage_blobs }, null: true

      t.references :created_by_user, foreign_key: { to_table: :users }, null: true
      t.timestamps
    end

    add_index :sda_agreements, [:property_id, :status]
    add_index :sda_agreements, :status
    add_index :sda_agreements, :end_date

    # ═══════════════════════════════════════════════════════════════
    # 3. NDIA CLAIMS & PAYMENT TRACKING
    # ═══════════════════════════════════════════════════════════════
    create_table :sda_claims do |t|
      t.references :property, null: false, foreign_key: true
      t.references :tenancy, foreign_key: true
      t.references :contact, foreign_key: true               # The participant
      t.references :tenant, null: false, foreign_key: true

      t.string :claim_type, null: false                      # sda_payment, participant_rent, other
      t.string :claim_reference                              # NDIA claim reference number
      t.string :status, default: "draft", null: false        # draft, submitted, processing, paid, rejected, appealed
      t.string :period_type, default: "monthly"              # monthly, quarterly

      t.date :period_start, null: false
      t.date :period_end, null: false
      t.date :submitted_date
      t.date :paid_date

      t.decimal :claimed_amount, precision: 12, scale: 2, null: false
      t.decimal :approved_amount, precision: 12, scale: 2
      t.decimal :paid_amount, precision: 12, scale: 2
      t.decimal :variance, precision: 12, scale: 2          # Difference between claimed and paid

      t.string :rejection_reason
      t.text :notes
      t.jsonb :line_items, default: []                       # Breakdown of claim items

      t.references :submitted_by_user, foreign_key: { to_table: :users }, null: true
      t.timestamps
    end

    add_index :sda_claims, [:property_id, :status]
    add_index :sda_claims, [:period_start, :period_end]
    add_index :sda_claims, :status
    add_index :sda_claims, :claim_reference

    # ═══════════════════════════════════════════════════════════════
    # 4. SIL PROVIDER MANAGEMENT
    # ═══════════════════════════════════════════════════════════════
    create_table :sda_sil_providers do |t|
      t.references :property, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true  # The SIL provider company contact
      t.references :tenant, null: false, foreign_key: true

      t.string :status, default: "active", null: false       # active, inactive, pending
      t.date :agreement_start_date
      t.date :agreement_end_date
      t.string :agreement_reference
      t.references :agreement_blob, foreign_key: { to_table: :storage_blobs }, null: true

      # Service details
      t.string :service_type                                 # sil, in_home_support, respite
      t.integer :staff_ratio                                 # e.g. 1:3 = 3 participants per staff
      t.boolean :provides_overnight, default: false
      t.boolean :provides_24hr, default: false

      # Performance
      t.decimal :satisfaction_rating, precision: 3, scale: 1 # 0.0 - 5.0
      t.integer :incident_count, default: 0
      t.date :last_review_date
      t.date :next_review_date

      t.text :notes
      t.timestamps
    end

    add_index :sda_sil_providers, [:property_id, :status]

    # ═══════════════════════════════════════════════════════════════
    # 5. COMPLIANCE & ESSENTIAL SERVICES REGISTER
    # ═══════════════════════════════════════════════════════════════
    create_table :sda_compliance_items do |t|
      t.references :property, null: false, foreign_key: true
      t.references :tenant, null: false, foreign_key: true

      t.string :category, null: false                        # fire_safety, accessibility, electrical, plumbing, structural, general
      t.string :item_type, null: false                       # smoke_alarm, fire_extinguisher, sprinkler_system, emergency_light,
                                                             # ceiling_hoist, ramp, handrail, adjustable_bench, door_automation,
                                                             # rcd_switch, hot_water_tempering, backflow_valve, pest_control, etc.
      t.string :item_name, null: false                       # Human-readable name
      t.string :location                                     # "Bedroom 1", "Hallway", "Kitchen"
      t.string :status, default: "compliant", null: false    # compliant, due_soon, overdue, non_compliant, not_applicable

      # Dates
      t.date :installed_date
      t.date :last_service_date
      t.date :next_service_date                              # When next service/test is due
      t.date :expiry_date                                    # When item expires (e.g. fire extinguisher)
      t.integer :service_interval_months                     # How often service is needed (e.g. 6, 12)

      # Service provider
      t.string :service_provider_name
      t.string :service_provider_phone
      t.string :certificate_number

      # Document reference
      t.references :certificate_blob, foreign_key: { to_table: :storage_blobs }, null: true

      t.text :notes
      t.timestamps
    end

    add_index :sda_compliance_items, [:property_id, :category]
    add_index :sda_compliance_items, :status
    add_index :sda_compliance_items, :next_service_date

    # ═══════════════════════════════════════════════════════════════
    # 6. SDA INCIDENT MANAGEMENT
    # ═══════════════════════════════════════════════════════════════
    create_table :sda_incidents do |t|
      t.references :property, null: false, foreign_key: true
      t.references :tenancy, foreign_key: true
      t.references :contact, foreign_key: true               # Participant involved
      t.references :tenant, null: false, foreign_key: true

      t.string :incident_number, null: false
      t.string :incident_type, null: false                   # property_damage, participant_safety, medication_error,
                                                             # unauthorized_restraint, abuse_neglect, injury, fall,
                                                             # missing_participant, behavioral, death, other
      t.string :severity, null: false                        # minor, moderate, serious, critical
      t.string :status, default: "reported", null: false     # reported, investigating, resolved, closed, reported_to_commission

      t.datetime :incident_datetime, null: false
      t.string :location                                     # Where in the property
      t.text :description, null: false
      t.text :immediate_action_taken
      t.text :root_cause
      t.text :corrective_actions
      t.text :preventive_measures

      # NDIS Commission reporting
      t.boolean :ndis_reportable, default: false             # Must report to NDIS Commission
      t.boolean :ndis_reported, default: false
      t.date :ndis_reported_date
      t.string :ndis_report_reference
      t.boolean :reported_within_24hrs                       # Serious incidents must be reported within 24hrs

      # People involved
      t.string :reported_by_name
      t.string :witnesses
      t.references :reported_by_user, foreign_key: { to_table: :users }, null: true
      t.references :investigated_by_user, foreign_key: { to_table: :users }, null: true

      t.date :resolved_date
      t.date :review_date                                    # Follow-up review date
      t.timestamps
    end

    add_index :sda_incidents, :incident_number, unique: true
    add_index :sda_incidents, [:property_id, :status]
    add_index :sda_incidents, :severity
    add_index :sda_incidents, :ndis_reportable

    # ═══════════════════════════════════════════════════════════════
    # 7. PARTICIPANT OUTCOME TRACKING
    # ═══════════════════════════════════════════════════════════════
    create_table :sda_participant_outcomes do |t|
      t.references :property, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true  # The participant
      t.references :tenancy, foreign_key: true
      t.references :tenant, null: false, foreign_key: true

      t.string :outcome_type, null: false                    # satisfaction_survey, goal_review, independence_assessment, wellbeing_check
      t.date :assessment_date, null: false
      t.string :period                                       # "Q1 2026", "Jan 2026"

      # Ratings (1-5 or 1-10)
      t.integer :overall_satisfaction                        # 1-5
      t.integer :housing_quality_rating                      # 1-5
      t.integer :maintenance_response_rating                 # 1-5
      t.integer :safety_rating                               # 1-5
      t.integer :independence_rating                         # 1-5
      t.integer :community_access_rating                     # 1-5

      # Goals
      t.text :participant_goals                              # What goals the participant has
      t.text :goals_progress                                 # Progress toward goals
      t.string :goals_status                                 # on_track, at_risk, behind, achieved

      # Feedback
      t.text :participant_feedback
      t.text :sil_provider_feedback
      t.text :family_feedback
      t.text :action_items                                   # What needs to happen next

      t.references :assessed_by_user, foreign_key: { to_table: :users }, null: true
      t.timestamps
    end

    add_index :sda_participant_outcomes, [:contact_id, :assessment_date]

    # ═══════════════════════════════════════════════════════════════
    # 8. SDA DESIGN STANDARD COMPLIANCE
    # ═══════════════════════════════════════════════════════════════
    create_table :sda_design_assessments do |t|
      t.references :property, null: false, foreign_key: true
      t.references :tenant, null: false, foreign_key: true

      t.string :design_standard_version                      # "2024", "2021", "2019"
      t.date :assessment_date
      t.string :assessor_name
      t.string :assessor_registration_number
      t.string :status, default: "pending", null: false      # pending, compliant, non_compliant, conditional

      # Checklist results stored as JSONB
      # Structure: { "entrance": { "door_width_mm": 1000, "compliant": true },
      #              "bathroom": { "turning_circle_mm": 1500, "compliant": true }, ... }
      t.jsonb :room_assessments, default: {}

      # Summary scores
      t.integer :total_items_assessed, default: 0
      t.integer :compliant_items, default: 0
      t.integer :non_compliant_items, default: 0
      t.decimal :compliance_percentage, precision: 5, scale: 2

      # Modifications needed
      t.jsonb :required_modifications, default: []           # List of modifications needed
      t.decimal :estimated_modification_cost, precision: 12, scale: 2
      t.date :modification_deadline

      t.references :certificate_blob, foreign_key: { to_table: :storage_blobs }, null: true
      t.text :notes
      t.timestamps
    end

    add_index :sda_design_assessments, [:property_id, :status]

    # ═══════════════════════════════════════════════════════════════
    # 9. RENT LEDGER / TRUST ACCOUNTING
    # ═══════════════════════════════════════════════════════════════
    create_table :sda_rent_ledger_entries do |t|
      t.references :property, null: false, foreign_key: true
      t.references :tenancy, foreign_key: true
      t.references :contact, foreign_key: true               # Participant or payer
      t.references :tenant, null: false, foreign_key: true

      t.string :entry_type, null: false                      # rent_received, ndia_payment, participant_contribution,
                                                             # bond_received, bond_refund, disbursement_to_owner,
                                                             # expense_payment, management_fee, adjustment, arrears_notice
      t.date :entry_date, null: false
      t.string :reference                                    # Receipt/reference number
      t.string :description

      t.decimal :debit_amount, precision: 12, scale: 2, default: 0   # Money in (received)
      t.decimal :credit_amount, precision: 12, scale: 2, default: 0  # Money out (paid/disbursed)
      t.decimal :running_balance, precision: 12, scale: 2             # Running balance

      # Trust account tracking
      t.boolean :trust_account, default: false               # Is this in a trust account?
      t.string :trust_reference
      t.boolean :reconciled, default: false
      t.date :reconciled_date

      # Bond tracking
      t.boolean :is_bond_transaction, default: false
      t.string :bond_lodgement_number                        # RTA/RTBA reference

      t.string :payment_method                               # eft, direct_debit, bpay, cash, cheque, ndia_portal
      t.references :gl_invoice, foreign_key: { to_table: :gl_invoices }, null: true

      t.timestamps
    end

    add_index :sda_rent_ledger_entries, [:property_id, :entry_date]
    add_index :sda_rent_ledger_entries, [:tenancy_id, :entry_date]
    add_index :sda_rent_ledger_entries, :entry_type
    add_index :sda_rent_ledger_entries, :trust_account

    # Arrears tracking
    create_table :sda_arrears do |t|
      t.references :property, null: false, foreign_key: true
      t.references :tenancy, null: false, foreign_key: true
      t.references :contact, foreign_key: true
      t.references :tenant, null: false, foreign_key: true

      t.string :status, default: "current", null: false      # current, reminder_sent, notice_issued, breach, referred, resolved
      t.decimal :amount_overdue, precision: 12, scale: 2, null: false
      t.integer :days_overdue, null: false
      t.date :first_missed_date

      # Communication trail
      t.date :reminder_sent_date
      t.date :notice_issued_date
      t.date :breach_notice_date
      t.date :resolved_date
      t.string :resolution                                   # paid_in_full, payment_plan, written_off, eviction

      t.text :notes
      t.timestamps
    end

    add_index :sda_arrears, [:tenancy_id, :status]
    add_index :sda_arrears, :status

    # ═══════════════════════════════════════════════════════════════
    # 10. OWNER STATEMENTS
    # ═══════════════════════════════════════════════════════════════
    create_table :sda_owner_statements do |t|
      t.references :property, null: false, foreign_key: true
      t.references :tenant, null: false, foreign_key: true
      t.references :owner_contact, foreign_key: { to_table: :contacts }, null: false

      t.string :statement_type, null: false                  # monthly, quarterly, annual, tax_summary
      t.string :period_label                                 # "January 2026", "Q1 2026", "FY 2025-26"
      t.date :period_start, null: false
      t.date :period_end, null: false
      t.string :status, default: "draft", null: false        # draft, generated, sent, acknowledged

      # Summary amounts
      t.decimal :gross_income, precision: 12, scale: 2, default: 0
      t.decimal :sda_income, precision: 12, scale: 2, default: 0
      t.decimal :participant_income, precision: 12, scale: 2, default: 0
      t.decimal :other_income, precision: 12, scale: 2, default: 0
      t.decimal :management_fees, precision: 12, scale: 2, default: 0
      t.decimal :maintenance_costs, precision: 12, scale: 2, default: 0
      t.decimal :insurance, precision: 12, scale: 2, default: 0
      t.decimal :council_rates, precision: 12, scale: 2, default: 0
      t.decimal :water_rates, precision: 12, scale: 2, default: 0
      t.decimal :body_corporate, precision: 12, scale: 2, default: 0
      t.decimal :other_expenses, precision: 12, scale: 2, default: 0
      t.decimal :total_expenses, precision: 12, scale: 2, default: 0
      t.decimal :net_income, precision: 12, scale: 2, default: 0
      t.decimal :amount_disbursed, precision: 12, scale: 2, default: 0

      # Tax (for annual/tax_summary)
      t.decimal :depreciation, precision: 12, scale: 2, default: 0
      t.decimal :interest_expense, precision: 12, scale: 2, default: 0
      t.decimal :capital_works_deduction, precision: 12, scale: 2, default: 0

      # Line items detail
      t.jsonb :income_items, default: []
      t.jsonb :expense_items, default: []

      # PDF
      t.references :statement_blob, foreign_key: { to_table: :storage_blobs }, null: true
      t.date :sent_date
      t.timestamps
    end

    add_index :sda_owner_statements, [:property_id, :period_start]
    add_index :sda_owner_statements, :status
  end
end
