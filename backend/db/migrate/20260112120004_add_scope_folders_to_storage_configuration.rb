# frozen_string_literal: true

# Add scope_folders to StorageConfiguration
# SSoT: Replaces hardcoded SCOPE_FOLDERS constant with database-configurable mapping
class AddScopeFoldersToStorageConfiguration < ActiveRecord::Migration[8.0]
  def up
    add_column :storage_configurations, :scope_folders, :jsonb, default: {}, null: false

    # Populate existing records with default scope folders
    default_folders = {
      "job" => "Jobs",
      "corporate" => "Corporate",
      "people" => "Corporate/People",
      "users" => "Users",
      "user_photos" => "Users/Photos",
      "user_contracts" => "Users/Contracts",
      "my_docs" => "Users/MyDocs",
      "contact" => "Contacts",
      "email" => "Emails/eml",
      "email_attachments" => "Emails/attachments",
      "warehouse" => "Warehousing",
      "task" => "Warehousing/Tasks",
      "billinbox" => "Warehousing/BillInbox",
      "pricebook" => "Warehousing/Pricebook Photos",
      "chat" => "Warehousing/Chat",
      "active_storage" => "ActiveStorage",
      "templates" => "Warehousing/Templates",
      "bank_statements" => "Warehousing/Templates/Bank Statements",
      "contracts" => "Warehousing/Templates/Contracts"
    }

    StorageConfiguration.update_all(scope_folders: default_folders)
  end

  def down
    remove_column :storage_configurations, :scope_folders
  end
end
