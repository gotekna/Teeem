class CreateDocumentFoundationsAndColumns < ActiveRecord::Migration[8.0]
  def up
    # ============================================================================
    # Part 1: Create Document Types Foundation
    # ============================================================================

    document_types_foundation = Foundation.create!(
      name: "Document Types",
      singular_name: "Document Type",
      plural_name: "Document Types",
      database_table_name: "document_types",
      model_class: "DocumentType",
      table_type: "system",
      icon: "file-text",
      title_column: "name",
      slug: "document-types",
      searchable: true,
      is_live: true,
      has_saved_views: true,
      has_ui: true,
      feature: "Corporate"
    )

    puts "Created Document Types foundation with ID: #{document_types_foundation.id}"

    # Define columns for Document Types
    document_type_columns = [
      { column_name: "name", name: "Name", column_type: "single_line_text", required: true, is_title: true, is_unique: true, position: 1, searchable: true },
      { column_name: "abbreviation", name: "Code", column_type: "single_line_text", position: 2, searchable: true },
      { column_name: "folder", name: "Folder", column_type: "choice", position: 3 },
      { column_name: "primary_tab", name: "Primary Tab", column_type: "choice", position: 4 },
      { column_name: "tabs", name: "Additional Tabs", column_type: "structured_data", position: 5 },
      { column_name: "naming_format", name: "Naming Format", column_type: "single_line_text", position: 6 },
      { column_name: "category", name: "Category", column_type: "choice", position: 7 },
      { column_name: "description", name: "Description", column_type: "multiple_lines_text", position: 8 },
      { column_name: "requires_filing", name: "Requires Filing", column_type: "boolean", position: 9 },
      { column_name: "retention_years", name: "Retention Years", column_type: "whole_number", position: 10 },
      { column_name: "active", name: "Active", column_type: "boolean", position: 11 }
    ]

    document_type_columns.each do |col_attrs|
      Column.create!(col_attrs.merge(foundation_id: document_types_foundation.id))
    end

    puts "Created #{document_type_columns.count} columns for Document Types"

    # ============================================================================
    # Part 2: Add missing columns to Company Documents Foundation
    # SSoT: Use slug lookup, not hardcoded numeric ID (differs per environment)
    # ============================================================================

    company_documents_foundation = Foundation.find_by(slug: "company_documents")

    if company_documents_foundation
      # Update foundation attributes
      company_documents_foundation.update!(
        model_class: "CompanyDocument",
        icon: "folder",
        title_column: "display_title",
        feature: "Corporate"
      )

      # Get existing columns
      existing_columns = Column.where(foundation_id: company_documents_foundation.id).pluck(:column_name)

      # SSoT: Look up corporate_companies foundation ID dynamically
      corporate_companies_foundation = Foundation.find_by(slug: "corporate_companies")
      corporate_companies_id = corporate_companies_foundation&.id

      # Define all columns for Company Documents
      company_document_columns = [
        { column_name: "title", name: "Filename", column_type: "single_line_text", required: true, position: 1, searchable: true },
        { column_name: "display_title", name: "Display Title", column_type: "single_line_text", is_title: true, position: 2, searchable: true },
        { column_name: "document_type", name: "Type", column_type: "choice", position: 3 },
        { column_name: "folder", name: "Folder", column_type: "choice", position: 4 },
        { column_name: "source", name: "Source", column_type: "choice", position: 5 },
        { column_name: "document_date", name: "Document Date", column_type: "date", position: 6 },
        { column_name: "financial_years", name: "Financial Years", column_type: "structured_data", position: 7 },
        { column_name: "company_id", name: "Company", column_type: "lookup", lookup_foundation_id: corporate_companies_id, lookup_display_column: "name", position: 8 },
        { column_name: "file_size", name: "File Size", column_type: "whole_number", position: 9 },
        { column_name: "file_url", name: "File URL", column_type: "url", position: 10 },
        { column_name: "ai_verification_status", name: "AI Verification", column_type: "choice", position: 11 },
        { column_name: "user_validated_at", name: "Validated At", column_type: "date_and_time", position: 12 },
        { column_name: "onedrive_file_id", name: "OneDrive ID", column_type: "single_line_text", position: 13 }
      ]

      added_count = 0
      company_document_columns.each do |col_attrs|
        unless existing_columns.include?(col_attrs[:column_name])
          Column.create!(col_attrs.merge(foundation_id: company_documents_foundation.id))
          added_count += 1
        end
      end

      puts "Added #{added_count} new columns to Company Documents (slug: company_documents, id: #{company_documents_foundation.id})"
    else
      puts "Warning: Company Documents foundation (slug: company_documents) not found - skipping"
    end
  end

  def down
    # Remove Document Types foundation and its columns
    doc_types = Foundation.find_by(slug: "document-types")
    if doc_types
      Column.where(foundation_id: doc_types.id).destroy_all
      doc_types.destroy
      puts "Removed Document Types foundation and columns"
    end

    # Remove added columns from Company Documents (keep original 'title' column)
    # SSoT: Use slug lookup, not hardcoded numeric ID
    company_docs = Foundation.find_by(slug: "company_documents")
    if company_docs
      added_columns = %w[display_title document_type folder source document_date financial_years
                         company_id file_size file_url ai_verification_status user_validated_at onedrive_file_id]
      Column.where(foundation_id: company_docs.id, column_name: added_columns).destroy_all
      puts "Removed added columns from Company Documents (slug: company_documents)"
    end
  end
end
