# frozen_string_literal: true

# SSoT Cleanup Migration (Jan 2026)
#
# Root Cause: Multiple tables have references to CorporateCompanyDocument which was dropped.
# This causes NameError when Rails tries to constantize the polymorphic type.
#
# Issues fixed:
# 1. storage_configurations.document_routing JSONB has old model references
# 2. warehouse_documents.documentable_type references dropped model (14,918 records)
#
# Fix: Update document_routing and null out orphaned polymorphic references.
class FixDocumentRoutingModelReferences < ActiveRecord::Migration[8.0]
  def up
    # 1. Fix storage_configurations.document_routing JSONB
    execute(<<-SQL)
      UPDATE storage_configurations
      SET document_routing = (
        SELECT jsonb_object_agg(
          key,
          CASE
            WHEN value->>'model' = 'CorporateCompanyDocument' THEN
              jsonb_build_object(
                'model', 'WarehouseDocument',
                'warehouse_type', COALESCE(value->>'warehouse_type', value->>'scope', 'corporate_entity'),
                'description', value->>'description'
              )
            ELSE
              CASE
                WHEN value ? 'scope' AND NOT value ? 'warehouse_type' THEN
                  value - 'scope' || jsonb_build_object('warehouse_type', value->>'scope')
                ELSE
                  value
              END
          END
        )
        FROM jsonb_each(document_routing)
      )
      WHERE document_routing::text LIKE '%CorporateCompanyDocument%'
         OR document_routing::text LIKE '%"scope":%'
    SQL

    routing_count = StorageConfiguration.where("document_routing::text LIKE ?", "%CorporateCompanyDocument%").count
    say "Remaining storage_configurations with CorporateCompanyDocument in routing: #{routing_count} (should be 0)"

    # 2. Clear orphaned warehouse_documents.documentable references
    # The source CorporateCompanyDocument records were migrated to WarehouseDocument,
    # but the original source doesn't exist anymore, so null out the reference.
    doc_count = execute(<<-SQL).cmd_tuples
      UPDATE warehouse_documents
      SET documentable_type = NULL, documentable_id = NULL
      WHERE documentable_type = 'CorporateCompanyDocument'
    SQL
    say "Cleared #{doc_count} orphaned documentable references in warehouse_documents"

    # Update column default
    change_column_default :storage_configurations, :document_routing, from: nil, to: {}
  end

  def down
    # Cannot restore old invalid references - they would just cause errors again
    say "Warning: Cannot restore old CorporateCompanyDocument references"
  end
end
