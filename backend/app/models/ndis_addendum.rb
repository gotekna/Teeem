# frozen_string_literal: true

class NdisAddendum < ApplicationRecord
  DOCUMENT_TYPES = %w[specification contract].freeze

  validates :document_type, presence: true, inclusion: { in: DOCUMENT_TYPES }
  validates :title, :content, presence: true

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:position) }
  scope :for_specifications, -> { where(document_type: "specification") }
  scope :for_contracts, -> { where(document_type: "contract") }
  scope :for_section, ->(section_key) { where(section_key: section_key) }

  # Get all active specification addendums
  def self.specification_addendums
    for_specifications.active.ordered
  end

  # Get all active contract addendums
  def self.contract_addendums
    for_contracts.active.ordered
  end
end
