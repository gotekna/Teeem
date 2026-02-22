# frozen_string_literal: true

# Add AI Assistant service credentials to TenantSetting
#
# Allows per-tenant configuration of Deepgram (voice transcription)
# and Slack (bot integration) with ENV fallback for platform-level keys.
#
class AddAssistantSettingsToTenantSettings < ActiveRecord::Migration[7.2]
  def change
    unless column_exists?(:tenant_settings, :deepgram_api_key)
      add_column :tenant_settings, :deepgram_api_key, :string
    end

    unless column_exists?(:tenant_settings, :slack_bot_token)
      add_column :tenant_settings, :slack_bot_token, :string
    end

    unless column_exists?(:tenant_settings, :slack_signing_secret)
      add_column :tenant_settings, :slack_signing_secret, :string
    end

    unless column_exists?(:tenant_settings, :assistant_enabled)
      add_column :tenant_settings, :assistant_enabled, :boolean, default: false
    end
  end
end
