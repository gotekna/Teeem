# frozen_string_literal: true

module Gl
  # Member of a duplicate group
  class DuplicateMember < ApplicationRecord
    self.table_name = "gl_duplicate_members"

    belongs_to :duplicate_group, class_name: "Gl::DuplicateGroup"
    belongs_to :duplicable, polymorphic: true

    scope :primary, -> { where(is_primary: true) }
    scope :retained, -> { where(is_retained: true) }
  end
end
