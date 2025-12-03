# Create Materialized View for Document Completeness by Company/Financial Year
# Shows document counts and verification status per company per FY
class CreateMvDocumentCompleteness < ActiveRecord::Migration[8.0]
  def up
    # ============================================
    # MV_DOCUMENT_COMPLETENESS - Documents by company & FY
    # Uses unnest to expand the financial_years array
    # ============================================
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
      -- Unnest the financial_years array to get one row per FY
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

      -- Indexes for common query patterns
      CREATE INDEX ON mv_document_completeness(company_id);
      CREATE INDEX ON mv_document_completeness(company_code);
      CREATE INDEX ON mv_document_completeness(financial_year);
      CREATE INDEX ON mv_document_completeness(document_type);
      CREATE INDEX ON mv_document_completeness(document_category);
      CREATE INDEX ON mv_document_completeness(company_id, financial_year);
    SQL
  end

  def down
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_document_completeness CASCADE"
  end
end
