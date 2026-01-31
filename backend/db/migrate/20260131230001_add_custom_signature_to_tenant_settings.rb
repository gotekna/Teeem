class AddCustomSignatureToTenantSettings < ActiveRecord::Migration[8.0]
  def change
    # Custom company signature template
    add_column :tenant_settings, :custom_email_signature_html, :text
    add_column :tenant_settings, :custom_email_signature_name, :string, default: 'Company Custom'

    # Force signature on all users (no override allowed)
    add_column :tenant_settings, :force_email_signature, :boolean, default: false
    add_column :tenant_settings, :forced_signature_style, :string
  end
end
