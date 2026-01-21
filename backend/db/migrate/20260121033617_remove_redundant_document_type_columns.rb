# SSoT Cleanup: Remove redundant columns from document_types
# These columns have been superseded by EntityTab associations:
# - tabs (jsonb) → entity_tab_document_types join table
# - primary_tab (string) → computed via primary_entity_tab.display_name
# - category (string) → unused, returns nil (callers use "General" fallback)
# - name_format (string) → superseded by file_name column
#
# Phase 1: Safe to remove (definitely unused/redundant)
# Phase 2 (future): scope, folder, target_folder (derived from primary_entity_tab)
#
# Note: Must drop and recreate materialized views that depend on these columns
class RemoveRedundantDocumentTypeColumns < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Drop materialized views that depend on primary_tab/category
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_document_completeness CASCADE"
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_document_summary CASCADE"

    # Step 2: Remove indexes
    remove_index :document_types, :category, if_exists: true
    remove_index :document_types, :primary_tab, if_exists: true

    # Step 3: Remove columns
    remove_column :document_types, :tabs, :jsonb
    remove_column :document_types, :primary_tab, :string
    remove_column :document_types, :category, :string
    remove_column :document_types, :name_format, :string

    # Step 4: Recreate materialized views WITHOUT the removed columns
    # MV_DOCUMENT_SUMMARY - Document metrics (without category/primary_tab)
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_document_summary AS
      SELECT
        cd.company_id,
        cd.company_code,
        cd.document_type,
        cd.folder,
        cd.source,
        cd.ai_verification_status,
        EXTRACT(YEAR FROM cd.document_date)::integer as document_year,
        COUNT(*) as document_count,
        COUNT(*) FILTER (WHERE cd.file_url IS NOT NULL OR cd.onedrive_file_id IS NOT NULL) as with_file_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'verified') as verified_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'mismatch') as mismatch_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'pending' OR cd.ai_verification_status IS NULL) as pending_count,
        MAX(cd.created_at) as latest_upload,
        COALESCE(SUM(cd.file_size), 0) as total_file_size_bytes,
        NOW() as refreshed_at
      FROM company_documents cd
      LEFT JOIN document_types dt ON dt.id = cd.document_type_id
      GROUP BY
        cd.company_id,
        cd.company_code,
        cd.document_type,
        cd.folder,
        cd.source,
        cd.ai_verification_status,
        EXTRACT(YEAR FROM cd.document_date)
      WITH DATA;

      CREATE INDEX ON mv_document_summary(company_id);
      CREATE INDEX ON mv_document_summary(company_code);
      CREATE INDEX ON mv_document_summary(document_type);
      CREATE INDEX ON mv_document_summary(document_year);
      CREATE INDEX ON mv_document_summary(ai_verification_status);
    SQL

    # MV_DOCUMENT_COMPLETENESS - Documents by company & FY (without category/primary_tab)
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_document_completeness AS
      SELECT
        cd.company_id,
        c.code as company_code,
        c.name as company_name,
        c.entity_type,
        fy.financial_year,
        cd.document_type,
        cd.ai_verification_status,
        COUNT(*) as document_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'verified') as verified_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'pending' OR cd.ai_verification_status IS NULL) as pending_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'mismatch' OR cd.ai_verification_status = 'needs_review') as needs_review_count,
        COUNT(*) FILTER (WHERE cd.file_url IS NOT NULL OR cd.onedrive_file_id IS NOT NULL) as with_file_count,
        MAX(cd.created_at) as latest_upload,
        NOW() as refreshed_at
      FROM company_documents cd
      INNER JOIN companies c ON c.id = cd.company_id
      LEFT JOIN document_types dt ON dt.id = cd.document_type_id
      CROSS JOIN LATERAL unnest(cd.financial_years) as fy(financial_year)
      WHERE cd.company_id IS NOT NULL
        AND cd.financial_years IS NOT NULL
        AND array_length(cd.financial_years, 1) > 0
      GROUP BY
        cd.company_id,
        c.code,
        c.name,
        c.entity_type,
        fy.financial_year,
        cd.document_type,
        cd.ai_verification_status
      WITH DATA;

      CREATE INDEX ON mv_document_completeness(company_id);
      CREATE INDEX ON mv_document_completeness(company_code);
      CREATE INDEX ON mv_document_completeness(financial_year);
      CREATE INDEX ON mv_document_completeness(document_type);
      CREATE INDEX ON mv_document_completeness(company_id, financial_year);
    SQL
  end

  def down
    # Add columns back
    add_column :document_types, :tabs, :jsonb, default: []
    add_column :document_types, :primary_tab, :string
    add_column :document_types, :category, :string
    add_column :document_types, :name_format, :string

    # Add indexes back
    add_index :document_types, :category
    add_index :document_types, :primary_tab

    # Drop and recreate materialized views WITH the columns (original definitions)
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_document_completeness CASCADE"
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_document_summary CASCADE"

    # Recreate with original definitions (including category/primary_tab)
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_document_summary AS
      SELECT
        cd.company_id,
        cd.company_code,
        cd.document_type,
        dt.category as document_category,
        dt.primary_tab,
        cd.folder,
        cd.source,
        cd.ai_verification_status,
        EXTRACT(YEAR FROM cd.document_date)::integer as document_year,
        COUNT(*) as document_count,
        COUNT(*) FILTER (WHERE cd.file_url IS NOT NULL OR cd.onedrive_file_id IS NOT NULL) as with_file_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'verified') as verified_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'mismatch') as mismatch_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'pending' OR cd.ai_verification_status IS NULL) as pending_count,
        MAX(cd.created_at) as latest_upload,
        COALESCE(SUM(cd.file_size), 0) as total_file_size_bytes,
        NOW() as refreshed_at
      FROM company_documents cd
      LEFT JOIN document_types dt ON dt.id = cd.document_type_id
      GROUP BY
        cd.company_id,
        cd.company_code,
        cd.document_type,
        dt.category,
        dt.primary_tab,
        cd.folder,
        cd.source,
        cd.ai_verification_status,
        EXTRACT(YEAR FROM cd.document_date)
      WITH DATA;

      CREATE INDEX ON mv_document_summary(company_id);
      CREATE INDEX ON mv_document_summary(company_code);
      CREATE INDEX ON mv_document_summary(document_type);
      CREATE INDEX ON mv_document_summary(document_year);
      CREATE INDEX ON mv_document_summary(document_category);
      CREATE INDEX ON mv_document_summary(ai_verification_status);
    SQL

    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_document_completeness AS
      SELECT
        cd.company_id,
        c.code as company_code,
        c.name as company_name,
        c.entity_type,
        fy.financial_year,
        cd.document_type,
        dt.category as document_category,
        dt.primary_tab,
        cd.ai_verification_status,
        COUNT(*) as document_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'verified') as verified_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'pending' OR cd.ai_verification_status IS NULL) as pending_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'mismatch' OR cd.ai_verification_status = 'needs_review') as needs_review_count,
        COUNT(*) FILTER (WHERE cd.file_url IS NOT NULL OR cd.onedrive_file_id IS NOT NULL) as with_file_count,
        MAX(cd.created_at) as latest_upload,
        NOW() as refreshed_at
      FROM company_documents cd
      INNER JOIN companies c ON c.id = cd.company_id
      LEFT JOIN document_types dt ON dt.id = cd.document_type_id
      CROSS JOIN LATERAL unnest(cd.financial_years) as fy(financial_year)
      WHERE cd.company_id IS NOT NULL
        AND cd.financial_years IS NOT NULL
        AND array_length(cd.financial_years, 1) > 0
      GROUP BY
        cd.company_id,
        c.code,
        c.name,
        c.entity_type,
        fy.financial_year,
        cd.document_type,
        dt.category,
        dt.primary_tab,
        cd.ai_verification_status
      WITH DATA;

      CREATE INDEX ON mv_document_completeness(company_id);
      CREATE INDEX ON mv_document_completeness(company_code);
      CREATE INDEX ON mv_document_completeness(financial_year);
      CREATE INDEX ON mv_document_completeness(document_type);
      CREATE INDEX ON mv_document_completeness(document_category);
      CREATE INDEX ON mv_document_completeness(company_id, financial_year);
    SQL
  end
end
