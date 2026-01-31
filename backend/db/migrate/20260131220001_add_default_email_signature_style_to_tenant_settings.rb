class AddDefaultEmailSignatureStyleToTenantSettings < ActiveRecord::Migration[8.0]
  def change
    add_column :tenant_settings, :default_email_signature_style, :string, default: 'modern-dark'
  end
end
