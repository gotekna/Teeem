# frozen_string_literal: true

class RenameSupportsVersioningToTracksSigningStatus < ActiveRecord::Migration[7.1]
  def change
    rename_column :document_types, :supports_versioning, :tracks_signing_status
    rename_index :document_types, "index_document_types_on_supports_versioning", "index_document_types_on_tracks_signing_status"
  end
end
