class AddEmailClassificationFields < ActiveRecord::Migration[8.0]
  def change
    # Add email classification fields to email_warehouse table
    add_column :email_warehouse, :internet_headers, :jsonb, default: {}
    add_column :email_warehouse, :email_classification, :jsonb, default: {}
    add_column :email_warehouse, :user_classification, :string
    add_column :email_warehouse, :user_classification_at, :datetime
    add_column :email_warehouse, :user_classification_by_id, :bigint

    # Add indexes for efficient querying
    add_index :email_warehouse, :internet_headers, using: :gin
    add_index :email_warehouse, :email_classification, using: :gin
    add_index :email_warehouse, :user_classification

    # Add foreign key for user who classified the email
    add_foreign_key :email_warehouse, :users, column: :user_classification_by_id
  end
end
