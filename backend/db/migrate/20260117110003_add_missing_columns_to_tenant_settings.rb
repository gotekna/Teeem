class AddMissingColumnsToTenantSettings < ActiveRecord::Migration[8.0]
  def change
    add_column :tenant_settings, :gst_number, :string
    add_column :tenant_settings, :logo_mobile, :string
    add_column :tenant_settings, :logo_dark, :string
    add_column :tenant_settings, :bank_name, :string
    add_column :tenant_settings, :bank_bsb, :string
    add_column :tenant_settings, :bank_account_number, :string
    add_column :tenant_settings, :bank_account_name, :string
    add_column :tenant_settings, :twilio_account_sid, :string
    add_column :tenant_settings, :twilio_auth_token, :string
    add_column :tenant_settings, :twilio_phone_number, :string
    add_column :tenant_settings, :twilio_enabled, :boolean
    add_column :tenant_settings, :working_days, :jsonb, default: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: true
    }
    add_column :tenant_settings, :team_email_domains, :jsonb, default: []
  end
end
