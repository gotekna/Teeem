module Api
  module V1
    class OrganizationController < ApplicationController
      # Note: authorize_request is already called by ApplicationController

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
          verified_count: documents.where(ai_verification_status: 'verified').count,
          needs_review_count: documents.where(ai_verification_status: %w[mismatch needs_review pending]).count,
          total_file_size: documents.sum(:file_size) || 0,
          latest_upload: documents.maximum(:created_at)
        }

        # Document types breakdown
        doc_type_stats = documents
          .joins("LEFT JOIN document_types ON document_types.name = company_documents.document_type")
          .select("company_documents.document_type, document_types.abbreviation, COUNT(*) as count")
          .group("company_documents.document_type, document_types.abbreviation")
          .order("count DESC")
          .limit(15)
          .map { |d| { type: d.document_type, abbreviation: d.abbreviation, count: d.count } }

        # Email statistics with detailed breakdown
        email_stats = if defined?(EmailWarehouse)
          total_size = EmailWarehouse.sum("COALESCE(LENGTH(body_text), 0) + COALESCE(LENGTH(body_html), 0)") || 0
          {
            total_emails: EmailWarehouse.count,
            total_size: total_size,
            linked_to_contact: EmailWarehouse.where.not(contact_id: nil).count,
            linked_to_job: EmailWarehouse.where.not(job_id: nil).count,
            linked_to_company: EmailWarehouse.where.not(company_id: nil).count,
            linked_to_company_group: EmailWarehouse.where.not(company_group_id: nil).count,
            junk_emails: EmailWarehouse.where(is_junk: true).count,
            unprocessed: EmailWarehouse.where(processed: false).count,
            last_sync: EmailWarehouse.maximum(:created_at),
            # Size breakdown by category
            size_by_contact: EmailWarehouse.where.not(contact_id: nil).sum("COALESCE(LENGTH(body_text), 0) + COALESCE(LENGTH(body_html), 0)") || 0,
            size_by_job: EmailWarehouse.where.not(job_id: nil).sum("COALESCE(LENGTH(body_text), 0) + COALESCE(LENGTH(body_html), 0)") || 0,
            size_by_company: EmailWarehouse.where.not(company_id: nil).sum("COALESCE(LENGTH(body_text), 0) + COALESCE(LENGTH(body_html), 0)") || 0,
            size_junk: EmailWarehouse.where(is_junk: true).sum("COALESCE(LENGTH(body_text), 0) + COALESCE(LENGTH(body_html), 0)") || 0
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
            size_junk: 0
          }
        end

        # SharePoint stats
        onedrive_credential = OrganizationOneDriveCredential.active_credential rescue nil
        sharepoint_stats = {
          connected: onedrive_credential.present?,
          site_url: onedrive_credential&.site_url || "gotekna.sharepoint.com/sites/TEEEM",
          site_path: onedrive_credential&.site_path || "/Shared Documents",
          total_synced: documents.where(source: 'onedrive').count,
          last_sync: documents.where(source: 'onedrive').maximum(:synced_at)
        }

        # Xero stats
        xero_connections = CompanyXeroConnection.where(connection_status: 'connected')
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
            revit_files: JobDocument.where("file_extension IN (?)", ['.rvt', '.rfa']).count,
            autocad_files: JobDocument.where("file_extension IN (?)", ['.dwg', '.dxf']).count,
            pdf_files: JobDocument.where(file_extension: '.pdf').count,
            image_files: JobDocument.where("file_extension IN (?)", ['.jpg', '.jpeg', '.png', '.gif', '.heic']).count,
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
