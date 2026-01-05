module Api
  module V1
    class OrganizationController < ApplicationController
      # Note: authorize_request is already called by ApplicationController
      # Security: Stats endpoints expose org-wide data, require admin
      before_action :require_admin, only: %i[microsoft_org_stats data_stats]

      # GET /api/v1/organization_settings
      # Returns organization settings including job folder name format
      def settings
        company_setting = CorporateCompanySetting.instance

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
        company_setting = CorporateCompanySetting.instance

        if params[:job_folder_name_format].present?
          company_setting.job_folder_name_format = params[:job_folder_name_format].to_unsafe_h
        end

        if company_setting.save
          render json: { success: true, message: "Settings updated successfully" }
        else
          render json: { success: false, errors: company_setting.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/organization/microsoft_org_stats
      # Returns statistics for each connected Microsoft 365 organization
      def microsoft_org_stats
        # SSoT: Use MicrosoftCredential
        all_credentials = MicrosoftCredential.app_credentials.order(:name)

        # SSoT: Use MicrosoftCredential::KNOWN_ORG_NAMES for all possible orgs
        all_org_names = MicrosoftCredential::KNOWN_ORG_NAMES

        org_stats = all_org_names.map do |org_name|
          credential = all_credentials.find { |c| c.name == org_name }

          if credential&.status == "connected"
            # Get email stats for this org
            emails = EmailWarehouse.for_microsoft_credential(credential.id)
            total_size = emails.sum("COALESCE(LENGTH(body_text), 0) + COALESCE(LENGTH(body_html), 0)") || 0

            # Per-mailbox (per-person) stats
            per_mailbox_stats = emails
              .where.not(mailbox_owner_email: [ nil, "" ])
              .group(:mailbox_owner_email)
              .select("mailbox_owner_email, COUNT(*) as email_count, MAX(last_synced_at) as last_sync")
              .order("email_count DESC")
              .map do |row|
                {
                  mailbox: row.mailbox_owner_email,
                  email_count: row.email_count,
                  last_sync: row.last_sync
                }
              end

            {
              name: org_name,
              connected: true,
              credential_id: credential.id,
              tenant_id: credential.tenant_id,
              status: credential.status,
              last_sync_at: credential.last_sync_at,
              admin_consent_granted_at: credential.admin_consent_granted_at,
              admin_consent_granted_by: credential.admin_consent_granted_by,
              stats: {
                emails: emails.count,
                email_storage_bytes: total_size,
                linked_to_job: emails.where.not(job_id: nil).count,
                last_email_received: emails.maximum(:received_at),
                per_mailbox: per_mailbox_stats
              }
            }
          else
            {
              name: org_name,
              connected: false,
              credential_id: credential&.id,
              status: credential&.status || "not_configured",
              stats: {
                emails: 0,
                email_storage_bytes: 0,
                linked_to_job: 0,
                last_email_received: nil,
                per_mailbox: []
              }
            }
          end
        end

        render json: {
          success: true,
          organizations: org_stats,
          total_connected: org_stats.count { |o| o[:connected] },
          total_emails: EmailWarehouse.count,
          generated_at: Time.current
        }
      end

      # GET /api/v1/organization/document_provider
      # Returns the organization's current document storage provider configuration
      def document_provider
        organization = Organization.first

        if organization.nil?
          return render json: {
            success: true,
            data: {
              document_provider: "sharepoint",
              available_providers: Organization::DOCUMENT_PROVIDERS,
              s3_credentials: [],
              can_switch: false,
              message: "No organization found. Using default SharePoint."
            }
          }
        end

        # Get available S3 credentials for dropdown
        s3_credentials = S3CompatibleCredential.active.order(:name).map do |cred|
          {
            id: cred.id,
            name: cred.name,
            provider_type: cred.provider_type,
            bucket: cred.bucket,
            status: cred.status,
            connected: cred.status == "connected"
          }
        end

        # SSoT: Use MicrosoftCredential for SharePoint status
        sharepoint_configured = begin
          MicrosoftCredential.sharepoint_credential.present?
        rescue StandardError
          false
        end

        render json: {
          success: true,
          data: {
            document_provider: organization.document_provider,
            document_provider_credential_id: organization.document_provider_credential_id,
            available_providers: Organization::DOCUMENT_PROVIDERS,
            s3_credentials: s3_credentials,
            sharepoint_configured: sharepoint_configured,
            can_switch: s3_credentials.any?(&:connected) || sharepoint_configured
          }
        }
      end

      # PUT /api/v1/organization/document_provider
      # Updates the organization's document storage provider
      def update_document_provider
        organization = Organization.first

        if organization.nil?
          return render json: {
            success: false,
            error: "No organization found"
          }, status: :not_found
        end

        provider = params[:document_provider]
        credential_id = params[:document_provider_credential_id]

        unless Organization::DOCUMENT_PROVIDERS.include?(provider)
          return render json: {
            success: false,
            error: "Invalid provider. Must be one of: #{Organization::DOCUMENT_PROVIDERS.join(', ')}"
          }, status: :unprocessable_entity
        end

        # Validate credential if switching to S3
        if provider == "s3_compatible"
          if credential_id.blank?
            return render json: {
              success: false,
              error: "Please select an S3 credential to use"
            }, status: :unprocessable_entity
          end

          credential = S3CompatibleCredential.find_by(id: credential_id)
          unless credential&.status == "connected"
            return render json: {
              success: false,
              error: "Selected S3 credential is not connected. Please test the connection first."
            }, status: :unprocessable_entity
          end
        end

        old_provider = organization.document_provider
        organization.document_provider = provider
        organization.document_provider_credential_id = provider == "s3_compatible" ? credential_id : nil

        if organization.save
          Rails.logger.info "[DocumentProvider] Organization switched from #{old_provider} to #{provider}"

          render json: {
            success: true,
            message: "Document provider updated to #{provider}",
            data: {
              document_provider: organization.document_provider,
              document_provider_credential_id: organization.document_provider_credential_id
            }
          }
        else
          render json: {
            success: false,
            errors: organization.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/organization/document_migration_status
      # Returns current document migration status
      def document_migration_status
        status = DocumentMigrationService.migration_status

        render json: {
          success: true,
          data: status
        }
      end

      # POST /api/v1/organization/start_document_migration
      # Starts migration of documents from one provider to another
      def start_document_migration
        from_provider = params[:from_provider]
        to_provider = params[:to_provider]
        delete_source = params[:delete_source] == true || params[:delete_source] == "true"

        unless from_provider.present? && to_provider.present?
          return render json: {
            success: false,
            error: "Both from_provider and to_provider are required"
          }, status: :unprocessable_entity
        end

        result = DocumentMigrationService.start_migration(
          from: from_provider,
          to: to_provider,
          delete_source: delete_source
        )

        if result[:success]
          render json: {
            success: true,
            data: result
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/organization/cancel_document_migration
      # Cancels any pending document migrations
      def cancel_document_migration
        result = DocumentMigrationService.cancel_migration

        render json: {
          success: true,
          data: result
        }
      end

      # POST /api/v1/organization/retry_failed_migrations
      # Retries any failed document migrations
      def retry_failed_migrations
        delete_source = params[:delete_source] == true || params[:delete_source] == "true"

        result = DocumentMigrationService.retry_failed(delete_source: delete_source)

        render json: {
          success: true,
          data: result
        }
      end

      # GET /api/v1/organization/estimate_migration
      # Estimates time and resources for migration
      def estimate_migration
        from_provider = params[:from_provider] || 'sharepoint'

        result = DocumentMigrationService.estimate_migration(from: from_provider)

        render json: {
          success: true,
          data: result
        }
      end

      # GET /api/v1/organization/data_stats
      # Returns organization-wide data warehouse statistics
      # Performance: Cached for 10 minutes (expensive email_warehouse queries)
      def data_stats
        # Skip cache only for admins (prevents DoS via forced cache refresh)
        skip_cache = params[:refresh] == "true" && current_user&.admin?
        cache_key = "organization:data_stats"

        # Try to get from cache first (10 minute TTL - stats don't change often)
        unless skip_cache
          cached_result = Rails.cache.read(cache_key)
          if cached_result
            return render json: cached_result.merge(from_cache: true)
          end
        end

        # Get company settings for organization name
        company_setting = CorporateCompanySetting.first

        # Document statistics (all company_documents)
        documents = CorporateCompanyDocument.all
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
          .joins("LEFT JOIN document_types ON document_types.name = corporate_company_documents.document_type")
          .select("corporate_company_documents.document_type, document_types.abbreviation, COUNT(*) as doc_count")
          .group("corporate_company_documents.document_type, document_types.abbreviation")
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

          # AI Classification breakdown - single GROUP BY query instead of 5 individual COUNTs
          classification_counts = EmailWarehouse.group("email_classification->>'email_type'").count
          spam_count = classification_counts["spam"] || 0
          marketing_count = classification_counts["marketing"] || 0
          transactional_count = classification_counts["transactional"] || 0
          business_count = classification_counts["business"] || 0
          # nil key represents unclassified (NULL or empty classification)
          unclassified_count = classification_counts[nil] || 0
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
        # SSoT: Use MicrosoftCredential for delegated credentials
        # Note: company_documents uses last_modified_at (not synced_at) for OneDrive sync timestamps
        onedrive_credential = MicrosoftCredential.delegated_credentials.org_level.active.connected.first rescue nil
        sharepoint_stats = {
          connected: onedrive_credential.present?,
          site_url: onedrive_credential&.drive_name || "SharePoint",
          site_path: onedrive_credential&.root_folder_path || "/Shared Documents",
          total_synced: documents.where(source: "onedrive").count,
          last_sync: onedrive_credential&.last_synced_at || documents.where(source: "onedrive").maximum(:last_modified_at)
        }

        # Xero stats - SSoT: Filter connections by XeroConnectionHealth
        all_xero_connections = CorporateCompanyXeroConnection.includes(:xero_credential).where.not(xero_credential_id: nil)
        connected_xero_connections = all_xero_connections.select(&:connected?)
        xero_stats = {
          connected: connected_xero_connections.any?,
          tenant_name: connected_xero_connections.first&.xero_tenant_name,
          companies_connected: connected_xero_connections.count,
          last_sync: all_xero_connections.maximum(:last_sync_at)
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
        active_companies = CorporateCompany.where(active: [ true, nil ])
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

        result = {
          success: true,
          data: {
            organization: {
              name: company_setting&.company_name || "Organization",
              total_companies: CorporateCompany.count,
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

        # Cache for 10 minutes
        Rails.cache.write(cache_key, result, expires_in: 10.minutes)

        render json: result.merge(from_cache: false)
      end
    end
  end
end
