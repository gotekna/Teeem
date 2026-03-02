# frozen_string_literal: true

# Add AI Assistant service credentials to TenantSetting
#
# Allows per-tenant configuration of Deepgram (voice transcription)
# and Slack (bot integration) with ENV fallback for platform-level keys.
#
class AddAssistantSettingsToTenantSettings < ActiveRecord::Migration[7.2]
  def up
    add_column :tenant_settings, :deepgram_api_key, :string, if_not_exists: true
    add_column :tenant_settings, :slack_bot_token, :string, if_not_exists: true
    add_column :tenant_settings, :slack_signing_secret, :string, if_not_exists: true
    add_column :tenant_settings, :assistant_enabled, :boolean, default: false, if_not_exists: true
  end

  def down
    remove_column :tenant_settings, :assistant_enabled, if_exists: true
    remove_column :tenant_settings, :slack_signing_secret, if_exists: true
    remove_column :tenant_settings, :slack_bot_token, if_exists: true
    remove_column :tenant_settings, :deepgram_api_key, if_exists: true
  end
end
