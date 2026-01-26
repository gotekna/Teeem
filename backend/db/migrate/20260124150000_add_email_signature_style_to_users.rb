# frozen_string_literal: true

class AddEmailSignatureStyleToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :email_signature_style, :string, default: 'modern-dark'
  end
end
