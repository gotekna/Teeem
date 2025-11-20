class CreateWhsInductionTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :whs_induction_templates do |t|
      # Template details
      t.string :name, null: false
      t.string :induction_type, null: false # company_wide, site_specific, project_specific, visitor
      t.text :description
      t.boolean :active, default: true
      t.decimal :version, precision: 3, scale: 1, default: 1.0

      # Content sections (JSONB array)
      t.jsonb :content_sections, default: []
      # Each section: { title, content, video_url, quiz_questions: [{question, options, correct_answer}] }

      # Expiry settings
      t.integer :expiry_months # Null if never expires
      t.boolean :requires_renewal, default: false

      # Quiz settings
      t.boolean :has_quiz, default: false
      t.integer :min_passing_score # Percentage

      # Acknowledgment
      t.text :acknowledgment_statement

      # Metadata
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :whs_induction_templates, :name
    add_index :whs_induction_templates, :induction_type
    add_index :whs_induction_templates, :active
  end
end
