# frozen_string_literal: true

# Data migration: Update local_template_path values from tekna_documents → teeem_template_documents
# The views directory was renamed as part of the Tekna → Teeem code rebrand.
# Also updates layout values from "tekna" → "teeem" in document_templates.
class RenameTeknaToTeeemTemplatePaths < ActiveRecord::Migration[7.2]
  def up
    # Update template paths
    execute <<-SQL
      UPDATE document_templates
      SET local_template_path = REPLACE(local_template_path, 'tekna_documents/', 'teeem_template_documents/')
      WHERE local_template_path LIKE '%tekna_documents/%'
    SQL

    # Update layout values
    execute <<-SQL
      UPDATE document_templates
      SET layout = 'teeem'
      WHERE layout = 'tekna'
    SQL

    # Update generator_type in pdf_generations
    execute <<-SQL
      UPDATE pdf_generations
      SET generator_type = 'teeem_document'
      WHERE generator_type = 'tekna_document'
    SQL
  end

  def down
    execute <<-SQL
      UPDATE document_templates
      SET local_template_path = REPLACE(local_template_path, 'teeem_template_documents/', 'tekna_documents/')
      WHERE local_template_path LIKE '%teeem_template_documents/%'
    SQL

    execute <<-SQL
      UPDATE document_templates
      SET layout = 'tekna'
      WHERE layout = 'teeem'
    SQL

    execute <<-SQL
      UPDATE pdf_generations
      SET generator_type = 'tekna_document'
      WHERE generator_type = 'teeem_document'
    SQL
  end
end
