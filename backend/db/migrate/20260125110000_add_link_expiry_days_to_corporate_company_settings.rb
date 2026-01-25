# frozen_string_literal: true

class AddLinkExpiryDaysToCorporateCompanySettings < ActiveRecord::Migration[7.1]
  def change
    add_column :corporate_company_settings, :link_expiry_days, :integer, default: 7, null: false,
               comment: "Days before presigned download URLs expire (default: 7)"
  end
end
