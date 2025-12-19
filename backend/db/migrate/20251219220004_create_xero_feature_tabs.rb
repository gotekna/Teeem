class CreateXeroFeatureTabs < ActiveRecord::Migration[8.0]
  def change
    create_table :xero_feature_tabs do |t|
      t.timestamps
    end
  end
end
