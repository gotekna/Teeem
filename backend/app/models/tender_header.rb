# frozen_string_literal: true

# TenderHeader - Top-level groupings for tender document sections.
#
# Headers are display containers that group related tender sections:
#   TH-002 Site Costs (header)
#     TS-010 Site Preparation (section)
#     TS-011 Piering to Slab (section)
#
# Headers don't have section_type, show_line_items, section_notes, or default_note.
# Those belong on Tender (sections) only.
#
# See also: Tender (sections), TenderDocumentService (creates documents from hierarchy)
#
class TenderHeader < ApplicationRecord
  acts_as_tenant :tenant
  include ConfigSyncable
  self.sync_key_source = :code

  # Associations
  has_many :tenders, foreign_key: :tender_header_id, dependent: :nullify

  # Validations
  validates :code, presence: true, uniqueness: { scope: :tenant_id }, length: { maximum: 20 }
  validates :name, presence: true, length: { maximum: 100 }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :ordered, -> {
    order(
      Arel.sql("COALESCE(sort_order, (regexp_match(name, '^(\\d+)'))[1]::int, 999999)"),
      :name
    )
  }

  # Build tree structure for API response (headers with nested sections)
  def self.tree
    active.ordered.includes(:tenders).map(&:as_tree_node)
  end

  def as_tree_node
    {
      id: id,
      code: code,
      name: name,
      sortOrder: sort_order,
      description: description,
      children: tenders.select(&:active?).sort_by { |t| [t.sort_order || 999999, t.name] }.map { |child|
        {
          id: child.id,
          code: child.code,
          name: child.name,
          sortOrder: child.sort_order,
          sectionType: child.section_type,
          defaultNote: child.default_note,
          description: child.description,
          attachedDocumentTypes: child.attached_document_types || []
        }
      }
    }
  end
end
