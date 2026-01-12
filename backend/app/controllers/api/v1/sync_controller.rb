# frozen_string_literal: true

module Api
  module V1
    # SyncController - API endpoints for TEEEM Sync desktop client
    #
    # Handles:
    # - Device code authentication flow
    # - Folder listing and subscriptions
    # - File exclusion rules
    # - Delta sync for changes
    # - File upload/download URLs
    #
    class SyncController < ApplicationController
      # Skip auth for device code endpoints (client not yet authenticated)
      skip_before_action :authorize_request, only: [:initiate_device_auth, :poll_device_auth]
      before_action :authenticate_desktop_client!, except: [:initiate_device_auth, :poll_device_auth, :verify_device_code]

      # ==========================================
      # DEVICE CODE AUTHENTICATION
      # ==========================================

      # POST /api/v1/sync/auth/device_code
      # Start device code authentication flow
      # Called by desktop client to get a code to display
      def initiate_device_auth
        device_name = params[:device_name] || "Unknown Device"
        platform = params[:platform]  # 'macos' or 'windows'

        # Generate a pending device code (not yet linked to a user)
        device_code = DesktopClient.generate_device_code
        device_id = SecureRandom.uuid

        # Store pending auth in cache (expires in 15 minutes)
        Rails.cache.write(
          "device_auth:#{device_code}",
          {
            device_id: device_id,
            device_name: device_name,
            platform: platform,
            created_at: Time.current
          },
          expires_in: 15.minutes
        )

        render json: {
          success: true,
          data: {
            device_code: device_code,
            device_id: device_id,
            expires_in: 900,  # 15 minutes
            interval: 5,      # Poll every 5 seconds
            verification_url: "#{frontend_url}/device"
          }
        }
      end

      # POST /api/v1/sync/auth/verify
      # Called by web app when user enters device code
      # Requires authenticated user session
      def verify_device_code
        device_code = params[:device_code]&.upcase&.strip

        unless device_code.present?
          return render json: { success: false, error: "Device code required" }, status: :bad_request
        end

        # Find pending auth in cache
        pending = Rails.cache.read("device_auth:#{device_code}")
        unless pending
          return render json: { success: false, error: "Invalid or expired device code" }, status: :not_found
        end

        # Create the desktop client linked to current user
        client = DesktopClient.create!(
          user: current_user,
          organization: current_user.organization,
          device_id: pending[:device_id],
          device_name: pending[:device_name],
          platform: pending[:platform],
          is_active: true,
          last_seen_at: Time.current
        )

        # Generate tokens
        tokens = client.activate_with_token!

        # Store tokens in cache for polling endpoint
        Rails.cache.write(
          "device_auth:#{device_code}:tokens",
          tokens,
          expires_in: 5.minutes
        )

        # Delete pending auth
        Rails.cache.delete("device_auth:#{device_code}")

        render json: {
          success: true,
          data: {
            message: "Device authorized successfully",
            device_name: client.device_name
          }
        }
      end

      # GET /api/v1/sync/auth/poll
      # Called by desktop client to check if code has been verified
      def poll_device_auth
        device_code = params[:device_code]&.upcase&.strip

        unless device_code.present?
          return render json: { success: false, error: "Device code required" }, status: :bad_request
        end

        # Check if tokens are ready
        tokens = Rails.cache.read("device_auth:#{device_code}:tokens")
        if tokens
          # Clean up
          Rails.cache.delete("device_auth:#{device_code}:tokens")

          return render json: {
            success: true,
            data: tokens
          }
        end

        # Check if still pending
        pending = Rails.cache.read("device_auth:#{device_code}")
        if pending
          return render json: {
            success: false,
            error: "authorization_pending",
            message: "Waiting for user to enter code"
          }, status: :accepted
        end

        # Code expired or invalid
        render json: {
          success: false,
          error: "expired_token",
          message: "Device code expired"
        }, status: :gone
      end

      # POST /api/v1/sync/auth/refresh
      # Refresh access token using refresh token
      def refresh_token
        refresh_token = params[:refresh_token]

        unless refresh_token.present?
          return render json: { success: false, error: "Refresh token required" }, status: :bad_request
        end

        tokens = @desktop_client.refresh_access_token!(refresh_token)
        unless tokens
          return render json: { success: false, error: "Invalid refresh token" }, status: :unauthorized
        end

        render json: { success: true, data: tokens }
      end

      # DELETE /api/v1/sync/auth/logout
      # Deactivate desktop client
      def logout
        @desktop_client.deactivate!
        render json: { success: true, message: "Logged out successfully" }
      end

      # ==========================================
      # FOLDER LISTING & SUBSCRIPTIONS
      # ==========================================

      # GET /api/v1/sync/folders
      # List available folders user can sync
      def folders
        jobs = current_user.organization.jobs
          .where(status: %w[active on_hold])
          .order(created_at: :desc)
          .limit(100)

        companies = current_user.organization.corporate_companies
          .order(:name)
          .limit(100)

        contacts = current_user.organization.contacts
          .where.not(first_name: nil)
          .order(:last_name, :first_name)
          .limit(100)

        render json: {
          success: true,
          data: {
            jobs: jobs.map { |j| folder_json(j, "Job") },
            companies: companies.map { |c| folder_json(c, "CorporateCompany") },
            contacts: contacts.map { |c| folder_json(c, "Contact") }
          }
        }
      end

      # GET /api/v1/sync/subscriptions
      # List current subscriptions for this device
      def subscriptions
        subs = @desktop_client.sync_subscriptions.includes(:syncable)

        render json: {
          success: true,
          data: subs.map(&:as_json)
        }
      end

      # POST /api/v1/sync/subscriptions
      # Subscribe to folders
      def create_subscription
        syncable_type = params[:syncable_type]
        syncable_id = params[:syncable_id]
        include_subfolders = params[:include_subfolders] != false

        unless %w[Job CorporateCompany Contact].include?(syncable_type)
          return render json: { success: false, error: "Invalid syncable_type" }, status: :bad_request
        end

        syncable = syncable_type.constantize.find_by(id: syncable_id)
        unless syncable
          return render json: { success: false, error: "#{syncable_type} not found" }, status: :not_found
        end

        sub = @desktop_client.sync_subscriptions.find_or_create_by!(
          syncable_type: syncable_type,
          syncable_id: syncable_id
        ) do |s|
          s.include_subfolders = include_subfolders
        end

        render json: { success: true, data: sub.as_json }
      end

      # DELETE /api/v1/sync/subscriptions/:id
      # Unsubscribe from a folder
      def destroy_subscription
        sub = @desktop_client.sync_subscriptions.find_by(id: params[:id])
        unless sub
          return render json: { success: false, error: "Subscription not found" }, status: :not_found
        end

        sub.destroy!
        render json: { success: true, message: "Unsubscribed successfully" }
      end

      # ==========================================
      # FILE EXCLUSION RULES
      # ==========================================

      # GET /api/v1/sync/exclusions
      # Get effective exclusion rules for current user
      def exclusions
        rules = SyncExclusionRule.effective_rules_for(
          organization: current_user.organization,
          user: current_user
        )

        render json: {
          success: true,
          data: {
            rules: rules.map(&:as_json),
            defaults: SyncExclusionRule::DEFAULT_RULES
          }
        }
      end

      # PUT /api/v1/sync/exclusions
      # Update user's exclusion rules
      def update_exclusions
        rules = params[:rules] || []

        # Delete existing user rules
        SyncExclusionRule.for_user(current_user).destroy_all

        # Create new rules
        rules.each do |rule_params|
          SyncExclusionRule.create!(
            user: current_user,
            organization: current_user.organization,
            rule_type: rule_params[:rule_type],
            value: rule_params[:value],
            action: rule_params[:action] || "skip",
            description: rule_params[:description],
            priority: rule_params[:priority] || 50
          )
        end

        # Return updated effective rules
        exclusions
      end

      # ==========================================
      # DELTA SYNC
      # ==========================================

      # GET /api/v1/sync/delta
      # Get changes since last sync for subscribed folders
      def delta
        changes = []

        @desktop_client.sync_subscriptions.enabled.each do |sub|
          folder_changes = fetch_folder_changes(sub)
          changes.concat(folder_changes)
        end

        render json: {
          success: true,
          data: {
            changes: changes,
            sync_timestamp: Time.current.iso8601
          }
        }
      end

      # POST /api/v1/sync/download_url
      # Get presigned download URL for a file
      def download_url
        file_state = @desktop_client.sync_file_states.find_by(id: params[:file_state_id])
        unless file_state
          return render json: { success: false, error: "File not found" }, status: :not_found
        end

        url = file_state.download_url
        unless url
          return render json: { success: false, error: "Could not generate download URL" }, status: :internal_server_error
        end

        # Mark as downloading
        file_state.update!(is_placeholder: false) if file_state.is_placeholder?

        render json: {
          success: true,
          data: {
            url: url,
            expires_in: 3600,
            file_name: file_state.file_name,
            file_size: file_state.file_size,
            content_hash: file_state.remote_content_hash
          }
        }
      end

      # POST /api/v1/sync/upload
      # Get presigned upload URL for a file
      def upload_url
        sub = @desktop_client.sync_subscriptions.find_by(id: params[:subscription_id])
        unless sub
          return render json: { success: false, error: "Subscription not found" }, status: :not_found
        end

        file_name = params[:file_name]
        file_path = params[:file_path]
        content_hash = params[:content_hash]
        file_size = params[:file_size]

        # Check exclusion rules
        unless sub.should_sync_file?(file_name, file_size)
          return render json: {
            success: false,
            error: "File type excluded from sync",
            excluded: true
          }, status: :unprocessable_entity
        end

        # Check for conflicts
        existing = @desktop_client.sync_file_states.find_by(remote_path: file_path)
        if existing && existing.has_conflict?
          return render json: {
            success: false,
            error: "conflict",
            conflict: {
              local_hash: existing.local_content_hash,
              remote_hash: existing.remote_content_hash,
              remote_modified_at: existing.remote_modified_at
            }
          }, status: :conflict
        end

        # Generate upload URL based on storage provider
        provider = current_user.organization.document_storage
        upload_info = provider.upload_url(
          folder: sub.remote_path,
          filename: file_name,
          content_type: Marcel::MimeType.for(name: file_name)
        )

        # Create or update file state
        file_state = @desktop_client.sync_file_states.find_or_initialize_by(
          remote_path: file_path
        )
        file_state.assign_attributes(
          sync_subscription: sub,
          file_name: file_name,
          local_content_hash: content_hash,
          file_size: file_size,
          sync_status: "pending_upload"
        )
        file_state.save!

        render json: {
          success: true,
          data: {
            upload_url: upload_info[:url],
            upload_method: upload_info[:method] || "PUT",
            upload_headers: upload_info[:headers] || {},
            file_state_id: file_state.id,
            expires_in: 3600
          }
        }
      end

      # POST /api/v1/sync/upload_complete
      # Confirm upload completed
      def upload_complete
        file_state = @desktop_client.sync_file_states.find_by(id: params[:file_state_id])
        unless file_state
          return render json: { success: false, error: "File state not found" }, status: :not_found
        end

        file_state.update!(
          remote_item_id: params[:remote_item_id],
          remote_etag: params[:remote_etag],
          remote_content_hash: file_state.local_content_hash,
          remote_modified_at: Time.current,
          sync_status: "synced",
          last_synced_at: Time.current
        )

        render json: { success: true, data: file_state.as_json }
      end

      # POST /api/v1/sync/conflict/resolve
      # Resolve a sync conflict
      def resolve_conflict
        file_state = @desktop_client.sync_file_states.find_by(id: params[:file_state_id])
        unless file_state
          return render json: { success: false, error: "File not found" }, status: :not_found
        end

        resolution = params[:resolution]  # 'keep_local', 'keep_remote', 'keep_both'
        unless %w[keep_local keep_remote keep_both].include?(resolution)
          return render json: { success: false, error: "Invalid resolution" }, status: :bad_request
        end

        file_state.resolve_conflict!(resolution)

        render json: {
          success: true,
          data: file_state.as_json,
          next_action: resolution == "keep_local" ? "upload" : "download"
        }
      end

      # POST /api/v1/sync/report_state
      # Client reports current file states (batch update)
      def report_state
        states = params[:states] || []

        states.each do |state_params|
          file_state = @desktop_client.sync_file_states.find_by(id: state_params[:id])
          next unless file_state

          file_state.update_from_local!(
            content_hash: state_params[:content_hash],
            modified_at: state_params[:modified_at],
            is_placeholder: state_params[:is_placeholder]
          )
        end

        @desktop_client.update!(last_seen_at: Time.current)

        render json: { success: true }
      end

      private

      def authenticate_desktop_client!
        token = request.headers["Authorization"]&.sub(/^Bearer /, "")
        device_id = request.headers["X-Device-ID"]

        unless token.present?
          return render json: { success: false, error: "Unauthorized" }, status: :unauthorized
        end

        begin
          payload = JWT.decode(token, Rails.application.secret_key_base, true, algorithm: "HS256").first

          @desktop_client = DesktopClient.find_by(
            user_id: payload["sub"],
            device_id: payload["dev"] || device_id,
            is_active: true
          )

          unless @desktop_client
            return render json: { success: false, error: "Device not found or inactive" }, status: :unauthorized
          end

          # Set current_user for compatibility with base controller
          @current_user = @desktop_client.user

        rescue JWT::ExpiredSignature
          render json: { success: false, error: "Token expired" }, status: :unauthorized
        rescue JWT::DecodeError
          render json: { success: false, error: "Invalid token" }, status: :unauthorized
        end
      end

      def current_user
        @current_user ||= super
      end

      def frontend_url
        Rails.application.config.frontend_url || "https://teeemlive.vercel.app"
      end

      def folder_json(entity, type)
        case type
        when "Job"
          {
            id: "job:#{entity.id}",
            type: "Job",
            syncable_id: entity.id,
            name: "#{entity.job_number} - #{entity.title}",
            path: "/Jobs/#{entity.job_number}",
            document_count: entity.job_documents.count,
            has_sharepoint_folder: entity.sharepoint_folder_id.present?
          }
        when "CorporateCompany"
          {
            id: "company:#{entity.id}",
            type: "CorporateCompany",
            syncable_id: entity.id,
            name: entity.name,
            path: "/Companies/#{entity.name}",
            document_count: entity.corporate_company_documents.count,
            has_sharepoint_folder: entity.sharepoint_folder_id.present?
          }
        when "Contact"
          {
            id: "contact:#{entity.id}",
            type: "Contact",
            syncable_id: entity.id,
            name: entity.full_name,
            path: "/People/#{entity.full_name}",
            document_count: entity.people_documents.count
          }
        end
      end

      def fetch_folder_changes(subscription)
        # This would integrate with Microsoft Graph delta API or S3 listing
        # For now, return documents that need syncing

        changes = []

        case subscription.syncable_type
        when "Job"
          docs = JobDocument.where(job_id: subscription.syncable_id)
            .where("updated_at > ?", subscription.last_sync_at || 100.years.ago)

          docs.each do |doc|
            next unless subscription.should_sync_file?(doc.file_name, doc.file_size)

            changes << {
              subscription_id: subscription.id,
              type: doc_change_type(doc, subscription),
              file: {
                id: doc.id,
                path: "#{subscription.remote_path}/#{doc.folder_path}/#{doc.file_name}",
                name: doc.file_name,
                size: doc.file_size,
                modified_at: doc.updated_at,
                item_id: doc.sharepoint_item_id || doc.storage_item_id,
                content_hash: doc.content_hash
              }
            }
          end
        when "CorporateCompany"
          docs = CorporateCompanyDocument.where(company_id: subscription.syncable_id)
            .where("updated_at > ?", subscription.last_sync_at || 100.years.ago)

          docs.each do |doc|
            next unless subscription.should_sync_file?(doc.file_name, doc.file_size)

            changes << {
              subscription_id: subscription.id,
              type: doc_change_type(doc, subscription),
              file: {
                id: doc.id,
                path: "#{subscription.remote_path}/#{doc.folder}/#{doc.file_name}",
                name: doc.file_name,
                size: doc.file_size,
                modified_at: doc.updated_at,
                item_id: doc.sharepoint_file_id || doc.storage_item_id,
                content_hash: doc.content_hash
              }
            }
          end
        end

        changes
      end

      def doc_change_type(doc, subscription)
        if doc.created_at > (subscription.last_sync_at || 100.years.ago)
          "created"
        else
          "modified"
        end
      end
    end
  end
end
