# frozen_string_literal: true

module Gl
  # Assignment of a tracking class to a transaction
  class ClassAssignment < ApplicationRecord
    self.table_name = "gl_class_assignments"

    belongs_to :tracking_class, class_name: "Gl::TrackingClass"
    belongs_to :assignable, polymorphic: true

    validates :percentage, numericality: { greater_than: 0, less_than_or_equal_to: 100 }
    validates :tracking_class_id, uniqueness: { scope: [:assignable_type, :assignable_id] }

    scope :for_type, ->(type) { joins(:tracking_class).where(gl_tracking_classes: { class_type: type }) }

    # Assign classes to a record
    def self.assign!(record, classes_with_percentages)
      transaction do
        where(assignable: record).destroy_all

        classes_with_percentages.each do |class_id, percentage|
          create!(
            assignable: record,
            tracking_class_id: class_id,
            percentage: percentage || 100
          )
        end
      end
    end

    # Get all classes for a record grouped by type
    def self.classes_for(record)
      joins(:tracking_class)
        .where(assignable: record)
        .includes(:tracking_class)
        .group_by { |a| a.tracking_class.class_type }
        .transform_values { |assignments| assignments.map(&:tracking_class) }
    end
  end
end
