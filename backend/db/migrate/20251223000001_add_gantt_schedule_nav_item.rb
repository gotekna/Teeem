# frozen_string_literal: true

class AddGanttScheduleNavItem < ActiveRecord::Migration[8.0]
  def up
    # Find the Jobs navigation item
    jobs_item = NavigationItem.find_by(href: "/jobs")

    if jobs_item
      # Add "Gantt Schedule" as a child of Jobs
      NavigationItem.find_or_create_by!(href: "/gantt-schedule") do |item|
        item.name = "Gantt Schedule"
        item.icon = "GanttChartSquare"
        item.position = 0  # First child under Jobs
        item.parent = jobs_item
        item.is_active = true
        item.visible_to_roles = []
      end
    else
      puts "Warning: Jobs navigation item not found, skipping Gantt Schedule creation"
    end
  end

  def down
    NavigationItem.find_by(href: "/gantt-schedule")&.destroy
  end
end
