# frozen_string_literal: true

module Api
  module V1
    # BackupConfigurationsController - Per-tenant backup configuration
    #
    # SSoT: Manages backup schedules, storage providers, and retention policies
    # for each tenant. Admin-only access.
    #
    # Endpoints:
    #   GET    /api/v1/backup_configuration           - Get current config
    #   PATCH  /api/v1/backup_configuration           - Update config
    #   POST   /api/v1/backup_configuration/run_now   - Trigger immediate backup
    #   GET    /api/v1/backup_configuration/history   - Get backup logs
    #   GET    /api/v1/backup_configuration/schedule_presets - Get available presets
    #
    class BackupConfigurationsController < ApplicationController
      before_action :require_admin

      # GET /api/v1/backup_configuration
      def show
        config = BackupConfiguration.for_tenant

        render json: {
          success: true,
          data: config_json(config)
        }
      end

      # PATCH /api/v1/backup_configuration
      def update
        config = BackupConfiguration.for_tenant

        if config.update(backup_params)
          render json: {
            success: true,
            data: config_json(config)
          }
        else
          render json: {
            success: false,
            error: config.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/backup_configuration/run_now
      # Trigger an immediate backup
      # Params: type = "database" | "documents" | "mirror"
      def run_now
        config = BackupConfiguration.for_tenant
        backup_type = params[:type]&.to_s

        unless %w[database documents mirror].include?(backup_type)
          return render json: {
            success: false,
            error: "Invalid backup type. Use 'database', 'documents', or 'mirror'."
          }, status: :unprocessable_entity
        end

        unless config.enabled?
          return render json: {
            success: false,
            error: "Backups are disabled. Enable backups first."
          }, status: :unprocessable_entity
        end

        # Queue the appropriate job
        case backup_type
        when "database"
          unless config.primary_credential
            return render json: {
              success: false,
              error: "Primary storage credential not configured."
            }, status: :unprocessable_entity
          end
          TenantDatabaseBackupJob.perform_later(config.tenant_id)
        when "documents"
          unless config.primary_credential
            return render json: {
              success: false,
              error: "Primary storage credential not configured."
            }, status: :unprocessable_entity
          end
          TenantDocumentBackupJob.perform_later(config.tenant_id)
        when "mirror"
          unless config.mirror_enabled? && config.secondary_credential
            return render json: {
              success: false,
              error: "Mirror is not enabled or secondary credential not configured."
            }, status: :unprocessable_entity
          end
          BackupMirrorJob.perform_later(config.tenant_id)
        end

        render json: {
          success: true,
          message: "#{backup_type.titleize} backup queued successfully."
        }
      end

      # GET /api/v1/backup_configuration/history
      # Returns recent backup logs
      def history
        config = BackupConfiguration.for_tenant
        limit = (params[:limit] || 20).to_i.clamp(1, 100)
        backup_type = params[:type]

        logs = config.backup_logs.recent.limit(limit)
        logs = logs.by_type(backup_type) if backup_type.present?

        render json: {
          success: true,
          data: logs.map { |log| log_json(log) }
        }
      end

      # GET /api/v1/backup_configuration/schedule_presets
      # Returns available schedule presets for UI dropdowns
      def schedule_presets
        presets = BackupConfiguration::SCHEDULE_PRESETS.map do |key, config|
          {
            value: key,
            label: config[:label],
            cron: config[:cron]
          }
        end

        render json: {
          success: true,
          data: presets
        }
      end

      private

      def backup_params
        params.require(:backup_configuration).permit(
          :enabled,
          :database_schedule,
          :document_schedule,
          :retention_days,
          :mirror_enabled,
          :primary_credential_id,
          :secondary_credential_id
        )
      end

      def config_json(config)
        {
          id: config.id,
          enabled: config.enabled,
          databaseSchedule: config.database_schedule,
          databaseScheduleLabel: config.database_schedule_label,
          documentSchedule: config.document_schedule,
          documentScheduleLabel: config.document_schedule_label,
          retentionDays: config.retention_days,
          mirrorEnabled: config.mirror_enabled,
          primaryCredentialId: config.primary_credential_id,
          primaryCredential: credential_json(config.primary_credential),
          secondaryCredentialId: config.secondary_credential_id,
          secondaryCredential: credential_json(config.secondary_credential),
          lastDatabaseBackupAt: config.last_database_backup_at,
          lastDocumentBackupAt: config.last_document_backup_at,
          lastMirrorSyncAt: config.last_mirror_sync_at,
          nextDatabaseBackup: config.next_scheduled_backup(:database),
          nextDocumentBackup: config.next_scheduled_backup(:documents),
          createdAt: config.created_at,
          updatedAt: config.updated_at
        }
      end

      def credential_json(credential)
        return nil unless credential

        {
          id: credential.id,
          name: credential.name,
          providerName: credential.provider_name,
          endpoint: credential.endpoint,
          bucket: credential.bucket,
          isConnected: credential.connected?
        }
      end

      def log_json(log)
        {
          id: log.id,
          backupType: log.backup_type,
          status: log.status,
          sizeBytes: log.size_bytes,
          sizeDisplay: log.size_display,
          durationSeconds: log.duration_seconds,
          durationDisplay: log.duration_display,
          filesCount: log.files_count,
          storageKey: log.storage_key,
          providerName: log.provider_name,
          errorMessage: log.error_message,
          createdAt: log.created_at,
          updatedAt: log.updated_at
        }
      end
    end
  end
end
