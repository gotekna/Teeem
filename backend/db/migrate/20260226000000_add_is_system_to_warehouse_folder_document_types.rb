# frozen_string_literal: true

# Add is_system flag to warehouse_folder_document_types (WFDTs)
#
# SSoT (Feb 2026): Same pattern as warehouse_folders.is_system
# System WFDTs cannot be deleted by users - they are required by
# coded workflows (e.g., Director Change generates docs linked to
# specific ASIC doc types: RD, RS, RPO, CAD, CAS, CAPO, DM, F484).
#
# The is_system flag ensures tenants can't accidentally remove
# doc types that the code depends on for WFDT lookups.
#
# Also sets {DirectorName} templates on ASIC director change WFDTs.
class AddIsSystemToWarehouseFolderDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    add_column :warehouse_folder_document_types, :is_system, :boolean, default: false, null: false

    reversible do |dir|
      dir.up do
        # Mark ASIC director change doc types as system-protected
        # These are used by DirectorChangeTask and DirectorChangeService
        asic_abbrs = %w[RD RS RPO CAD CAS CAPO DM F484]

        execute <<~SQL
          UPDATE warehouse_folder_document_types
          SET is_system = true
          WHERE id IN (
            SELECT wfdt.id
            FROM warehouse_folder_document_types wfdt
            JOIN document_types dt ON dt.id = wfdt.document_type_id
            JOIN warehouse_folders wf ON wf.id = wfdt.warehouse_folder_id
            WHERE wf.name = 'ASIC'
            AND dt.abbreviation IN (#{asic_abbrs.map { |a| "'#{a}'" }.join(', ')})
          )
        SQL

        # Set {DirectorName} templates on ASIC director change doc types
        # These templates auto-resolve via SendNameResolver using metadata["person"]
        templates = {
          "RD"   => { ui: "Resignation Director - {DirectorName}",         dl: "{CompanyCode} Resignation Director - {DirectorName} {Date}" },
          "RS"   => { ui: "Resignation Secretary - {DirectorName}",        dl: "{CompanyCode} Resignation Secretary - {DirectorName} {Date}" },
          "RPO"  => { ui: "Resignation Public Officer - {DirectorName}",   dl: "{CompanyCode} Resignation Public Officer - {DirectorName} {Date}" },
          "CAD"  => { ui: "Consent to Act as Director - {DirectorName}",   dl: "{CompanyCode} Consent Director - {DirectorName} {Date}" },
          "CAS"  => { ui: "Consent to Act as Secretary - {DirectorName}",  dl: "{CompanyCode} Consent Secretary - {DirectorName} {Date}" },
          "CAPO" => { ui: "Consent to Act as Public Officer - {DirectorName}", dl: "{CompanyCode} Consent Public Officer - {DirectorName} {Date}" },
          "DM"   => { ui: "Directors Minutes {Date}",                      dl: "{CompanyCode} Directors Minutes {Date}" },
          "F484" => { ui: "ASIC Form 484 - Director Changes {Date}",       dl: "{CompanyCode} ASIC Form 484 {Date}" },
        }

        templates.each do |abbr, tmpl|
          escaped_ui = tmpl[:ui].gsub("'", "''")
          escaped_dl = tmpl[:dl].gsub("'", "''")
          execute <<~SQL
            UPDATE warehouse_folder_document_types
            SET ui_name_template = '#{escaped_ui}',
                download_name_template = '#{escaped_dl}'
            WHERE id IN (
              SELECT wfdt.id
              FROM warehouse_folder_document_types wfdt
              JOIN document_types dt ON dt.id = wfdt.document_type_id
              JOIN warehouse_folders wf ON wf.id = wfdt.warehouse_folder_id
              WHERE wf.name = 'ASIC'
              AND dt.abbreviation = '#{abbr}'
            )
          SQL
        end
      end
    end
  end
end
