# frozen_string_literal: true

class AddTeamEmailDomainsToCorporateCompanySettings < ActiveRecord::Migration[7.1]
  def change
    add_column :corporate_settings, :team_email_domains, :text, array: true, default: []
  end
end
