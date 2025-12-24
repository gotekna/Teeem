class CreateGlAccounts < ActiveRecord::Migration[8.0]
  def change
    create_table :gl_accounts do |t|
      t.timestamps
    end
  end
end
