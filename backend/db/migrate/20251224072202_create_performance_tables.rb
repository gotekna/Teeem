# Performance Observatory - Q1 Foundation
# Zero-impact collection infrastructure for request timing and web vitals
class CreatePerformanceTables < ActiveRecord::Migration[8.0]
  def change
    # ============================================
    # performance_requests - Backend request timing
    # Captures all API request durations asynchronously
    # ============================================
    create_table :performance_requests do |t|
      t.string :endpoint, null: false          # Request path (e.g., "/api/v1/jobs")
      t.string :method, null: false            # HTTP method (GET, POST, etc.)
      t.integer :duration_ms, null: false      # Total request duration
      t.integer :db_time_ms                    # Time spent in database
      t.integer :view_time_ms                  # Time spent rendering
      t.integer :status_code                   # HTTP response status
      t.references :user, foreign_key: true, index: true
      t.references :organization, foreign_key: true, index: true
      t.string :controller_action              # e.g., "jobs#index"
      t.jsonb :metadata, default: {}           # Additional context (sampled, etc.)

      t.timestamps
    end

    # Indexes for efficient querying
    add_index :performance_requests, :endpoint
    add_index :performance_requests, :created_at
    add_index :performance_requests, [:endpoint, :created_at]
    add_index :performance_requests, :status_code, where: "status_code >= 400"  # Error queries

    # ============================================
    # performance_vitals - Frontend Web Vitals
    # Captures LCP, FID, CLS, INP, TTFB from browser
    # ============================================
    create_table :performance_vitals do |t|
      t.string :metric_name, null: false       # LCP, FID, CLS, INP, TTFB
      t.float :value, null: false              # Metric value (ms or score)
      t.string :page_path                      # Route where metric was captured
      t.string :session_id                     # Browser session identifier
      t.string :user_agent                     # Browser/device info
      t.references :user, foreign_key: true, index: true
      t.string :rating                         # good, needs-improvement, poor
      t.jsonb :metadata, default: {}           # navigation_type, element, etc.

      t.timestamps
    end

    # Indexes for dashboard queries
    add_index :performance_vitals, :metric_name
    add_index :performance_vitals, :created_at
    add_index :performance_vitals, [:metric_name, :created_at]
    add_index :performance_vitals, :page_path
    add_index :performance_vitals, :rating

    # ============================================
    # performance_slow_queries - Slow SQL queries
    # Captures queries > 100ms for analysis
    # ============================================
    create_table :performance_slow_queries do |t|
      t.text :query_fingerprint, null: false   # Normalized query (params replaced)
      t.integer :duration_ms, null: false      # Query execution time
      t.string :table_name                     # Primary table affected
      t.string :operation                      # SELECT, INSERT, UPDATE, DELETE
      t.text :caller_location                  # File:line that triggered query
      t.references :user, foreign_key: true, index: true
      t.string :endpoint                       # API endpoint that triggered query
      t.jsonb :metadata, default: {}           # Explain plan, row count, etc.

      t.timestamps
    end

    # Indexes for slow query analysis
    add_index :performance_slow_queries, :created_at
    add_index :performance_slow_queries, :table_name
    add_index :performance_slow_queries, :duration_ms
    add_index :performance_slow_queries, [:table_name, :created_at]
  end
end
