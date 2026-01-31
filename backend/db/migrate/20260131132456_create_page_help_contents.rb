# frozen_string_literal: true

# Page Help System - Contextual help for every screen
# Stores help content that can be edited by admins
class CreatePageHelpContents < ActiveRecord::Migration[8.0]
  def change
    create_table :page_help_contents do |t|
      t.string :route_pattern, null: false, index: { unique: true }  # e.g., "/settings/system", "/jobs/*"
      t.string :title, null: false                                    # Page title for help
      t.text :description                                             # What this page is for
      t.text :quick_tips                                              # Bullet points of tips (JSON array)
      t.text :common_tasks                                            # How to do common tasks (JSON array)
      t.text :related_pages                                           # Links to related pages (JSON array)
      t.integer :chapter_number                                       # Link to user manual chapter
      t.string :video_url                                             # Optional tutorial video
      t.boolean :is_active, default: true, null: false                # Can disable help for specific pages
      t.references :last_updated_by, foreign_key: { to_table: :users }
      t.timestamps
    end

    add_index :page_help_contents, :is_active
  end
end
