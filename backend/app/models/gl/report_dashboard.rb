# frozen_string_literal: true

module Gl
  # Dashboard containing multiple report widgets
  class ReportDashboard < ApplicationRecord
    self.table_name = "gl_report_dashboards"

    belongs_to :corporate, foreign_key: "company_id"
    belongs_to :created_by, class_name: "User", optional: true

    has_many :widgets, class_name: "Gl::DashboardWidget", foreign_key: :dashboard_id, dependent: :destroy

    validates :name, presence: true

    scope :public_dashboards, -> { where(is_public: true) }
    scope :default_dashboard, -> { where(is_default: true) }

    # Make this the default dashboard
    def make_default!
      transaction do
        corporate.gl_report_dashboards.update_all(is_default: false)
        update!(is_default: true)
      end
    end

    # Add a report widget
    def add_widget!(report, row:, col:, width: 1, height: 1)
      widgets.create!(
        custom_report: report,
        widget_type: "report",
        title: report.name,
        row: row,
        col: col,
        width: width,
        height: height
      )
    end

    # Add a KPI widget
    def add_kpi_widget!(title:, config:, row:, col:, width: 1, height: 1)
      widgets.create!(
        widget_type: "kpi",
        title: title,
        config: config,
        row: row,
        col: col,
        width: width,
        height: height
      )
    end

    # Get widget layout as grid
    def layout_grid
      max_row = widgets.maximum(:row) || 0
      max_col = widgets.maximum(:col) || 0

      grid = Array.new(max_row + 1) { Array.new(max_col + 1) }

      widgets.each do |widget|
        grid[widget.row][widget.col] = widget
      end

      grid
    end

    # Duplicate dashboard
    def duplicate!(user)
      new_dashboard = dup
      new_dashboard.name = "#{name} (Copy)"
      new_dashboard.created_by = user
      new_dashboard.is_default = false
      new_dashboard.save!

      widgets.each do |widget|
        new_dashboard.widgets.create!(widget.attributes.except("id", "dashboard_id", "created_at", "updated_at"))
      end

      new_dashboard
    end
  end
end
