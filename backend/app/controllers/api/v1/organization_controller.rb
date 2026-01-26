module Api
  module V1
    class OrganizationController < ApplicationController
      # Note: authorize_request is already called by ApplicationController
      # Security: Stats endpoints expose org-wide data, require admin
      before_action :require_admin, only: %i[microsoft_org_stats data_stats]

      # GET /api/v1/organization_settings
      # SSoT: Returns folder templates from StorageConfiguration
      def settings
        config = StorageConfiguration.instance

        render json: {
          success: true,
          # SSoT: Use StorageConfiguration.template_for for folder templates
          job_folder_template: config&.template_for(:job) || "{{JobCode}}/{{TabName}}",
          contact_folder_template: config&.template_for(:contact) || "{{ContactId}} - {{ContactName}}"
        }
      end

      # PATCH /api/v1/organization_settings
      # SSoT: Updates folder templates in StorageConfiguration
      def update_settings
        config = StorageConfiguration.instance
        templates = config.templates || {}

        templates["job"] = params[:job_folder_template] if params[:job_folder_template].present?
        templates["contact"] = params[:contact_folder_template] if params[:contact_folder_template].present?

        if config.update(templates: templates)
          render json: { success: true, message: "Settings updated successfully" }
        else
          render json: { success: false, errors: config.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/organization/microsoft_org_stats
      # Returns statistics for each connected Microsoft 365 organization
      def microsoft_org_stats
        # SSoT: Use MicrosoftCredential
        all_credentials = MicrosoftCredential.app_credentials.order(:name)

        # SSoT: Get org names dynamically from database (Jan 2026)
        all_org_names = MicrosoftCredential.known_org_names

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

            # Attachment storage breakdown - SSoT: EmailAttachment linked to SyncedEmail
            email_ids = emails.pluck(:id)
            attachments = EmailAttachment.where(email_warehouse_id: email_ids)
            total_attachments = attachments.count  # SSoT: total attachment count
            wasabi_attachments = attachments.where.not(storage_blob_id: nil).count
            sharepoint_attachments = attachments.where(storage_blob_id: nil)
                                                .where("storage_path IS NOT NULL AND storage_path != ''")
                                                .count

            # Deduplication stats (how many unique blobs vs total references)
            blob_ids_with_count = attachments.where.not(storage_blob_id: nil).pluck(:storage_blob_id)
            unique_blob_count = blob_ids_with_count.uniq.count
            dedup_savings_count = blob_ids_with_count.count - unique_blob_count
            # Calculate bytes saved by deduplication
            dedup_savings_bytes = if unique_blob_count > 0 && defined?(StorageBlob)
              # Get average blob size from the blobs used by these attachments
              avg_blob_size = StorageBlob.where(id: blob_ids_with_count.uniq).average(:file_size)&.to_i || 0
              dedup_savings_count * avg_blob_size
            else
              0
            end

            # Per-mailbox attachment counts - include ALL mailboxes
            per_mailbox_attachment_counts = attachments
              .joins("INNER JOIN synced_emails ON synced_emails.id = email_attachments.email_warehouse_id")
              .group("COALESCE(NULLIF(synced_emails.mailbox_owner_email, ''), 'Unknown')")
              .count

            # Shared attachments per mailbox - include ALL mailboxes
            shared_per_mailbox = if defined?(StorageBlob)
              attachments
                .joins("INNER JOIN synced_emails ON synced_emails.id = email_attachments.email_warehouse_id")
                .joins("INNER JOIN storage_blobs ON storage_blobs.id = email_attachments.storage_blob_id")
                .where("storage_blobs.reference_count > 1")
                .group("COALESCE(NULLIF(synced_emails.mailbox_owner_email, ''), 'Unknown')")
                .count
            else
              {}
            end

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

            # Per-mailbox attachment storage counts - include ALL mailboxes
            per_mailbox_att_wasabi = attachments
              .joins("INNER JOIN synced_emails ON synced_emails.id = email_attachments.email_warehouse_id")
              .where.not(storage_blob_id: nil)
              .group("COALESCE(NULLIF(synced_emails.mailbox_owner_email, ''), 'Unknown')")
              .count

            per_mailbox_att_sharepoint = attachments
              .joins("INNER JOIN synced_emails ON synced_emails.id = email_attachments.email_warehouse_id")
              .where(storage_blob_id: nil)
              .where("email_attachments.storage_path IS NOT NULL AND email_attachments.storage_path != ''")
              .group("COALESCE(NULLIF(synced_emails.mailbox_owner_email, ''), 'Unknown')")
              .count

            # Document storage breakdown (Tekna tenant only - org-wide)
            # SSoT: Orphaned documents (sync_status: 'missing') are deleted, not tracked
            document_storage = if org_name == "Tekna"
              doc_by_provider = { "s3_compatible" => 0, "sharepoint" => 0 }
              [JobDocument, CorporateCompanyDocument, PeopleDocument].each do |klass|
                next unless defined?(klass)
                klass.group(:storage_provider).count.each do |provider, count|
                  normalized = case provider
                               when "s3_compatible", "wasabi", "s3" then "s3_compatible"
                               when "sharepoint", nil then "sharepoint"
                               else "s3_compatible"
                               end
                  doc_by_provider[normalized] += count
                end
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
      def document_provider
        # SSoT (Jan 2026): Derive from tenant, not Organization.first
        organization = current_organization

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
            can_switch: s3_credentials.any? { |c| c[:connected] } || sharepoint_configured
          }
        }
      end

      # PUT /api/v1/organization/document_provider
      # Updates the organization's document storage provider
      def update_document_provider
        # SSoT (Jan 2026): Derive from tenant, not Organization.first
        organization = current_organization

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
      # Performance: Cached for 10 minutes (expensive synced_email queries)
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
        company_setting = CorporateCompanySetting.instance

        # Document statistics (all company_documents)
        # SSoT: Count documents WITH files (matches Documents page definition)
        documents = CorporateCompanyDocument.all
        documents_with_files = documents.where.not(file_name: [nil, ""])

        # SSoT: Total documents across ALL tables (matches Documents page)
        job_doc_count = defined?(JobDocument) ? JobDocument.where.not(file_name: [nil, ""]).count : 0
        people_doc_count = defined?(PeopleDocument) ? PeopleDocument.where.not(title: [nil, ""]).count : 0
        all_docs_total = documents_with_files.count + job_doc_count + people_doc_count

        doc_stats = {
          total_documents: all_docs_total,  # SSoT: Grand total across all document tables
          corporate_documents: documents_with_files.count,  # CorporateCompanyDocument only
          job_documents_count: job_doc_count,  # JobDocument only
          people_documents_count: people_doc_count,  # PeopleDocument only
          total_records: documents.count,  # Full CorporateCompanyDocument count (admin)
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

          # Email Attachments Storage Progress
          attachment_count = defined?(EmailAttachment) ? EmailAttachment.count : 0
          attachments_with_blob = defined?(EmailAttachment) ? EmailAttachment.where.not(storage_blob_id: nil).count : 0
          attachments_legacy = defined?(EmailAttachment) ? EmailAttachment.where(storage_blob_id: nil).where("storage_path IS NOT NULL AND storage_path != ''").count : 0

          # StorageBlob Deduplication Stats (SSoT for file storage)
          unique_blobs = defined?(StorageBlob) ? StorageBlob.count : 0
          total_blob_bytes = defined?(StorageBlob) ? (StorageBlob.sum(:file_size) || 0) : 0
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
        # SSoT: Auto-detect from active credentials, not just StorageConfiguration
        storage_config = StorageConfiguration.instance rescue nil

        # Auto-detect actual provider from credentials (SSoT: credentials are source of truth)
        s3_credential = S3CompatibleCredential.active.first rescue nil
        ms_credential = MicrosoftCredential.connected.first rescue nil

        # Determine actual provider based on what's connected (prioritize S3 if active)
        actual_provider_type = if s3_credential&.status == "connected"
          "s3_compatible"
        elsif ms_credential&.status == "connected"
          "sharepoint"
        else
          storage_config&.provider_type || "s3_compatible"
        end

        actual_connected = case actual_provider_type
        when "s3_compatible" then s3_credential&.status == "connected"
        when "sharepoint" then ms_credential&.status == "connected"
        else false
        end

        # Count synced files and last sync based on actual provider
        synced_files_count, last_sync_time = case actual_provider_type
        when "s3_compatible"
          s3_docs = documents.where(storage_provider: %w[s3 wasabi s3_compatible])
          [s3_docs.count, s3_docs.maximum(:last_modified_at) || s3_credential&.updated_at]
        when "sharepoint"
          sp_docs = documents.where(storage_provider: "sharepoint")
          [sp_docs.count, sp_docs.maximum(:last_modified_at) || ms_credential&.last_sync_at]
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

        # Phase 3: Warehouse Document Breakdown (SSoT for all stored files)
        # Shows documents by source_type with storage status
        # Special handling: Split "email" into email_body vs email_attachment
        warehouse_breakdown = if defined?(WarehouseDocument) && defined?(StorageBlob)
          results = []

          # Helper to count docs with verified file in StorageBlob (Jan 2026)
          # Uses verified_at timestamp - set when file confirmed to exist in storage
          count_with_file = ->(scope) {
            scope.joins(:storage_blob)
                 .where("storage_blobs.verified_at IS NOT NULL")
                 .count
          }

          # Email bodies (SyncedEmail)
          email_body_scope = WarehouseDocument.where(source_type: "email", documentable_type: "SyncedEmail")
          email_body_total = email_body_scope.count
          email_body_with_blob = email_body_scope.where.not(storage_blob_id: nil).count
          email_body_with_file = count_with_file.call(email_body_scope)
          if email_body_total > 0
            results << {
              source_type: "email_body",
              label: "Email Bodies",
              total: email_body_total,
              with_blob: email_body_with_blob,
              with_file: email_body_with_file,
              without_blob: email_body_total - email_body_with_blob,
              storage_rate: ((email_body_with_blob.to_f / email_body_total) * 100).round(1),
              file_rate: ((email_body_with_file.to_f / email_body_total) * 100).round(1)
            }
          end

          # Email attachments
          email_attach_scope = WarehouseDocument.where(source_type: "email", documentable_type: "EmailAttachment")
          email_attach_total = email_attach_scope.count
          email_attach_with_blob = email_attach_scope.where.not(storage_blob_id: nil).count
          email_attach_with_file = count_with_file.call(email_attach_scope)
          if email_attach_total > 0
            results << {
              source_type: "email_attachment",
              label: "Email Attachments",
              total: email_attach_total,
              with_blob: email_attach_with_blob,
              with_file: email_attach_with_file,
              without_blob: email_attach_total - email_attach_with_blob,
              storage_rate: ((email_attach_with_blob.to_f / email_attach_total) * 100).round(1),
              file_rate: ((email_attach_with_file.to_f / email_attach_total) * 100).round(1)
            }
          end

          # Other source types (exclude "email" and "xero" since we handle them specially)
          by_source = WarehouseDocument.where.not(source_type: %w[email xero]).group(:source_type).count
          with_blob = WarehouseDocument.where.not(source_type: %w[email xero]).where.not(storage_blob_id: nil).group(:source_type).count
          # Count with verified file per source type (Jan 2026 - uses verified_at)
          with_file_by_source = WarehouseDocument.where.not(source_type: %w[email xero])
            .joins(:storage_blob)
            .where("storage_blobs.verified_at IS NOT NULL")
            .group(:source_type)
            .count

          by_source.each do |source_type, total|
            next if source_type.blank? || total == 0
            with_storage = with_blob[source_type] || 0
            with_file_count = with_file_by_source[source_type] || 0
            results << {
              source_type: source_type,
              label: source_type.titleize,
              total: total,
              with_blob: with_storage,
              with_file: with_file_count,
              without_blob: total - with_storage,
              storage_rate: total > 0 ? ((with_storage.to_f / total) * 100).round(1) : 0,
              file_rate: total > 0 ? ((with_file_count.to_f / total) * 100).round(1) : 0
            }
          end

          # SSoT: Xero - Total from external_invoices table, synced from WarehouseDocument
          # This shows the TRUE count of invoices/bills that should have PDFs
          if defined?(ExternalInvoice)
            # Total invoices/bills that can have PDFs (exclude drafts - Xero doesn't generate PDFs for drafts)
            xero_total = ExternalInvoice.where.not(status: "draft").count
            # How many have PDFs synced (WarehouseDocument with storage_blob)
            xero_with_blob = WarehouseDocument.where(source_type: "xero").where.not(storage_blob_id: nil).count
            xero_with_file = WarehouseDocument.where(source_type: "xero")
              .joins(:storage_blob)
              .where("storage_blobs.verified_at IS NOT NULL")
              .count
            xero_linked = WarehouseDocument.where(source_type: "xero").count

            # Per-tenant breakdown
            tenant_breakdown = []
            if defined?(XeroCredential)
              XeroCredential.where.not(xero_tenant_id: nil).find_each do |cred|
                tenant_id = cred.xero_tenant_id
                tenant_name = cred.xero_tenant_name || "Unknown"

                # Count from external_invoices (SSoT)
                tenant_total = ExternalInvoice.where(tenant_id: tenant_id).where.not(status: "draft").count
                next if tenant_total == 0

                # Count PDFs synced for this tenant
                # WarehouseDocument links to ExternalInvoice via documentable
                tenant_invoice_ids = ExternalInvoice.where(tenant_id: tenant_id).pluck(:id)
                tenant_warehouse_scope = WarehouseDocument.where(source_type: "xero", documentable_type: "ExternalInvoice", documentable_id: tenant_invoice_ids)
                tenant_with_blob = tenant_warehouse_scope.where.not(storage_blob_id: nil).count
                tenant_with_file = tenant_warehouse_scope.joins(:storage_blob).where("storage_blobs.verified_at IS NOT NULL").count
                tenant_linked = tenant_warehouse_scope.count

                tenant_breakdown << {
                  tenant_id: tenant_id,
                  tenant_name: tenant_name,
                  total: tenant_total,
                  with_blob: tenant_with_blob,
                  with_file: tenant_with_file,
                  linked: tenant_linked,
                  missing: tenant_total - tenant_with_file,
                  file_rate: tenant_total > 0 ? ((tenant_with_file.to_f / tenant_total) * 100).round(1) : 0
                }
              end
            end

            if xero_total > 0
              results << {
                source_type: "xero",
                label: "Xero",
                total: xero_total,  # SSoT: From external_invoices table
                with_blob: xero_with_blob,
                with_file: xero_with_file,
                linked: xero_linked,  # WarehouseDocument records created
                without_blob: xero_total - xero_with_blob,
                missing: xero_total - xero_with_file,  # Missing PDFs
                storage_rate: ((xero_with_blob.to_f / xero_total) * 100).round(1),
                file_rate: ((xero_with_file.to_f / xero_total) * 100).round(1),
                tenant_breakdown: tenant_breakdown.sort_by { |t| -t[:total] }  # Sort by total descending
              }
            end
          end

          results.sort_by { |r| -r[:total] }  # Sort by total descending
        else
          []
        end

        # StorageBlob totals (deduplicated file storage)
        blob_stats = if defined?(StorageBlob)
          total_blobs = StorageBlob.count
          total_bytes = StorageBlob.sum(:file_size) || 0
          blobs_path = StorageBlob.where("storage_path LIKE 'Blobs/%'").count
          emails_path = StorageBlob.where("storage_path LIKE 'Emails/%'").count
          {
            total_blobs: total_blobs,
            total_bytes: total_bytes,
            blobs_format: blobs_path,
            legacy_format: emails_path,
            migration_rate: total_blobs > 0 ? ((blobs_path.to_f / total_blobs) * 100).round(1) : 0
          }
        else
          { total_blobs: 0, total_bytes: 0, blobs_format: 0, legacy_format: 0, migration_rate: 0 }
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
            storage: storage_stats,
            xero: xero_stats,
            job_documents: job_doc_stats,
            warehouse_breakdown: warehouse_breakdown,
            blob_stats: blob_stats,
            last_updated: Time.current
          }
        }

        # Cache for 10 minutes
        Rails.cache.write(cache_key, result, expires_in: 10.minutes)

        render json: result.merge(from_cache: false)
      end

      private

      # SSoT: Connection info - bucket from StorageConfiguration (Jan 2026)
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
            site_url: ms_credential.site_url || "https://#{ms_credential.tenant_id}.sharepoint.com",
            site_id: storage_config&.site_id,
            drive_id: storage_config&.drive_id,
            # SSoT: drive_name comes from StorageConfiguration - no hardcoded fallback
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
