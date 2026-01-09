# frozen_string_literal: true

module Gl
  # Version history for quotes
  class QuoteVersion < ApplicationRecord
    self.table_name = "gl_quote_versions"

    belongs_to :quote, class_name: "Gl::Quote"
    belongs_to :created_by, class_name: "User", optional: true

    validates :version_number, presence: true, uniqueness: { scope: :quote_id }
  end
end
