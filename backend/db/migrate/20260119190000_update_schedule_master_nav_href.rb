class UpdateScheduleMasterNavHref < ActiveRecord::Migration[8.0]
  def up
    # Update Schedule Master navigation to point to the Data View Setup page
    schedule_item = NavigationItem.find_by(href: "/schedule-master")
    if schedule_item
      schedule_item.update!(href: "/admin/system/schedule-master/data-view/setup")
      Rails.logger.info "Updated Schedule nav href to /admin/system/schedule-master/data-view/setup"
    else
      Rails.logger.warn "Schedule nav item not found (href: /schedule-master)"
    end

    # Update Gantt Schedule navigation to point to the Gantt tab
    gantt_item = NavigationItem.find_by(href: "/gantt-schedule")
    if gantt_item
      gantt_item.update!(href: "/admin/system/schedule-master/gantt")
      Rails.logger.info "Updated Gantt Schedule nav href to /admin/system/schedule-master/gantt"
    else
      Rails.logger.warn "Gantt Schedule nav item not found (href: /gantt-schedule)"
    end
  end

  def down
    # Revert Schedule Master href
    schedule_item = NavigationItem.find_by(href: "/admin/system/schedule-master/data-view/setup")
    if schedule_item
      schedule_item.update!(href: "/schedule-master")
      Rails.logger.info "Reverted Schedule nav href to /schedule-master"
    end

    # Revert Gantt Schedule href
    gantt_item = NavigationItem.find_by(href: "/admin/system/schedule-master/gantt")
    if gantt_item
      gantt_item.update!(href: "/gantt-schedule")
      Rails.logger.info "Reverted Gantt Schedule nav href to /gantt-schedule"
    end
  end
end
