# frozen_string_literal: true

# Fix: Sunday was incorrectly marked as a working day in TenantSetting.
# This caused Gantt tasks to land on Sundays instead of skipping to Monday.
class FixTenantSettingSundayWorkingDay < ActiveRecord::Migration[7.2]
  def up
    TenantSetting.find_each do |setting|
      next unless setting.working_days.present?
      next unless setting.working_days["sunday"] == true

      updated_days = setting.working_days.merge("sunday" => false)
      setting.update_column(:working_days, updated_days)
    end
  end

  def down
    # Intentionally no-op - we don't want to re-enable Sunday as working day
  end
end
