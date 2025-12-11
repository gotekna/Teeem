class SplitCorporateCompanyDocuments < ActiveRecord::Migration[8.0]
  def up
    puts "\n" + "=" * 80
    puts "SPLITTING CORPORATE_COMPANY_DOCUMENTS INTO THREE TABLES"
    puts "=" * 80
    puts ""

    # ========================================================================
    # PHASE 1: CREATE COMPANY_DOCUMENTS TABLE
    # ========================================================================
    puts "Phase 1: Creating company_documents table..."

    create_table :company_documents do |t|
      # Core fields
      t.bigint :company_id, null: false
      t.string :title, null: false
      t.text :description
      t.string :document_type, null: false
      t.date :document_date

      # File metadata
      t.string :file_url
      t.string :file_name
      t.integer :file_size
      t.string :mime_type
      t.datetime :uploaded_at

      # Organization
      t.string :folder
      t.string :storage_type
      t.string :filed_by
      t.date :filed_date
      t.string :company_code
      t.string :source, default: "manual"

      # Document type relationship
      t.bigint :document_type_id

      # OneDrive sync
      t.string :onedrive_file_id
      t.string :onedrive_download_url
      t.datetime :last_modified_at
      t.string :expected_onedrive_path
      t.string :register_folder

      # Financial years
      t.integer :financial_years, array: true, default: []
      t.string :display_title

      # AI verification
      t.datetime :ai_verified_at
      t.string :ai_verification_status
      t.string :ai_suggested_name
      t.string :ai_suggested_folder
      t.string :ai_suggested_type
      t.integer :ai_suggested_fy, array: true, default: []
      t.decimal :ai_confidence_score
      t.string :ai_extracted_description
      t.date :ai_extracted_date
      t.integer :ai_source_page
      t.text :ai_source_quote
      t.text :ai_analysis_notes
      t.boolean :ai_contains_multiple_documents, default: false
      t.jsonb :ai_split_recommendation

      # User validation
      t.datetime :user_validated_at
      t.bigint :user_validated_by_id
      t.boolean :validation_required, default: false

      # Reference dates
      t.date :ref_date

      # Asset/Loan associations (some company docs may link to these)
      t.bigint :asset_id
      t.bigint :loan_id

      # Polymorphic documentable (for linking to other entities)
      t.string :documentable_type
      t.bigint :documentable_id

      # Deduplication
      t.string :content_hash
      t.string :external_id

      # Xero sync
      t.datetime :synced_to_xero_at
      t.string :xero_attachment_id
      t.boolean :sync_to_xero, default: false, null: false

      # Traceability
      t.bigint :legacy_corporate_document_id

      t.timestamps
    end

    # Add indexes (skip if already exists from previous run)
    add_index :company_documents, :company_id unless index_exists?(:company_documents, :company_id)
    add_index :company_documents, :document_type unless index_exists?(:company_documents, :document_type)
    add_index :company_documents, :document_type_id unless index_exists?(:company_documents, :document_type_id)
    add_index :company_documents, :document_date unless index_exists?(:company_documents, :document_date)
    add_index :company_documents, :folder unless index_exists?(:company_documents, :folder)
    add_index :company_documents, :storage_type unless index_exists?(:company_documents, :storage_type)
    add_index :company_documents, :source unless index_exists?(:company_documents, :source)
    add_index :company_documents, :company_code unless index_exists?(:company_documents, :company_code)
    add_index :company_documents, :content_hash unless index_exists?(:company_documents, :content_hash)
    add_index :company_documents, :external_id unless index_exists?(:company_documents, :external_id)
    add_index :company_documents, [ :company_id, :document_type ], name: 'idx_company_docs_new_company_type' unless index_exists?(:company_documents, [ :company_id, :document_type ], name: 'idx_company_docs_new_company_type')
    add_index :company_documents, [ :company_id, :ai_verification_status ], name: 'idx_company_docs_new_ai_status' unless index_exists?(:company_documents, [ :company_id, :ai_verification_status ], name: 'idx_company_docs_new_ai_status')
    add_index :company_documents, [ :documentable_type, :documentable_id ], name: 'idx_company_docs_new_documentable' unless index_exists?(:company_documents, [ :documentable_type, :documentable_id ], name: 'idx_company_docs_new_documentable')
    add_index :company_documents, :financial_years, using: :gin unless index_exists?(:company_documents, :financial_years)
    add_index :company_documents, :legacy_corporate_document_id unless index_exists?(:company_documents, :legacy_corporate_document_id)
    add_index :company_documents, :asset_id unless index_exists?(:company_documents, :asset_id)
    add_index :company_documents, :loan_id unless index_exists?(:company_documents, :loan_id)

    puts "✅ company_documents table created"

    # ========================================================================
    # PHASE 2: CREATE PEOPLE_DOCUMENTS TABLE
    # ========================================================================
    puts "Phase 2: Creating people_documents table..."

    create_table :people_documents do |t|
      # Core fields
      t.bigint :contact_id, null: false
      t.string :title, null: false
      t.text :description
      t.string :document_type, null: false
      t.date :document_date

      # Identity document specific fields
      t.date :expiry_date
      t.string :document_number
      t.string :issuing_authority
      t.string :issuing_country

      # File metadata
      t.string :file_name
      t.integer :file_size
      t.string :mime_type
      t.datetime :uploaded_at

      # Organization
      t.string :folder
      t.string :source, default: "manual"

      # Document type relationship
      t.bigint :document_type_id

      # Deduplication
      t.string :content_hash
      t.string :external_id

      # Traceability
      t.bigint :legacy_corporate_document_id

      t.timestamps
    end

    # Add indexes (skip if already exists from previous run)
    add_index :people_documents, :contact_id unless index_exists?(:people_documents, :contact_id)
    add_index :people_documents, :document_type unless index_exists?(:people_documents, :document_type)
    add_index :people_documents, :document_type_id unless index_exists?(:people_documents, :document_type_id)
    add_index :people_documents, :document_date unless index_exists?(:people_documents, :document_date)
    add_index :people_documents, :expiry_date unless index_exists?(:people_documents, :expiry_date)
    add_index :people_documents, :content_hash unless index_exists?(:people_documents, :content_hash)
    add_index :people_documents, :external_id unless index_exists?(:people_documents, :external_id)
    add_index :people_documents, :legacy_corporate_document_id unless index_exists?(:people_documents, :legacy_corporate_document_id)

    puts "✅ people_documents table created"

    # ========================================================================
    # PHASE 3: EXTEND JOB_DOCUMENTS TABLE
    # ========================================================================
    puts "Phase 3: Extending job_documents table..."

    # Add columns from corporate_company_documents that job_documents doesn't have
    add_column :job_documents, :title, :string unless column_exists?(:job_documents, :title)
    add_column :job_documents, :description, :text unless column_exists?(:job_documents, :description)
    add_column :job_documents, :document_date, :date unless column_exists?(:job_documents, :document_date)
    add_column :job_documents, :display_title, :string unless column_exists?(:job_documents, :display_title)
    add_column :job_documents, :mime_type, :string unless column_exists?(:job_documents, :mime_type)
    add_column :job_documents, :financial_years, :integer, array: true, default: [] unless column_exists?(:job_documents, :financial_years)
    add_column :job_documents, :ai_verification_status, :string unless column_exists?(:job_documents, :ai_verification_status)
    add_column :job_documents, :ai_verified_at, :datetime unless column_exists?(:job_documents, :ai_verified_at)
    add_column :job_documents, :user_validated_at, :datetime unless column_exists?(:job_documents, :user_validated_at)
    add_column :job_documents, :user_validated_by_id, :bigint unless column_exists?(:job_documents, :user_validated_by_id)
    add_column :job_documents, :validation_required, :boolean, default: false unless column_exists?(:job_documents, :validation_required)
    add_column :job_documents, :content_hash, :string unless column_exists?(:job_documents, :content_hash)
    add_column :job_documents, :external_id, :string unless column_exists?(:job_documents, :external_id)
    add_column :job_documents, :source, :string, default: "manual" unless column_exists?(:job_documents, :source)
    add_column :job_documents, :storage_type, :string unless column_exists?(:job_documents, :storage_type)
    add_column :job_documents, :contact_id, :bigint unless column_exists?(:job_documents, :contact_id) # For client contact
    add_column :job_documents, :company_id, :bigint unless column_exists?(:job_documents, :company_id)
    add_column :job_documents, :legacy_corporate_document_id, :bigint unless column_exists?(:job_documents, :legacy_corporate_document_id)

    # Add indexes for new columns
    add_index :job_documents, :content_hash unless index_exists?(:job_documents, :content_hash)
    add_index :job_documents, :external_id unless index_exists?(:job_documents, :external_id)
    add_index :job_documents, :financial_years, using: :gin unless index_exists?(:job_documents, :financial_years)
    add_index :job_documents, :legacy_corporate_document_id unless index_exists?(:job_documents, :legacy_corporate_document_id)
    add_index :job_documents, :contact_id unless index_exists?(:job_documents, :contact_id)
    add_index :job_documents, :company_id unless index_exists?(:job_documents, :company_id)

    puts "✅ job_documents table extended"

    # Final summary
    puts "\n" + "=" * 80
    puts "TABLE STRUCTURE CREATED!"
    puts "=" * 80
    puts "📊 Summary:"
    puts "  ✅ company_documents table created"
    puts "  ✅ people_documents table created"
    puts "  ✅ job_documents table extended with new fields"
    puts ""
    puts "📝 NOTE: Data migration will be handled separately"
    puts "=" * 80
    puts ""
  end

  def down
    puts "Rolling back table split..."

    # Drop new tables
    drop_table :company_documents if table_exists?(:company_documents)
    drop_table :people_documents if table_exists?(:people_documents)

    # Remove added columns from job_documents
    remove_column :job_documents, :title if column_exists?(:job_documents, :title)
    remove_column :job_documents, :description if column_exists?(:job_documents, :description)
    remove_column :job_documents, :document_date if column_exists?(:job_documents, :document_date)
    remove_column :job_documents, :display_title if column_exists?(:job_documents, :display_title)
    remove_column :job_documents, :financial_years if column_exists?(:job_documents, :financial_years)
    remove_column :job_documents, :ai_verification_status if column_exists?(:job_documents, :ai_verification_status)
    remove_column :job_documents, :ai_verified_at if column_exists?(:job_documents, :ai_verified_at)
    remove_column :job_documents, :user_validated_at if column_exists?(:job_documents, :user_validated_at)
    remove_column :job_documents, :user_validated_by_id if column_exists?(:job_documents, :user_validated_by_id)
    remove_column :job_documents, :validation_required if column_exists?(:job_documents, :validation_required)
    remove_column :job_documents, :content_hash if column_exists?(:job_documents, :content_hash)
    remove_column :job_documents, :external_id if column_exists?(:job_documents, :external_id)
    remove_column :job_documents, :source if column_exists?(:job_documents, :source)
    remove_column :job_documents, :storage_type if column_exists?(:job_documents, :storage_type)
    remove_column :job_documents, :contact_id if column_exists?(:job_documents, :contact_id)
    remove_column :job_documents, :company_id if column_exists?(:job_documents, :company_id)
    remove_column :job_documents, :legacy_corporate_document_id if column_exists?(:job_documents, :legacy_corporate_document_id)

    # Note: Active Storage and polymorphic columns not modified in this migration
    # No data was migrated, so no cleanup needed

    puts "✅ Rollback complete"
  end
end
