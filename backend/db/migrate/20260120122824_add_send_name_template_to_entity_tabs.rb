class AddSendNameTemplateToEntityTabs < ActiveRecord::Migration[8.0]
  def change
    add_column :entity_tabs, :send_name_template, :string
  end
end
