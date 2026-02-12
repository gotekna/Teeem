class AddEsignatureRequireEmailVerificationToTenantSettings < ActiveRecord::Migration[8.0]
  def change
    add_column :tenant_settings, :esignature_require_email_verification, :boolean, default: true, null: false
  end
end
