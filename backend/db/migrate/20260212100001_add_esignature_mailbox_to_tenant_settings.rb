class AddEsignatureMailboxToTenantSettings < ActiveRecord::Migration[8.0]
  def change
    add_column :tenant_settings, :monitored_mailbox_esignature, :string
  end
end
