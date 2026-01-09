class CreateHealthCheckCache < ActiveRecord::Migration[8.0]
  def change
    create_table :health_check_caches do |t|
      t.integer :foundation_id       # null for system-wide cache
      t.string :check_type          # 'foundation' or 'system'
      t.jsonb :results              # Full health check results
      t.datetime :last_run_at       # When cache was generated
      t.integer :overall_health     # Duplicate for quick queries
      t.integer :total_issues       # Duplicate for quick queries

      t.timestamps
    end

    add_index :health_check_caches, [ :foundation_id, :check_type ], unique: true, name: 'index_health_cache_on_foundation_and_type'
    add_index :health_check_caches, :check_type
    add_index :health_check_caches, :last_run_at
  end
end
