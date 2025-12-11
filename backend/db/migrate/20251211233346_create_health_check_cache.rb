class CreateHealthCheckCache < ActiveRecord::Migration[8.0]
  def change
    create_table :health_check_caches do |t|
      t.integer :foundation_id
      t.string :check_type
      t.jsonb :results
      t.datetime :last_run_at

      t.timestamps
    end
  end
end
