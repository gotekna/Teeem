# frozen_string_literal: true

# CaseDocument - Links documents to cases for investigation tracking
#
# FRC (Feb 2026): Model file was missing despite case_documents table existing.
# CaseRecord#case_documents association referenced this class, causing NameError
# on every Cases page load.
#
# Note: company_document_id column is legacy - company_documents table was DROPPED (Jan 2026).
# Documents are now managed via WarehouseDocument (SSoT). The column remains for
# backwards compatibility with existing data but the association is not defined.
class CaseDocument < ApplicationRecord
  belongs_to :case_record, foreign_key: :case_id
  belongs_to :added_by, class_name: "User", optional: true

  # Scopes
  scope :by_relevance, ->(relevance) { where(relevance: relevance) }
  scope :ordered, -> { order(:sequence) }
end
