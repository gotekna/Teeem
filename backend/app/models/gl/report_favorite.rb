# frozen_string_literal: true

module Gl
  # User's favorite reports for quick access
  class ReportFavorite < ApplicationRecord
    self.table_name = "gl_report_favorites"

    belongs_to :user
    belongs_to :custom_report, class_name: "Gl::CustomReport"

    validates :user_id, uniqueness: { scope: :custom_report_id }

    scope :ordered, -> { order(:position) }

    # Add to favorites
    def self.add!(user, report)
      max_position = where(user: user).maximum(:position) || 0
      create!(user: user, custom_report: report, position: max_position + 1)
    end

    # Reorder favorites
    def self.reorder!(user, report_ids)
      report_ids.each_with_index do |id, index|
        where(user: user, custom_report_id: id).update_all(position: index)
      end
    end
  end
end
