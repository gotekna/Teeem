class CreateImplementationPatterns < ActiveRecord::Migration[8.0]
  def change
    create_table :implementation_patterns do |t|
      # Chapter organization
      t.integer :chapter_number, null: false
      t.string :chapter_name, null: false
      t.string :section_number, null: false  # e.g., "0.1", "19.1"
      t.string :pattern_title, null: false   # e.g., "API Response Format Pattern"

      # Bible cross-reference
      t.string :bible_rule_reference         # e.g., "RULE #2", "RULE #19.1"

      # Content sections
      t.text :quick_start                    # Minimal code example
      t.text :full_implementation            # Complete code with comments
      t.text :architecture                   # Architecture notes and patterns
      t.text :common_mistakes                # ❌ Don't / ✅ Do examples
      t.text :testing                        # Test examples
      t.text :migration_guide                # How to refactor to this pattern
      t.text :integration                    # How to integrate with other systems
      t.text :notes                          # Additional notes

      # Code examples as structured data
      t.jsonb :code_examples, default: []    # Array of {language, code, description}

      # Metadata
      t.jsonb :metadata, default: {}
      t.text :search_text                    # Full-text search field
      t.string :complexity, default: "medium" # simple, medium, complex
      t.string :languages, array: true, default: [] # ["ruby", "javascript", "sql"]
      t.string :tags, array: true, default: []      # ["api", "authentication", "security"]

      t.timestamps
    end

    # Indexes for performance
    add_index :implementation_patterns, :chapter_number
    add_index :implementation_patterns, :section_number
    add_index :implementation_patterns, [ :chapter_number, :section_number ], unique: true,
              name: 'index_implementation_patterns_on_chapter_and_section'
    add_index :implementation_patterns, :complexity
    add_index :implementation_patterns, :languages, using: :gin
    add_index :implementation_patterns, :tags, using: :gin

    # Full-text search index (requires pg_trgm extension)
    add_index :implementation_patterns, :search_text, opclass: :gin_trgm_ops, using: :gin
  end
end
