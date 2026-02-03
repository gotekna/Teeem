# frozen_string_literal: true

module Gl
  # Multi-dimensional tracking class (location, project, product line, etc.)
  class TrackingClass < ApplicationRecord
    self.table_name = "gl_tracking_classes"

    CLASS_TYPES = %w[location region project product_line cost_center custom].freeze

    belongs_to :corporate, foreign_key: "company_id"
    belongs_to :parent, class_name: "Gl::TrackingClass", optional: true

    has_many :children, class_name: "Gl::TrackingClass", foreign_key: :parent_id, dependent: :nullify
    has_many :assignments, class_name: "Gl::ClassAssignment", foreign_key: :tracking_class_id, dependent: :destroy

    validates :name, presence: true
    validates :class_type, presence: true, inclusion: { in: CLASS_TYPES }
    validates :code, uniqueness: { scope: [:corporate_id, :class_type] }, allow_blank: true

    scope :active, -> { where(active: true) }
    scope :for_type, ->(type) { where(class_type: type) }
    scope :top_level, -> { where(parent_id: nil) }

    # Full path
    def full_path
      path = [name]
      current = parent
      while current
        path.unshift(current.name)
        current = current.parent
      end
      path.join(" > ")
    end

    # Get totals for a period
    def totals(start_date:, end_date:)
      # Sum amounts from all assigned transactions
      assignment_ids = assignments.pluck(:id)

      # Would need to query through the polymorphic association
      # This is simplified - would need proper implementation
      {
        revenue: 0,
        expenses: 0,
        profit: 0
      }
    end

    # Tree by type
    def self.tree_by_type(company, class_type)
      classes = company.gl_tracking_classes.active.for_type(class_type).includes(:children)
      top_level = classes.select { |c| c.parent_id.nil? }

      top_level.map { |c| build_tree_node(c, classes) }
    end

    # All types with counts
    def self.summary_by_type(company)
      CLASS_TYPES.map do |type|
        count = company.gl_tracking_classes.active.for_type(type).count
        {
          type: type,
          label: type.titleize,
          count: count
        }
      end
    end

    private

    def self.build_tree_node(tracking_class, all_classes)
      children = all_classes.select { |c| c.parent_id == tracking_class.id }
      {
        id: tracking_class.id,
        name: tracking_class.name,
        code: tracking_class.code,
        children: children.map { |c| build_tree_node(c, all_classes) }
      }
    end
  end
end
