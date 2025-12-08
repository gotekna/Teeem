module Api
  module V1
    class OrganizationController < ApplicationController
      # Note: authorize_request is already called by ApplicationController

      # GET /api/v1/organization_settings
      # Returns organization settings including job folder name format
      def settings
        company_setting = CompanySetting.instance

        render json: {
          success: true,
          job_folder_name_format: company_setting.job_folder_name_format || {
            fields: [ "street_number", "street_name", "suburb" ],
            separators: { "0" => " ", "1" => ", " }
          }
        }
      end

      # PATCH /api/v1/organization_settings
      # Updates organization settings
      def update_settings
        company_setting = CompanySetting.instance

        if params[:job_folder_name_format].present?
          company_setting.job_folder_name_format = params[:job_folder_name_format].to_unsafe_h
        end

        if company_setting.save
          render json: { success: true, message: "Settings updated successfully" }
        else
          render json: { success: false, errors: company_setting.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/organization/data_stats
      # Returns organization-wide data warehouse statistics
      def data_stats
        # Get company settings for organization name
        company_setting = CompanySetting.first

        # Document statistics (all company_documents)
        documents = CompanyDocument.all
        doc_stats = {
          total_documents: documents.count,
          by_source: documents.group(:source).count,
          by_folder: documents.group(:folder).count,
          by_ai_status: documents.group(:ai_verification_status).count,
          verified_count: documents.where(ai_verification_status: "verified").count,
          needs_review_count: documents.where(ai_verification_status: %w[mismatch needs_review pending]).count,
          total_file_size: documents.sum(:file_size) || 0,
          latest_upload: documents.maximum(:created_at)
        }

        # Document types breakdown
        doc_type_stats = documents
          .joins("LEFT JOIN document_types ON document_types.name = company_documents.document_type")
          .select("company_documents.document_type, document_types.abbreviation, COUNT(*) as doc_count")
          .group("company_documents.document_type, document_types.abbreviation")
          .order("doc_count DESC")
          .limit(15)
          .map { |d| { type: d.document_type, abbreviation: d.abbreviation, count: d.doc_count } }

        # Email statistics with detailed breakdown
        # Note: email_warehouse table only has job_id for linking (no contact_id, company_id, etc.)
        email_stats = if defined?(EmailWarehouse)
          total_count = EmailWarehouse.count
          total_size = EmailWarehouse.sum("COALESCE(LENGTH(body_text), 0) + COALESCE(LENGTH(body_html), 0)") || 0
          linked_to_job = EmailWarehouse.where.not(job_id: nil).count
          size_by_job = EmailWarehouse.where.not(job_id: nil).sum("COALESCE(LENGTH(body_text), 0) + COALESCE(LENGTH(body_html), 0)") || 0

          # AI Classification breakdown
          spam_count = EmailWarehouse.where("email_classification->>'email_type' = ?", "spam").count
          marketing_count = EmailWarehouse.where("email_classification->>'email_type' = ?", "marketing").count
          transactional_count = EmailWarehouse.where("email_classification->>'email_type' = ?", "transactional").count
          business_count = EmailWarehouse.where("email_classification->>'email_type' = ?", "business").count
          unclassified_count = EmailWarehouse.where("email_classification IS NULL OR email_classification = '{}'").count
          classified_count = total_count - unclassified_count

          # SSoT migration progress
          with_direction = EmailWarehouse.where.not(direction: nil).count
          with_body_preview = EmailWarehouse.where("body_preview IS NOT NULL AND body_preview != ''").count

          {
            total_emails: total_count,
            total_size: total_size,
            linked_to_contact: 0,  # Not tracked in email_warehouse
            linked_to_job: linked_to_job,
            linked_to_company: 0,  # Not tracked in email_warehouse
            linked_to_company_group: 0,  # Not tracked in email_warehouse
            junk_emails: spam_count,
            unprocessed: unclassified_count,
            last_sync: EmailWarehouse.maximum(:last_synced_at) || EmailWarehouse.maximum(:created_at),
            # Size breakdown by category
            size_by_contact: 0,
            size_by_job: size_by_job,
            size_by_company: 0,
            size_junk: 0,
            # AI Classification
            ai_classification: {
              spam: spam_count,
              marketing: marketing_count,
              transactional: transactional_count,
              business: business_count,
              unclassified: unclassified_count,
              classified_count: classified_count,
              classification_rate: total_count > 0 ? ((classified_count.to_f / total_count) * 100).round(1) : 0
            },
            # SSoT migration
            ssot_migration: {
              with_direction: with_direction,
              with_body_preview: with_body_preview,
              direction_rate: total_count > 0 ? ((with_direction.to_f / total_count) * 100).round(1) : 0,
              body_preview_rate: total_count > 0 ? ((with_body_preview.to_f / total_count) * 100).round(1) : 0
            }
          }
        else
          {
            total_emails: 0,
            total_size: 0,
            linked_to_contact: 0,
            linked_to_job: 0,
            linked_to_company: 0,
            linked_to_company_group: 0,
            junk_emails: 0,
            unprocessed: 0,
            last_sync: nil,
            size_by_contact: 0,
            size_by_job: 0,
            size_by_company: 0,
            size_junk: 0,
            ai_classification: {
              spam: 0, marketing: 0, transactional: 0, business: 0, unclassified: 0,
              classified_count: 0, classification_rate: 0
            },
            ssot_migration: {
              with_direction: 0, with_body_preview: 0, direction_rate: 0, body_preview_rate: 0
            }
          }
        end

        # SharePoint stats
        # Note: OrganizationOneDriveCredential has drive_name, root_folder_path but not site_url/site_path
        # Note: company_documents uses last_modified_at (not synced_at) for OneDrive sync timestamps
        onedrive_credential = OrganizationOneDriveCredential.active_credential rescue nil
        sharepoint_stats = {
          connected: onedrive_credential.present?,
          site_url: onedrive_credential&.drive_name || "SharePoint",
          site_path: onedrive_credential&.root_folder_path || "/Shared Documents",
          total_synced: documents.where(source: "onedrive").count,
          last_sync: onedrive_credential&.last_synced_at || documents.where(source: "onedrive").maximum(:last_modified_at)
        }

        # Xero stats
        xero_connections = CompanyXeroConnection.where(connection_status: "connected")
        xero_stats = {
          connected: xero_connections.exists?,
          tenant_name: xero_connections.first&.xero_tenant_name,
          companies_connected: xero_connections.count,
          last_sync: xero_connections.maximum(:last_sync_at)
        }

        # Job documents (CAD/BIM files) stats
        job_doc_stats = if defined?(JobDocument)
          {
            total_files: JobDocument.count,
            revit_files: JobDocument.where("file_extension IN (?)", [ ".rvt", ".rfa" ]).count,
            autocad_files: JobDocument.where("file_extension IN (?)", [ ".dwg", ".dxf" ]).count,
            pdf_files: JobDocument.where(file_extension: ".pdf").count,
            image_files: JobDocument.where("file_extension IN (?)", [ ".jpg", ".jpeg", ".png", ".gif", ".heic" ]).count,
            total_size: JobDocument.sum(:file_size) || 0
          }
        else
          # Estimate from company documents
          {
            total_files: 0,
            revit_files: 0,
            autocad_files: 0,
            pdf_files: documents.where("title LIKE ?", "%.pdf").count,
            image_files: documents.where("title LIKE ? OR title LIKE ? OR title LIKE ?", "%.jpg", "%.png", "%.jpeg").count,
            total_size: 0
          }
        end

        # Corporate (Companies) stats
        active_companies = Company.where(active: [ true, nil ])
        total_companies = active_companies.count
        missing_abn = active_companies.where(abn: [ nil, "" ]).count
        missing_acn = active_companies.where(acn: [ nil, "" ])
                                      .where("entity_type ILIKE '%pty%' OR entity_type ILIKE '%proprietary%' OR entity_type ILIKE '%limited%'")
                                      .count
        missing_review = active_companies.where(review_date: nil).count
        overdue_review = active_companies.where("review_date < ?", Date.current).count
        entity_type_breakdown = active_companies.group(:entity_type).count.transform_keys { |k| k || "Unknown" }

        corporate_stats = {
          total: total_companies,
          active: total_companies,
          missing_abn: missing_abn,
          missing_acn: missing_acn,
          missing_review_date: missing_review,
          overdue_review: overdue_review,
          by_entity_type: entity_type_breakdown,
          health_rate: total_companies > 0 ? (((total_companies - missing_abn - overdue_review).to_f / total_companies) * 100).round(1) : 100
        }

        render json: {
          success: true,
          data: {
            organization: {
              name: company_setting&.company_name || "Organization",
              total_companies: Company.count,
              total_jobs: Job.count
            },
            documents: doc_stats,
            document_types: doc_type_stats,
            emails: email_stats,
            corporate: corporate_stats,
            sharepoint: sharepoint_stats,
            xero: xero_stats,
            job_documents: job_doc_stats,
            last_updated: Time.current
          }
        }
      end
    end
  end
end
