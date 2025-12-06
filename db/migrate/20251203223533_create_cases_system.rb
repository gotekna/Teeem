# Create Cases/Actions system for investigations
# Integrates with Data Warehouse for document/email/financial analysis
class CreateCasesSystem < ActiveRecord::Migration[8.0]
  def change
    # ============================================
    # CASES - Main investigation container
    # ============================================
    create_table :cases do |t|
      t.string :title, null: false
      t.string :case_number, null: false  # Auto-generated: CASE-YYYYMMDD-XXX
      t.string :case_type  # ato_audit, legal_dispute, director_investigation, compliance_review, due_diligence
      t.text :description
      t.string :status, default: 'open'  # open, in_progress, review, closed, archived

      # Primary entity being investigated (optional - can be Contact, Company, or CompanyGroup)
      t.references :contact, foreign_key: true
      t.references :company, foreign_key: true
      t.references :company_group, foreign_key: true

      # Case management
      t.date :deadline
      t.string :priority, default: 'normal'  # low, normal, high, urgent
      t.references :assigned_to, foreign_key: { to_table: :users }
      t.references :created_by, foreign_key: { to_table: :users }

      # Date range for investigation scope
      t.date :investigation_start_date
      t.date :investigation_end_date

      # AI analysis results
      t.jsonb :ai_summary  # AI-generated case summary
      t.jsonb :key_findings  # List of key findings
      t.integer :risk_score  # 0-100 risk assessment

      # Flexible metadata storage
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :cases, :case_number, unique: true
    add_index :cases, :case_type
    add_index :cases, :status
    add_index :cases, :priority
    add_index :cases, :deadline

    # ============================================
    # CASE_ACTIONS - Individual investigation actions/queries
    # ============================================
    create_table :case_actions do |t|
      t.references :case, null: false, foreign_key: true

      # Action definition
      t.string :action_type, null: false  # document_search, email_search, timeline_build, financial_analysis, etc.
      t.string :status, default: 'pending'  # pending, running, completed, failed
      t.text :query  # Natural language query from user
      t.jsonb :parameters, default: {}  # Search params (date range, keywords, entities, filters)

      # Results
      t.jsonb :results, default: {}  # Structured results from the action
      t.text :ai_analysis  # AI-generated analysis/summary of results
      t.jsonb :inconsistencies, default: []  # Flagged issues/anomalies
      t.integer :result_count  # Number of items found

      # Execution tracking
      t.references :created_by, foreign_key: { to_table: :users }
      t.datetime :started_at
      t.datetime :completed_at
      t.integer :execution_time_ms  # How long the action took

      # Error handling
      t.text :error_message

      t.timestamps
    end

    add_index :case_actions, :action_type
    add_index :case_actions, :status
    add_index :case_actions, [ :case_id, :created_at ]

    # ============================================
    # CASE_DOCUMENTS - Documents linked to a case
    # ============================================
    create_table :case_documents do |t|
      t.references :case, null: false, foreign_key: true
      t.references :company_document, null: false, foreign_key: true

      # Relevance and categorization
      t.string :relevance  # key_evidence, supporting, background, reference
      t.text :notes  # Investigator notes about this document
      t.integer :sequence  # Order in timeline/evidence list

      # AI analysis
      t.jsonb :ai_tags, default: []  # AI-generated tags/categories
      t.text :ai_summary  # AI summary of document relevance
      t.decimal :relevance_score, precision: 5, scale: 2  # AI-computed relevance 0-100

      # Added by
      t.references :added_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :case_documents, [ :case_id, :company_document_id ], unique: true
    add_index :case_documents, :relevance
    add_index :case_documents, :relevance_score

    # ============================================
    # CASE_EMAILS - Emails linked to a case
    # ============================================
    create_table :case_emails do |t|
      t.references :case, null: false, foreign_key: true
      t.bigint :email_warehouse_id, null: false

      # Relevance and categorization
      t.string :relevance  # key_evidence, supporting, background, reference
      t.text :notes
      t.integer :sequence

      # AI analysis
      t.jsonb :ai_tags, default: []
      t.text :ai_summary
      t.decimal :relevance_score, precision: 5, scale: 2

      t.references :added_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :case_emails, [ :case_id, :email_warehouse_id ], unique: true
    add_index :case_emails, :relevance
    add_index :case_emails, :email_warehouse_id
    add_foreign_key :case_emails, :email_warehouse, column: :email_warehouse_id

    # ============================================
    # CASE_TIMELINE_EVENTS - Chronological events for case
    # ============================================
    create_table :case_timeline_events do |t|
      t.references :case, null: false, foreign_key: true

      t.date :event_date, null: false
      t.time :event_time  # Optional time component
      t.string :event_type  # document, email, transaction, meeting, filing, court_date, deadline, milestone
      t.string :title, null: false
      t.text :description

      # Source tracking (polymorphic - what generated this event)
      t.string :source_type  # CompanyDocument, EmailWarehouse, FinancialTransaction, etc.
      t.bigint :source_id

      # Related entities
      t.references :contact, foreign_key: true
      t.references :company, foreign_key: true
      t.references :job, foreign_key: true

      # Visual styling
      t.string :icon  # Icon name for UI
      t.string :color  # Color code for UI

      # AI-generated or manual
      t.boolean :is_auto_generated, default: false
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :case_timeline_events, [ :case_id, :event_date ]
    add_index :case_timeline_events, :event_type
    add_index :case_timeline_events, [ :source_type, :source_id ]

    # ============================================
    # CASE_CONTACTS - Contacts involved in a case
    # ============================================
    create_table :case_contacts do |t|
      t.references :case, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true

      t.string :role  # subject, witness, advisor, opposing_party, related_party
      t.text :notes
      t.boolean :is_primary, default: false  # Primary subject of investigation

      t.timestamps
    end

    add_index :case_contacts, [ :case_id, :contact_id ], unique: true
    add_index :case_contacts, :role

    # ============================================
    # CASE_COMPANIES - Companies involved in a case
    # ============================================
    create_table :case_companies do |t|
      t.references :case, null: false, foreign_key: true
      t.references :company, null: false, foreign_key: true

      t.string :role  # subject, related_entity, counterparty
      t.text :notes
      t.boolean :is_primary, default: false

      t.timestamps
    end

    add_index :case_companies, [ :case_id, :company_id ], unique: true
    add_index :case_companies, :role

    # ============================================
    # CASE_JOBS - Jobs related to a case
    # ============================================
    create_table :case_jobs do |t|
      t.references :case, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true

      t.text :notes
      t.string :relevance  # direct, indirect, reference

      t.timestamps
    end

    add_index :case_jobs, [ :case_id, :job_id ], unique: true
  end
end
