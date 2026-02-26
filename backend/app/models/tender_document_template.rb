# frozen_string_literal: true

class TenderDocumentTemplate < ApplicationRecord
  acts_as_tenant :tenant

  validates :name, presence: true

  scope :active, -> { where(is_active: true) }
  scope :default_template, -> { active.where(is_default: true) }
end
