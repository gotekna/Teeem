# frozen_string_literal: true

class CreateEmailTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :email_templates do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.string :subject
      t.text :body_html
      t.text :body_text
      t.jsonb :variables, default: []  # ["{{recipient_name}}", "{{job_name}}"]
      t.string :category  # "quick_reply", "formal", "follow_up", etc.
      t.boolean :is_shared, default: false  # Visible to team
      t.boolean :is_favorite, default: false  # Quick access
      t.integer :usage_count, default: 0
      t.integer :position, default: 0  # For ordering

      t.timestamps
    end

    # User can only have one template with same name
    add_index :email_templates, [:user_id, :name], unique: true

    # Fast lookup for shared templates
    add_index :email_templates, :is_shared, where: "is_shared = true"

    # Fast lookup for favorites
    add_index :email_templates, [:user_id, :is_favorite], where: "is_favorite = true"

    # Category filtering
    add_index :email_templates, [:user_id, :category]
  end
end
