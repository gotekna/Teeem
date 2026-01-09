class CreateDocumentedBugs < ActiveRecord::Migration[8.0]
  def change
    create_table :documented_bugs do |t|
      # Chapter organization
      t.integer :chapter_number, null: false
      t.string :chapter_name, null: false
      t.string :component                    # "XeroContactSync", "ContactMerge", etc.

      # Bug details
      t.string :bug_title, null: false
      t.string :status, default: 'open'      # open, fixed, by_design, wont_fix, monitoring
      t.string :severity, default: 'medium'  # critical, high, medium, low

      # Dates
      t.date :first_reported
      t.date :last_occurred
      t.date :fixed_date

      # Content
      t.text :scenario                       # Description of the bug
      t.text :root_cause                     # Technical explanation
      t.text :solution                       # Fix or workaround
      t.text :prevention                     # How to prevent in future

      # Metadata
      t.jsonb :metadata, default: {}         # tags, affected_versions, related_prs, etc.

      # Search
      t.text :search_text                    # Concatenated searchable text

      t.timestamps
    end

    add_index :documented_bugs, :chapter_number
    add_index :documented_bugs, :status
    add_index :documented_bugs, :severity
    add_index :documented_bugs, [ :chapter_number, :status ]

    # Enable pg_trgm extension for text search
    enable_extension 'pg_trgm' unless extension_enabled?('pg_trgm')
    add_index :documented_bugs, :search_text, using: :gin, opclass: :gin_trgm_ops
  end
end
