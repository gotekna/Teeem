# frozen_string_literal: true

class EnhanceXeroCredentialsForReliability < ActiveRecord::Migration[8.0]
  def change
    # Status state machine: connected -> degraded -> disconnected
    add_column :xero_credentials, :status, :string, default: 'connected', null: false

    # Track refresh token expiry (60 days from last use)
    add_column :xero_credentials, :refresh_token_expires_at, :datetime

    # Track refresh attempts and failures
    add_column :xero_credentials, :last_refresh_at, :datetime
    add_column :xero_credentials, :last_refresh_error, :text
    add_column :xero_credentials, :refresh_failure_count, :integer, default: 0, null: false

    # Track API call success for 60-day inactivity prevention
    add_column :xero_credentials, :last_successful_api_call_at, :datetime

    # Circuit breaker state: closed (healthy) -> open (broken) -> half_open (testing)
    add_column :xero_credentials, :circuit_state, :string, default: 'closed', null: false
    add_column :xero_credentials, :circuit_opened_at, :datetime
    add_column :xero_credentials, :circuit_failure_count, :integer, default: 0, null: false

    # Track OAuth scopes for re-authorization detection
    add_column :xero_credentials, :granted_scopes, :string

    add_index :xero_credentials, :status
    add_index :xero_credentials, :circuit_state
    add_index :xero_credentials, :last_successful_api_call_at
  end
end
