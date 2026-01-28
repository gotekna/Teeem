# Add "General Documents" catch-all DocumentTypes for each scope
# SSoT: These are fallback types for documents that can't be mapped to a specific DocumentType
# Uses {OriginalFileName} to preserve the original filename during migration
class AddCatchallDocumentTypes < ActiveRecord::Migration[7.1]
  def up
    # Get default tenant for single-tenant app
    tenant = Tenant.first
    return unless tenant

    # ════════════════════════════════════════════════════════════════════════════════
    # CATCH-ALL DOCUMENT TYPES
    # Purpose: Fallback for migrated documents that can't be mapped to a specific type
    # The {OriginalFileName} placeholder preserves the source filename
    # skip_rename: true prevents automatic renaming during migration
    # ════════════════════════════════════════════════════════════════════════════════

    catchall_types = [
      {
        name: 'General Documents',
        abbreviation: 'GEN',
        description: 'Catch-all for unmapped documents during migration. Preserves original filename.',
        scope: 'company',
        folder: 'General',
        file_name: '{OriginalFileName}',
        skip_rename: true,
        active: true
      },
      {
        name: 'General Documents',
        abbreviation: 'GEN',
        description: 'Catch-all for unmapped job documents during migration. Preserves original filename.',
        scope: 'job',
        folder: 'General',
        file_name: '{OriginalFileName}',
        skip_rename: true,
        active: true
      },
      {
        name: 'General Documents',
        abbreviation: 'GEN',
        description: 'Catch-all for unmapped contact documents during migration. Preserves original filename.',
        scope: 'contacts',
        folder: 'General',
        file_name: '{OriginalFileName}',
        skip_rename: true,
        active: true
      }
    ]

    catchall_types.each do |attrs|
      # Find or create by name + scope (uniqueness constraint)
      DocumentType.find_or_create_by!(
        tenant: tenant,
        name: attrs[:name],
        scope: attrs[:scope]
      ) do |dt|
        dt.abbreviation = attrs[:abbreviation]
        dt.description = attrs[:description]
        dt.folder = attrs[:folder]
        dt.file_name = attrs[:file_name]
        dt.skip_rename = attrs[:skip_rename]
        dt.active = attrs[:active]
      end
    end

    Rails.logger.info "[Migration] Created #{catchall_types.size} catch-all document types (General Documents for company, job, contacts)"
  end

  def down
    # Remove the catch-all document types
    DocumentType.where(name: 'General Documents', scope: %w[company job contacts]).destroy_all
  end
end
