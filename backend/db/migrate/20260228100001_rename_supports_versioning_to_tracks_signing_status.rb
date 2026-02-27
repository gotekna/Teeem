# frozen_string_literal: true

class RenameSupportsVersioningToTracksSigningStatus < ActiveRecord::Migration[7.1]
  def change
    # Idempotent: column may already be renamed from partial run
    if column_exists?(:document_types, :supports_versioning)
      rename_column :document_types, :supports_versioning, :tracks_signing_status
    end

    # Index rename skipped: PostgreSQL indexes reference column positions, not names.
    # The existing index works fine with the renamed column. Cosmetic rename was
    # causing PG::UndefinedTable in release phase (Feb 2026).
  end
end
