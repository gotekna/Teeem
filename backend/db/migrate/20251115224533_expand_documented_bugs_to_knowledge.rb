class ExpandDocumentedBugsToKnowledge < ActiveRecord::Migration[8.0]
  def change
    # Add knowledge_type to categorize different types of knowledge
    add_column :documented_bugs, :knowledge_type, :string, default: 'bug', null: false

    # Add universal content fields that work for all knowledge types
    add_column :documented_bugs, :description, :text      # General description
    add_column :documented_bugs, :details, :text          # Detailed explanation
    add_column :documented_bugs, :examples, :text         # Code examples, test scenarios
    add_column :documented_bugs, :recommendations, :text  # Best practices, solutions

    # Add indexes for new columns
    add_index :documented_bugs, :knowledge_type
    add_index :documented_bugs, [ :chapter_number, :knowledge_type ]

    # Make bug-specific columns nullable (they're only used for knowledge_type = 'bug')
    change_column_null :documented_bugs, :status, true
    change_column_null :documented_bugs, :severity, true

    # Update existing records to populate new fields from old fields
    reversible do |dir|
      dir.up do
        # Copy existing bug data to new universal fields
        execute <<-SQL
          UPDATE documented_bugs
          SET
            knowledge_type = 'bug',
            description = scenario,
            details = root_cause,
            recommendations = solution
        SQL
      end
    end
  end
end
