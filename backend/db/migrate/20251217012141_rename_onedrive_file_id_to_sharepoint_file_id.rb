class RenameOnedriveFileIdToSharepointFileId < ActiveRecord::Migration[8.0]
  def up
    # Rename column on both tables that have onedrive_file_id
    rename_column :company_documents, :onedrive_file_id, :sharepoint_file_id
    rename_column :corporate_company_documents, :onedrive_file_id, :sharepoint_file_id

    # Recreate mv_document_summary with new column name
    execute <<-SQL
      DROP MATERIALIZED VIEW IF EXISTS mv_document_summary;
      CREATE MATERIALIZED VIEW mv_document_summary AS
      SELECT
        cd.company_id,
        cd.company_code,
        cd.document_type,
        dt.category AS document_category,
        dt.primary_tab,
        cd.folder,
        cd.source,
        cd.ai_verification_status,
        EXTRACT(YEAR FROM cd.document_date)::integer AS document_year,
        COUNT(*) AS document_count,
        COUNT(*) FILTER (WHERE cd.file_url IS NOT NULL OR cd.sharepoint_file_id IS NOT NULL) AS with_file_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'verified') AS verified_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'mismatch') AS mismatch_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'pending' OR cd.ai_verification_status IS NULL) AS pending_count,
        MAX(cd.created_at) AS latest_upload,
        COALESCE(SUM(cd.file_size), 0) AS total_file_size_bytes,
        NOW() AS refreshed_at
      FROM corporate_company_documents cd
      LEFT JOIN document_types dt ON dt.id = cd.document_type_id
      GROUP BY cd.company_id, cd.company_code, cd.document_type, dt.category, dt.primary_tab,
               cd.folder, cd.source, cd.ai_verification_status, EXTRACT(YEAR FROM cd.document_date);
    SQL
  end

  def down
    # Rename back
    rename_column :company_documents, :sharepoint_file_id, :onedrive_file_id
    rename_column :corporate_company_documents, :sharepoint_file_id, :onedrive_file_id

    # Recreate mv_document_summary with old column name
    execute <<-SQL
      DROP MATERIALIZED VIEW IF EXISTS mv_document_summary;
      CREATE MATERIALIZED VIEW mv_document_summary AS
      SELECT
        cd.company_id,
        cd.company_code,
        cd.document_type,
        dt.category AS document_category,
        dt.primary_tab,
        cd.folder,
        cd.source,
        cd.ai_verification_status,
        EXTRACT(YEAR FROM cd.document_date)::integer AS document_year,
        COUNT(*) AS document_count,
        COUNT(*) FILTER (WHERE cd.file_url IS NOT NULL OR cd.onedrive_file_id IS NOT NULL) AS with_file_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'verified') AS verified_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'mismatch') AS mismatch_count,
        COUNT(*) FILTER (WHERE cd.ai_verification_status = 'pending' OR cd.ai_verification_status IS NULL) AS pending_count,
        MAX(cd.created_at) AS latest_upload,
        COALESCE(SUM(cd.file_size), 0) AS total_file_size_bytes,
        NOW() AS refreshed_at
      FROM corporate_company_documents cd
      LEFT JOIN document_types dt ON dt.id = cd.document_type_id
      GROUP BY cd.company_id, cd.company_code, cd.document_type, dt.category, dt.primary_tab,
               cd.folder, cd.source, cd.ai_verification_status, EXTRACT(YEAR FROM cd.document_date);
    SQL
  end
end
