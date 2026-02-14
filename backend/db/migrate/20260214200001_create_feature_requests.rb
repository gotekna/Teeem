class CreateFeatureRequests < ActiveRecord::Migration[7.1]
  def change
    create_table :feature_requests do |t|
      t.string   :title, null: false
      t.text     :description
      t.string   :category, default: 'feature', null: false
      t.string   :status, default: 'submitted', null: false
      t.integer  :priority_order
      t.bigint   :submitted_by_user_id
      t.bigint   :submitted_by_tenant_id
      t.string   :submitted_by_name
      t.string   :submitted_by_company
      t.text     :admin_notes
      t.text     :status_update
      t.integer  :follower_count, default: 0, null: false
      t.jsonb    :follower_user_ids, default: []
      t.timestamps
    end

    add_index :feature_requests, :status
    add_index :feature_requests, :category
    add_index :feature_requests, :priority_order
    add_index :feature_requests, :submitted_by_user_id
  end
end
