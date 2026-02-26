# FRC (Feb 2026): Sentry TEEEM-BACKEND-AR (11x)
# PG::ForeignKeyViolation when deleting e_signature_signers.
# Root cause: FK constraint e_signature_events.e_signature_signer_id -> e_signature_signers.id
# had no ON DELETE clause. While Rails has dependent: :destroy on the association,
# race conditions or non-Rails deletion paths bypass callbacks.
# Fix: Add ON DELETE CASCADE at the database level as a safety net.
# Also add cascade to e_signature_fields FK for the same reason.
class AddCascadeDeleteToESignatureEventsSignerFk < ActiveRecord::Migration[8.0]
  def up
    # e_signature_events -> e_signature_signers
    # Rails has dependent: :destroy on the signer, but CASCADE at DB level as safety net.
    # Events with NULL signer_id (request-level events) are unaffected by CASCADE.
    remove_foreign_key :e_signature_events, :e_signature_signers, if_exists: true
    add_foreign_key :e_signature_events, :e_signature_signers, on_delete: :nullify

    # e_signature_fields -> e_signature_signers (signer_id is NOT NULL, so CASCADE)
    remove_foreign_key :e_signature_fields, :e_signature_signers, if_exists: true
    add_foreign_key :e_signature_fields, :e_signature_signers, on_delete: :cascade
  end

  def down
    remove_foreign_key :e_signature_events, :e_signature_signers, if_exists: true
    add_foreign_key :e_signature_events, :e_signature_signers

    remove_foreign_key :e_signature_fields, :e_signature_signers, if_exists: true
    add_foreign_key :e_signature_fields, :e_signature_signers
  end
end
