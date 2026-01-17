# frozen_string_literal: true

# Adds api_environment column to allow company-wide backend environment selection.
# This enables a single frontend URL to serve multiple companies, each pointing
# to their preferred backend (staging/beta/production).
#
# The production backend acts as the "router" - it stores all companies' environment
# preferences and returns the appropriate api_url on login.
#
# Values: 'production' (default), 'beta', 'staging'
class AddApiEnvironmentToCorporateCompanySettings < ActiveRecord::Migration[7.2]
  def change
    add_column :corporate_company_settings, :api_environment, :string, default: 'production'
  end
end
