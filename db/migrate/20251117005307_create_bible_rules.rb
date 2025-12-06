class CreateBibleRules < ActiveRecord::Migration[8.0]
  def change
    create_table :bible_rules do |t|
      t.integer :chapter_number, null: false  # 0-20
      t.string :chapter_name, null: false
      t.string :rule_number, null: false      # e.g., "19.1", "9.3A"
      t.string :title, null: false
      t.string :rule_type                     # e.g., "MUST", "NEVER", "ALWAYS", "PROTECTED"
      t.text :description, null: false        # The actual rule text
      t.text :code_example                    # Optional protected code pattern
      t.text :cross_references                # Links to Teacher, Lexicon, etc.
      t.integer :sort_order, default: 0       # For ordering rules within a chapter

      t.timestamps
    end

    add_index :bible_rules, [ :chapter_number, :rule_number ], unique: true
    add_index :bible_rules, :chapter_number
  end
end
