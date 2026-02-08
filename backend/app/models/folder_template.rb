# frozen_string_literal: true

# FolderTemplate - Templates for folder structures
#
# Defines reusable folder structures that can be applied
# when creating new jobs, contacts, or other entities.
#
class FolderTemplate < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :created_by, class_name: "User", optional: true

  validates :name, presence: true

  scope :active, -> { where(is_active: true) }
  scope :system_defaults, -> { where(is_system_default: true) }
end
