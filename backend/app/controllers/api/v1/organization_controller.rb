module Api
  module V1
    class OrganizationController < ApplicationController
      include CacheConstants
      # Note: authorize_request is already called by ApplicationController
      # Security: Stats endpoints expose org-wide data, require admin
      before_action :require_admin, only: %i[microsoft_org_stats data_stats]

      # GET /api/v1/organization_settings
      # SSoT: Returns folder templates from WarehouseProvider
      def settings
        config = WarehouseProvider.instance

        render json: {
          success: true,
          # SSoT: Use WarehouseProvider.path_for for folder templates
          job_folder_template: config&.path_for(:job) || "{{JobCode}}/{{TabName}}",
          contact_folder_template: config&.path_for(:contact) || "{{ContactId}} - {{ContactName}}"
        }
      end

      # PATCH /api/v1/organization_settings
      # SSoT: Updates folder templates in WarehouseProvider
      def update_settings
        config = WarehouseProvider.instance
        templates = config.templates || {}

        templates["job"] = params[:job_folder_template] if params[:job_folder_template].present?
        templates["contact"] = params[:contact_folder_template] if params[:contact_folder_template].present?

        if config.update(templates: templates)
          render json: { success: true, message: "Settings updated successfully" }
        else
          render_validation_errors(config)
        end
      end

      # GET /api/v1/organization/microsoft_org_stats
      # Returns statistics for each connected Microsoft 365 organization
      def microsoft_org_stats
        # SSoT: Use MicrosoftCredential
        # FRC (Feb 2026): Must be tenant-scoped - prevent cross-tenant credential access
        all_credentials = MicrosoftCredential.for_tenant(current_tenant).app_credentials.order(:name)

        # SSoT: Get org names dynamically from database (Jan 2026)
        # FRC (Feb 2026): Inline known_org_names since .for_tenant() scope can't chain with class method
        all_org_names = all_credentials.distinct.pluck(:name).compact.reject(&:blank?)

        org_stats = all_org_names.map do |org_name|
          credential = all_credentials.find { |c| c.name == org_name }

          if credential&.status == "connected"
            # Get email stats for this org
            emails = SyncedEmail.for_microsoft_credential(credential.id)
            total_count = emails.count
            total_size = emails.sum("COALESCE(LENGTH(body_text), 0) + COALESCE(LENGTH(body_html), 0)") || 0
            linked_to_job = emails.where.not(job_id: nil).count
            size_by_job = emails.where.not(job_id: nil).sum("COALESCE(LENGTH(body_text), 0) + COALESCE(LENGTH(body_html), 0)") || 0

            # Per-mailbox (per-person) stats - include ALL mailboxes, even unknown
            # SSoT: SyncedEmail is the source of truth for all email data
            per_mailbox_base = emails
              .select("COALESCE(NULLIF(mailbox_owner_email, ''), 'Unknown') as mailbox_owner_email, COUNT(*) as email_count, MAX(last_synced_at) as last_sync, MAX(received_at) as last_email_received")
              .group("COALESCE(NULLIF(mailbox_owner_email, ''), 'Unknown')")
              .order("email_count DESC")

            # AI Classification breakdown (same as data_stats)
            classification_counts = emails.group("email_classification->>'email_type'").count
            spam_count = classification_counts["spam"] || 0
            marketing_count = classification_counts["marketing"] || 0
            transactional_count = classification_counts["transactional"] || 0
            business_count = classification_counts["business"] || 0
            unclassified_count = classification_counts[nil] || 0
            classified_count = total_count - unclassified_count

            # SSoT migration progress
            with_direction = emails.where.not(direction: nil).count
            with_body_preview = emails.where("body_preview IS NOT NULL AND body_preview != ''").count

            # === Storage Location Transparency ===
            # Email storage breakdown (Wasabi vs SharePoint legacy)
            wasabi_emails = emails.where("storage_path IS NOT NULL AND storage_path != ''").count
            sharepoint_emails = emails.where("(storage_path IS NULL OR storage_path = '')")
                                      .where("storage_email_path IS NOT NULL AND storage_email_path != ''")
                                      .count
            wasabi_email_bytes = emails.where("storage_path IS NOT NULL AND storage_path != ''")
                                       .sum("COALESCE(LENGTH(body_text), 0) + COALESCE(LENGTH(body_html), 0)") || 0
            sharepoint_email_bytes = emails.where("(storage_path IS NULL OR storage_path = '')")
                                           .where("storage_email_path IS NOT NULL AND storage_email_path != ''")
                                           .sum("COALESCE(LENGTH(body_text), 0) + COALESCE(LENGTH(body_html), 0)") || 0

            # Attachment storage breakdown - SSoT (Jan 2026): WarehouseDocument with source_type='email_attachment'
            email_ids = emails.pluck(:id)
            attachments = WarehouseDocument.where(source_type: "email_attachment")
                                           .where("metadata->>'synced_email_id' IN (?)", email_ids.map(&:to_s))
            total_attachments = attachments.count
            wasabi_attachments = attachments.where.not(storage_blob_id: nil).count
            sharepoint_attachments = 0  # Legacy SharePoint path no longer used

            # Deduplication stats (how many unique blobs vs total references)
            blob_ids_with_count = attachments.where.not(storage_blob_id: nil).pluck(:storage_blob_id)
            unique_blob_count = blob_ids_with_count.uniq.count
            dedup_savings_count = blob_ids_with_count.count - unique_blob_count
            # Calculate bytes saved by deduplication
            dedup_savings_bytes = if unique_blob_count > 0
              avg_blob_size = StorageBlob.where(id: blob_ids_with_count.uniq).average(:file_size)&.to_i || 0
              dedup_savings_count * avg_blob_size
            else
              0
            end

            # Per-mailbox attachment counts - include ALL mailboxes
            per_mailbox_attachment_counts = attachments
              .joins("INNER JOIN synced_emails ON synced_emails.id = CAST(warehouse_documents.metadata->>'synced_email_id' AS INTEGER)")
              .group("COALESCE(NULLIF(synced_emails.mailbox_owner_email, ''), 'Unknown')")
              .count

            # Shared attachments per mailbox - include ALL mailboxes
            shared_per_mailbox = attachments
              .joins("INNER JOIN synced_emails ON synced_emails.id = CAST(warehouse_documents.metadata->>'synced_email_id' AS INTEGER)")
              .joins("INNER JOIN storage_blobs ON storage_blobs.id = warehouse_documents.storage_blob_id")
              .where("storage_blobs.reference_count > 1")
              .group("COALESCE(NULLIF(synced_emails.mailbox_owner_email, ''), 'Unknown')")
              .count

            # Per-mailbox email storage counts - include ALL mailboxes
            per_mailbox_wasabi_counts = emails
              .where("storage_path IS NOT NULL AND storage_path != ''")
              .group("COALESCE(NULLIF(mailbox_owner_email, ''), 'Unknown')")
              .count

            per_mailbox_sharepoint_counts = emails
              .where("(storage_path IS NULL OR storage_path = '')")
              .where("storage_email_path IS NOT NULL AND storage_email_path != ''")
              .group("COALESCE(NULLIF(mailbox_owner_email, ''), 'Unknown')")
              .count

            # Per-mailbox attachment storage counts - SSoT (Jan 2026): WarehouseDocument
            per_mailbox_att_wasabi = attachments
              .joins("INNER JOIN synced_emails ON synced_emails.id = CAST(warehouse_documents.metadata->>'synced_email_id' AS INTEGER)")
              .where.not(storage_blob_id: nil)
              .group("COALESCE(NULLIF(synced_emails.mailbox_owner_email, ''), 'Unknown')")
              .count

            # Note: SharePoint path no longer used for email attachments (all via StorageBlob now)
            per_mailbox_att_sharepoint = {}

            # Document storage breakdown (Tekna tenant only - org-wide)
            # SSoT (Jan 2026): Uses WarehouseDocument with StorageBlob
            document_storage = if org_name == "Tekna"
              doc_by_provider = { "s3_compatible" => 0, "sharepoint" => 0, "unknown" => 0 }
              # Group WarehouseDocuments by storage provider in metadata
              WarehouseDocument.joins(:storage_blob).find_each do |wd|
                # FRC (Feb 2026): Use actual configured provider, no hardcoded defaults
                provider = wd.meta("storage_provider") || WarehouseProvider.instance&.provider_type
                normalized = case provider
                             when "s3_compatible", "wasabi", "s3" then "s3_compatible"
                             when "sharepoint" then "sharepoint"
                             else "unknown"
                             end
                doc_by_provider[normalized] += 1
              end
              doc_by_provider
            else
              nil
            end

            # Enhance per_mailbox_stats with attachment and storage counts
            per_mailbox_stats = per_mailbox_base.map do |row|
              mailbox = row.mailbox_owner_email
              {
                mailbox: mailbox,
                email_count: row.email_count,
                last_sync: row.last_sync,
                last_email_received: row.last_email_received,
                attachment_count: per_mailbox_attachment_counts[mailbox] || 0,
                shared_attachments: shared_per_mailbox[mailbox] || 0,
                emails_wasabi: per_mailbox_wasabi_counts[mailbox] || 0,
                emails_sharepoint: per_mailbox_sharepoint_counts[mailbox] || 0,
                attachments_wasabi: per_mailbox_att_wasabi[mailbox] || 0,
                attachments_sharepoint: per_mailbox_att_sharepoint[mailbox] || 0
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
                emails: total_count,
                attachments: total_attachments,  # SSoT: total attachment count
                email_storage_bytes: total_size,
                linked_to_job: linked_to_job,
                size_by_job: size_by_job,
                junk_emails: spam_count,
                unprocessed: unclassified_count,
                last_email_received: emails.maximum(:received_at),
                last_sync: emails.maximum(:last_synced_at),
                per_mailbox: per_mailbox_stats,
                ai_classification: {
                  spam: spam_count,
                  marketing: marketing_count,
                  transactional: transactional_count,
                  business: business_count,
                  unclassified: unclassified_count,
                  classified_count: classified_count,
                  classification_rate: total_count > 0 ? ((classified_count.to_f / total_count) * 100).round(1) : 0
                },
                ssot_migration: {
                  with_direction: with_direction,
                  with_body_preview: with_body_preview,
                  direction_rate: total_count > 0 ? ((with_direction.to_f / total_count) * 100).round(1) : 0,
                  body_preview_rate: total_count > 0 ? ((with_body_preview.to_f / total_count) * 100).round(1) : 0
                },
                storage_location: {
                  emails: {
                    wasabi: { count: wasabi_emails, bytes: wasabi_email_bytes },
                    sharepoint: { count: sharepoint_emails, bytes: sharepoint_email_bytes }
                  },
                  attachments: {
                    wasabi: { count: wasabi_attachments },
                    sharepoint: { count: sharepoint_attachments },
                    dedup_savings_count: dedup_savings_count,
                    dedup_savings_bytes: dedup_savings_bytes
                  },
                  documents: document_storage
                }
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
                size_by_job: 0,
                junk_emails: 0,
                unprocessed: 0,
                last_email_received: nil,
                last_sync: nil,
                per_mailbox: [],
                ai_classification: {
                  spam: 0,
                  marketing: 0,
                  transactional: 0,
                  business: 0,
                  unclassified: 0,
                  classified_count: 0,
                  classification_rate: 0
                },
                ssot_migration: {
                  with_direction: 0,
                  with_body_preview: 0,
                  direction_rate: 0,
                  body_preview_rate: 0
                },
                storage_location: {
                  emails: {
                    wasabi: { count: 0, bytes: 0 },
                    sharepoint: { count: 0, bytes: 0 }
                  },
                  attachments: {
                    wasabi: { count: 0 },
                    sharepoint: { count: 0 },
                    dedup_savings_count: 0,
                    dedup_savings_bytes: 0
                  },
                  documents: nil
                }
              }
            }
          end
        end

        render json: {
          success: true,
          organizations: org_stats,
          total_connected: org_stats.count { |o| o[:connected] },
          total_emails: SyncedEmail.count,
          generated_at: Time.current
        }
      end

      # GET /api/v1/organization/document_provider
      # Returns the organization's current document storage provider configuration
      #
      # SSoT (Feb 2026): WarehouseProvider is THE ONE source for ALL storage config:
      # - provider_type: which provider (sharepoint, s3_compatible)
      # - credential_id: which credential to use (polymorphic)
      # - bucket: S3 bucket name
      # Organization.document_provider* columns are DEPRECATED and will be removed.
      def document_provider
        # SSoT: WarehouseProvider is THE ONE source for storage config
        warehouse_provider = WarehouseProvider.instance rescue nil
        # FRC (Feb 2026): Return actual configured provider, no hardcoded defaults
        current_provider = warehouse_provider&.provider_type
        current_bucket = warehouse_provider&.bucket
        # SSoT: credential_id from WarehouseProvider (polymorphic)
        current_credential_id = warehouse_provider&.credential_id

        # Get available S3 credentials for dropdown
        # FRC (Feb 2026): Must be tenant-scoped
        s3_credentials = S3CompatibleCredential.for_tenant(current_tenant).active.order(:name).map do |cred|
          {
            id: cred.id,
            name: cred.name,
            provider_type: cred.provider_type,
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

        # Get active credential status and last connected info
        credential_status = nil
        last_error = nil

        if current_provider == "s3_compatible" && current_credential_id
          # FRC (Feb 2026): Must be tenant-scoped
          active_credential = S3CompatibleCredential.for_tenant(current_tenant).find_by(id: current_credential_id)
          if active_credential
            credential_status = active_credential.status
            last_error = active_credential.metadata&.dig("last_error")
          end
        elsif current_provider == "sharepoint"
          sp_cred = MicrosoftCredential.sharepoint_credential rescue nil
          credential_status = sp_cred&.connected? ? "connected" : "disconnected"
        end

        render json: {
          success: true,
          data: {
            # SSoT: All values from WarehouseProvider
            document_provider: current_provider,
            document_provider_credential_id: current_credential_id,
            available_providers: Organization::DOCUMENT_PROVIDERS,
            s3_credentials: s3_credentials,
            sharepoint_configured: sharepoint_configured,
            can_switch: s3_credentials.any? { |c| c[:connected] } || sharepoint_configured,
            bucket: current_bucket,
            connection_status: credential_status,
            last_error: last_error,
            warehouse_provider_updated_at: warehouse_provider&.updated_at
          }
        }
      end

      # PUT /api/v1/organization/document_provider
      # Updates the organization's document storage provider
      #
      # SSoT (Feb 2026): WarehouseProvider is THE ONE source for ALL storage config.
      # Organization.document_provider* columns are DEPRECATED and will be removed.
      def update_document_provider
        provider = params[:document_provider]
        credential_id = params[:document_provider_credential_id]

        unless Organization::DOCUMENT_PROVIDERS.include?(provider)
          return render_error("Invalid provider. Must be one of: #{Organization::DOCUMENT_PROVIDERS.join(', ')}", status: :unprocessable_entity)
        end

        # Validate credential if switching to S3
        credential = nil
        if provider == "s3_compatible"
          if credential_id.blank?
            return render_error("Please select an S3 credential to use", status: :unprocessable_entity)
          end

          # FRC (Feb 2026): Must be tenant-scoped
          credential = S3CompatibleCredential.for_tenant(current_tenant).find_by(id: credential_id)
          unless credential&.status == "connected"
            return render_error("Selected S3 credential is not connected. Please test the connection first.", status: :unprocessable_entity)
          end
        end

        # SSoT: WarehouseProvider is THE ONE source - update it directly
        warehouse_provider = WarehouseProvider.instance
        unless warehouse_provider
          return render_error("Storage configuration not found", status: :not_found)
        end

        old_provider = warehouse_provider.provider_type
        update_attrs = {
          provider_type: provider,
          # SSoT: credential stored in WarehouseProvider (polymorphic)
          credential_type: provider == "s3_compatible" ? "S3CompatibleCredential" : nil,
          credential_id: provider == "s3_compatible" ? credential_id : nil
        }

        # Update bucket if provided
        if params[:bucket].present?
          connection_config = warehouse_provider.connection_config || {}
          connection_config["bucket"] = params[:bucket]
          update_attrs[:connection_config] = connection_config
        end

        if warehouse_provider.update(update_attrs)
          Rails.logger.info "[DocumentProvider] SSoT: WarehouseProvider updated provider_type=#{provider}, credential_id=#{credential_id}"

          render json: {
            success: true,
            message: "Document provider updated to #{provider}",
            data: {
              document_provider: warehouse_provider.provider_type,
              document_provider_credential_id: warehouse_provider.credential_id,
              bucket: warehouse_provider.bucket
            }
          }
        else
          render_validation_errors(warehouse_provider)
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
          return render_error("Both from_provider and to_provider are required", status: :unprocessable_entity)
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
          render_error(result[:error], status: :unprocessable_entity)
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
      # FRC (Feb 2026): Require from_provider param, no hardcoded defaults
      def estimate_migration
        from_provider = params[:from_provider]

        unless from_provider.present?
          return render_error("from_provider parameter required", status: :bad_request)
        end

        result = DocumentMigrationService.estimate_migration(from: from_provider)

        render json: {
          success: true,
          data: result
        }
      end

      # GET /api/v1/organization/data_stats
      # Returns organization-wide data warehouse statistics
      # Performance: Cached for 10 minutes (expensive synced_email queries)
      def data_stats
        # Skip cache only for admins (prevents DoS via forced cache refresh)
        skip_cache = params[:refresh] == "true" && current_user&.admin?
        cache_key = "organization:data_stats:tenant_#{current_tenant&.id || 'none'}"

        # Try to get from cache first (10 minute TTL - stats don't change often)
        unless skip_cache
          cached_result = Rails.cache.read(cache_key)
          if cached_result
            return render json: cached_result.merge(from_cache: true)
          end
        end

        # Get company settings for organization name
        company_setting = TenantSetting.instance

        # Document statistics - SSoT (Jan 2026): WarehouseDocument is THE ONE source
        warehouse_docs = WarehouseDocument.all
        warehouse_by_source = warehouse_docs.group(:source_type).count

        doc_stats = {
          total_documents: warehouse_docs.count,  # SSoT: Grand total in WarehouseDocument
          corporate_documents: warehouse_by_source["corporate"] || 0,
          job_documents_count: warehouse_by_source["job"] || 0,
          people_documents_count: warehouse_by_source["people"] || 0,
          email_documents_count: warehouse_by_source["email"] || 0,
          contact_documents_count: warehouse_by_source["contact"] || 0,
          total_records: warehouse_docs.count,
          by_source: warehouse_by_source,
          by_folder: warehouse_docs.group(:folder_path).count,
          total_file_size: warehouse_docs.joins(:storage_blob).sum("storage_blobs.file_size") || 0,
          latest_upload: warehouse_docs.maximum(:created_at),
          warehouse_total: warehouse_docs.count,
          warehouse_by_source: warehouse_by_source
        }

        # Document types breakdown - SSoT (Jan 2026): From WarehouseDocument metadata
        doc_type_stats = warehouse_docs
          .group("metadata->>'document_type'")
          .count
          .sort_by { |_k, v| -v }
          .first(15)
          .map { |type, count| { type: type || "Uncategorized", abbreviation: type&.slice(0, 3)&.upcase, count: count } }

        # Email statistics with detailed breakdown
        # Note: synced_email table only has job_id for linking (no contact_id, company_id, etc.)
        email_stats = if defined?(SyncedEmail)
          total_count = SyncedEmail.count
          total_size = SyncedEmail.sum("COALESCE(LENGTH(body_text), 0) + COALESCE(LENGTH(body_html), 0)") || 0
          linked_to_job = SyncedEmail.where.not(job_id: nil).count
          size_by_job = SyncedEmail.where.not(job_id: nil).sum("COALESCE(LENGTH(body_text), 0) + COALESCE(LENGTH(body_html), 0)") || 0

          # AI Classification breakdown - single GROUP BY query instead of 5 individual COUNTs
          classification_counts = SyncedEmail.group("email_classification->>'email_type'").count
          spam_count = classification_counts["spam"] || 0
          marketing_count = classification_counts["marketing"] || 0
          transactional_count = classification_counts["transactional"] || 0
          business_count = classification_counts["business"] || 0
          # nil key represents unclassified (NULL or empty classification)
          unclassified_count = classification_counts[nil] || 0
          classified_count = total_count - unclassified_count

          # SSoT migration progress
          with_direction = SyncedEmail.where.not(direction: nil).count
          with_body_preview = SyncedEmail.where("body_preview IS NOT NULL AND body_preview != ''").count

          # Email Storage Upload Progress (SSoT: storage_path is new, storage_email_path is legacy)
          with_storage = SyncedEmail.where("storage_path IS NOT NULL AND storage_path != ''").count
          uploadable = SyncedEmail.where.not(outlook_id: [nil, ""])
                                     .where.not(mailbox_owner_email: [nil, ""])
                                     .count
          remaining_to_upload = uploadable - with_storage

          # Email Attachments Storage Progress (SSoT Jan 2026: WarehouseDocument)
          attachment_count = WarehouseDocument.where(source_type: "email_attachment").count
          attachments_with_blob = WarehouseDocument.where(source_type: "email_attachment").where.not(storage_blob_id: nil).count
          attachments_legacy = 0  # Legacy EmailAttachment table dropped

          # StorageBlob Deduplication Stats (SSoT for file storage)
          unique_blobs = StorageBlob.count
          total_blob_bytes = StorageBlob.sum(:file_size) || 0
          # Deduplication ratio: if 1000 attachments → 500 unique blobs = 2x dedup
          dedup_ratio = unique_blobs > 0 ? (attachments_with_blob.to_f / unique_blobs).round(2) : 0
          files_saved = attachments_with_blob > unique_blobs ? attachments_with_blob - unique_blobs : 0

          # Pending emails by mailbox (for migration visibility)
          pending_by_mailbox = SyncedEmail.where(storage_path: nil)
            .group(:mailbox_owner_email)
            .count
            .sort_by { |_, v| -v }
            .map { |email, count| { mailbox: email || "(unknown)", pending: count } }

          {
            total_emails: total_count,
            total_size: total_size,
            linked_to_contact: 0,  # Not tracked in email_warehouse
            linked_to_job: linked_to_job,
            linked_to_company: 0,  # Not tracked in email_warehouse
            linked_to_company_group: 0,  # Not tracked in email_warehouse
            junk_emails: spam_count,
            unprocessed: unclassified_count,
            last_sync: SyncedEmail.maximum(:last_synced_at) || SyncedEmail.maximum(:created_at),
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
            },
            # Email Storage Upload Progress (NEW)
            storage_upload: {
              uploaded: with_storage,
              uploadable: uploadable,
              remaining: remaining_to_upload,
              upload_rate: uploadable > 0 ? ((with_storage.to_f / uploadable) * 100).round(1) : 0,
              attachments: {
                total: attachment_count,
                with_blob: attachments_with_blob,
                legacy_sharepoint: attachments_legacy,
                migration_rate: attachment_count > 0 ? ((attachments_with_blob.to_f / attachment_count) * 100).round(1) : 0,
                # StorageBlob deduplication stats
                unique_blobs: unique_blobs,
                total_storage_bytes: total_blob_bytes,
                dedup_ratio: dedup_ratio,
                files_saved_by_dedup: files_saved
              },
              pending_by_mailbox: pending_by_mailbox
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

        # Storage stats (provider-agnostic: SharePoint, S3, Wasabi, local)
        # SSoT: Auto-detect from active credentials, not just WarehouseProvider
        storage_config = WarehouseProvider.instance rescue nil

        # Auto-detect actual provider from credentials (SSoT: credentials are source of truth)
        # FRC (Feb 2026): Must be tenant-scoped
        s3_credential = S3CompatibleCredential.for_tenant(current_tenant).active.first rescue nil
        ms_credential = MicrosoftCredential.for_tenant(current_tenant).connected.first rescue nil

        # Determine actual provider based on what's connected (prioritize S3 if active)
        # FRC (Feb 2026): No hardcoded defaults - return actual configured provider or nil
        actual_provider_type = if s3_credential&.status == "connected"
          "s3_compatible"
        elsif ms_credential&.status == "connected"
          "sharepoint"
        else
          storage_config&.provider_type # May be nil if not configured
        end

        actual_connected = case actual_provider_type
        when "s3_compatible" then s3_credential&.status == "connected"
        when "sharepoint" then ms_credential&.status == "connected"
        else false
        end

        # Count synced files and last sync based on actual provider
        # SSoT (Jan 2026): All documents are now in WarehouseDocument (warehouse_docs defined above).
        # warehouse_documents has no storage_provider column - all docs are in the current provider.
        synced_files_count, last_sync_time = case actual_provider_type
        when "s3_compatible"
          [warehouse_docs.count, warehouse_docs.maximum(:updated_at) || s3_credential&.updated_at]
        when "sharepoint"
          [warehouse_docs.count, warehouse_docs.maximum(:updated_at) || ms_credential&.last_sync_at]
        else
          [0, nil]
        end

        # Use credential's display name for S3 sub-types (Wasabi, AWS S3, etc.)
        display_name = case actual_provider_type
        when "s3_compatible" then s3_credential&.provider_display_name || "Cloud Storage"
        when "sharepoint" then "SharePoint"
        else "Local Storage"
        end

        storage_stats = {
          provider_type: actual_provider_type,
          provider_name: display_name,
          connected: actual_connected,
          status: actual_connected ? "connected" : "disconnected",
          # Provider-agnostic connection info
          connection_info: storage_connection_info_for(actual_provider_type, s3_credential, ms_credential, storage_config),
          root_path: storage_config&.root_path || "/",
          total_synced: synced_files_count,
          last_sync: last_sync_time
        }

        # Xero stats - SSoT: Filter connections by XeroConnectionHealth
        all_xero_connections = CorporateXeroConnection.includes(:xero_credential).where.not(xero_credential_id: nil)
        connected_xero_connections = all_xero_connections.select(&:connected?)
        xero_stats = {
          connected: connected_xero_connections.any?,
          tenant_name: connected_xero_connections.first&.xero_tenant_name,
          companies_connected: connected_xero_connections.count,
          last_sync: all_xero_connections.maximum(:last_sync_at)
        }

        # Job documents (CAD/BIM files) stats - SSoT (Jan 2026): WarehouseDocument
        job_docs = WarehouseDocument.where(source_type: "job").joins(:storage_blob)
        job_doc_stats = {
          total_files: job_docs.count,
          revit_files: job_docs.where("storage_blobs.original_filename ILIKE ? OR storage_blobs.original_filename ILIKE ?", "%.rvt", "%.rfa").count,
          autocad_files: job_docs.where("storage_blobs.original_filename ILIKE ? OR storage_blobs.original_filename ILIKE ?", "%.dwg", "%.dxf").count,
          pdf_files: job_docs.where("storage_blobs.original_filename ILIKE ?", "%.pdf").count,
          image_files: job_docs.where("storage_blobs.original_filename ~* ?", "\\.(jpg|jpeg|png|gif|heic)$").count,
          total_size: job_docs.sum("storage_blobs.file_size") || 0
        }

        # Phase 3: Warehouse Document Breakdown (SSoT for all stored files)
        # DB-driven from WarehouseType — no hardcoded source_type mapping.
        # Email warehouse_type is split into email_body + email_attachment rows.
        # Xero gets special handling for per-tenant breakdown.
        warehouse_breakdown = if defined?(WarehouseDocument) && defined?(StorageBlob)
          results = []

          # Helper: count docs with verified file in StorageBlob
          count_with_file = ->(scope) {
            scope.joins(:storage_blob)
                 .where("storage_blobs.verified_at IS NOT NULL")
                 .count
          }

          # Helper: build a row hash with consistent columns
          build_row = ->(source_type, label, scope, expected: nil) {
            in_warehouse = scope.count
            w_blob = scope.where.not(storage_blob_id: nil).count
            w_file = count_with_file.call(scope)
            unique_blobs = scope.where.not(storage_blob_id: nil).distinct.count(:storage_blob_id)
            has_target = expected.present?
            total = expected || in_warehouse
            {
              source_type: source_type, label: label,
              has_target: has_target,
              total: total, in_warehouse: in_warehouse,
              with_blob: w_blob, with_file: w_file,
              unique_blobs: unique_blobs,
              duplicates: w_blob > unique_blobs ? w_blob - unique_blobs : 0,
              missing: has_target ? [total - w_file, 0].max : [in_warehouse - w_file, 0].max,
              file_rate: in_warehouse > 0 ? ((w_file.to_f / in_warehouse) * 100).round(1) : 0
            }
          }

          # Pre-compute all warehouse_type counts in 4 queries (not N+1)
          # Exclude source_type='xero' — Xero docs get their own row with Expected target,
          # but are stored with warehouse_type='contact'/'corporate'. Excluding prevents
          # double-counting and keeps Contact/Corporate showing only non-Xero docs.
          base_wt_scope = WarehouseDocument.where.not(warehouse_type: [nil, ""]).where.not(source_type: "xero")
          by_wt = base_wt_scope.group(:warehouse_type).count
          blob_by_wt = base_wt_scope.where.not(storage_blob_id: nil).group(:warehouse_type).count
          file_by_wt = base_wt_scope
            .joins(:storage_blob).where("storage_blobs.verified_at IS NOT NULL")
            .group(:warehouse_type).count
          unique_by_wt = base_wt_scope
            .where.not(storage_blob_id: nil)
            .group(:warehouse_type).distinct.count(:storage_blob_id)

          # Expected counts: ONLY for types with a meaningful 1:1 target
          # (e.g., every email should have an .eml, every invoice should have a PDF)
          # NOT for types like job/contact/user where 1 record can have 0 or many docs
          expected_counts = {}

          # ── Iterate all warehouse types from DB ────────────────────────────
          WarehouseType.enabled.ordered.each do |wt|
            # Email type: split into body + attachment rows
            if wt.code == "email"
              # Email Bodies
              email_body_total = SyncedEmail.count
              # SSoT: Two sources of "unfetchable" emails:
              # 1. Legacy: storage_path starts with "UNFETCHABLE" (old pattern)
              # 2. Current: content_unavailable=true (EmailStorageUploadService marks these)
              email_body_unfetchable_legacy = SyncedEmail.where("storage_path LIKE ?", "UNFETCHABLE%").count
              email_body_content_unavailable = SyncedEmail.where(content_unavailable: true).count
              email_body_unfetchable = email_body_unfetchable_legacy + email_body_content_unavailable
              # Also count emails missing outlook_id or mailbox (can never be fetched)
              email_body_no_outlook = SyncedEmail.where(outlook_id: [nil, ""]).or(SyncedEmail.where(mailbox_owner_email: [nil, ""])).count
              email_body_scope = WarehouseDocument.where(source_type: "email", documentable_type: "SyncedEmail")
              row = build_row.call("email_body", "Email Bodies", email_body_scope, expected: email_body_total)
              row[:unfetchable] = email_body_unfetchable
              row[:no_outlook_id] = email_body_no_outlook
              row[:missing] = [email_body_total - row[:with_file] - email_body_unfetchable - email_body_no_outlook, 0].max
              results << row if email_body_total > 0

              # Email Attachments
              email_attach_target = SyncedEmail.where(has_attachments: true).count
              email_attach_scope = WarehouseDocument.where(source_type: "email_attachment")
              results << build_row.call("email_attachment", "Email Attachments", email_attach_scope, expected: email_attach_target) if email_attach_target > 0 || email_attach_scope.exists?
              next
            end

            # Xero (corporate type, source_type=xero): separate row with tenant breakdown
            if wt.code == "corporate" && defined?(ExternalInvoice)
              xero_total = ExternalInvoice.where.not(status: "draft").where.not(contact_id: nil).count
              xero_scope = WarehouseDocument.where(source_type: "xero")
              if xero_total > 0
                row = build_row.call("xero", "Xero Invoices", xero_scope, expected: xero_total)

                # Per-tenant breakdown
                tenant_breakdown = []
                if defined?(XeroCredential)
                  xero_cred_scope = if current_tenant&.master_tenant?
                                      XeroCredential.where.not(tenant_id: nil)
                                    else
                                      XeroCredential.for_teeem_tenant(current_tenant).where.not(tenant_id: nil)
                                    end
                  xero_cred_scope.find_each do |cred|
                    t_total = ExternalInvoice.where(tenant_id: cred.tenant_id).where.not(status: "draft").where.not(contact_id: nil).count
                    next if t_total == 0
                    t_ids = ExternalInvoice.where(tenant_id: cred.tenant_id).pluck(:id)
                    t_scope = WarehouseDocument.where(source_type: "xero", documentable_type: "ExternalInvoice", documentable_id: t_ids)
                    t_row = build_row.call("xero", cred.tenant_name || "Unknown", t_scope, expected: t_total)
                    tenant_breakdown << t_row.merge(tenant_id: cred.tenant_id, tenant_name: cred.tenant_name || "Unknown")
                  end
                end

                row[:tenant_breakdown] = tenant_breakdown.sort_by { |t| -t[:total] }
                results << row
              end
            end

            # Standard row for this warehouse type
            in_warehouse = by_wt[wt.code] || 0
            expected = expected_counts[wt.code]
            has_target = expected.present?
            total = expected || in_warehouse
            next if in_warehouse == 0 && (expected.nil? || expected == 0)

            w_blob = blob_by_wt[wt.code] || 0
            w_file = file_by_wt[wt.code] || 0
            w_unique = unique_by_wt[wt.code] || 0
            results << {
              source_type: wt.code, label: wt.display_name,
              icon: wt.icon_name,
              has_target: has_target,
              total: total, in_warehouse: in_warehouse,
              with_blob: w_blob, with_file: w_file,
              unique_blobs: w_unique,
              duplicates: w_blob > w_unique ? w_blob - w_unique : 0,
              missing: has_target ? [total - w_file, 0].max : [in_warehouse - w_file, 0].max,
              file_rate: in_warehouse > 0 ? ((w_file.to_f / in_warehouse) * 100).round(1) : 0
            }
          end

          results
        else
          []
        end

        # StorageBlob totals (deduplicated file storage)
        blob_stats = if defined?(StorageBlob)
          total_blobs = StorageBlob.count
          verified_blobs = StorageBlob.where.not(verified_at: nil).count
          unverified_blobs = total_blobs - verified_blobs
          orphan_blobs = StorageBlob.left_joins(:warehouse_documents).where(warehouse_documents: { id: nil }).count
          # How many WH docs have a verified file (across ALL docs, not just breakdown rows)
          docs_with_file = WarehouseDocument.joins(:storage_blob).where("storage_blobs.verified_at IS NOT NULL").count
          # Unclassified: docs NOT covered by any breakdown row
          # Breakdown rows use mixed scoping (source_type for email/xero, warehouse_type for others),
          # so we compute unclassified as total minus sum of breakdown rows' in_warehouse
          breakdown_in_warehouse = warehouse_breakdown.sum { |r| r[:in_warehouse] || 0 }
          breakdown_with_file = warehouse_breakdown.sum { |r| r[:with_file] || 0 }
          total_wh_docs = WarehouseDocument.count
          unclassified_total = [total_wh_docs - breakdown_in_warehouse, 0].max
          # Cap with_file at total — can't have more files than documents
          unclassified_with_file = [[docs_with_file - breakdown_with_file, 0].max, unclassified_total].min
          total_bytes = StorageBlob.sum(:file_size) || 0
          blobs_path = StorageBlob.where("storage_path LIKE 'Blobs/%'").count
          emails_path = StorageBlob.where("storage_path LIKE 'Emails/%'").count

          # Deduplication stats (attachments save most storage)
          total_refs = StorageBlob.sum(:reference_count)
          dupes_avoided = total_refs - total_blobs
          # Estimate bytes saved: avg file size * dupes avoided
          avg_size = total_blobs > 0 ? (total_bytes.to_f / total_blobs) : 0
          bytes_saved = (avg_size * dupes_avoided).to_i

          {
            total_blobs: total_blobs,
            verified_blobs: verified_blobs,
            unverified_blobs: unverified_blobs,
            orphan_blobs: orphan_blobs,
            docs_with_file: docs_with_file,
            unclassified_total: unclassified_total,
            unclassified_with_file: unclassified_with_file,
            total_bytes: total_bytes,
            blobs_format: blobs_path,
            legacy_format: emails_path,
            migration_rate: total_blobs > 0 ? ((blobs_path.to_f / total_blobs) * 100).round(1) : 0,
            # Deduplication
            total_references: total_refs,
            duplicates_avoided: dupes_avoided,
            bytes_saved: bytes_saved
          }
        else
          { total_blobs: 0, total_bytes: 0, blobs_format: 0, legacy_format: 0, migration_rate: 0 }
        end

        # Corporate (Companies) stats
        active_companies = Corporate.where(active: [ true, nil ])
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
              total_companies: Corporate.count,
              total_jobs: Job.count
            },
            documents: doc_stats,
            document_types: doc_type_stats,
            emails: email_stats,
            corporate: corporate_stats,
            storage: storage_stats,
            xero: xero_stats,
            job_documents: job_doc_stats,
            warehouse_breakdown: warehouse_breakdown,
            blob_stats: blob_stats,
            last_updated: Time.current
          }
        }

        # Cache for 10 minutes
        Rails.cache.write(cache_key, result, expires_in: CACHE_TTL_LONG)

        render json: result.merge(from_cache: false)
      end

      private

      # Auto-create Organization for current tenant if it doesn't exist
      # SSoT (Jan 2026): Organization is needed for document_provider settings
      # Default: Wasabi (s3_compatible) with shared bucket credential
      def create_organization_for_tenant
        return nil unless current_tenant

        # Find the active Wasabi/S3 credential to use as default
        # FRC (Feb 2026): Must be tenant-scoped
        default_credential = S3CompatibleCredential.for_tenant(current_tenant).active.where(status: "connected").first

        Organization.create!(
          tenant: current_tenant,
          name: current_tenant.name || "Organization",
          document_provider: "s3_compatible",
          document_provider_credential_id: default_credential&.id
        )
      rescue ActiveRecord::RecordInvalid => e
        Rails.logger.error "[OrganizationController] Failed to create Organization for tenant: #{e.message}"
        nil
      end

      # SSoT: Connection info - bucket from WarehouseProvider (Jan 2026)
      def storage_connection_info_for(provider_type, s3_credential, ms_credential, storage_config)
        case provider_type
        when "s3_compatible"
          return {} unless s3_credential
          {
            endpoint: s3_credential.endpoint,
            bucket: storage_config&.bucket,
            region: s3_credential.region
          }
        when "sharepoint"
          return {} unless ms_credential
          {
            site_url: "https://#{ms_credential.azure_tenant_id}.sharepoint.com",
            site_id: storage_config&.site_id,
            drive_id: storage_config&.drive_id,
            # SSoT: drive_name comes from WarehouseProvider - no hardcoded fallback
            drive_name: storage_config&.drive_name
          }
        when "local"
          { path: storage_config&.root_path }
        else
          {}
        end
      end
    end
  end
end
