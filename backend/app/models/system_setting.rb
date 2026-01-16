# System-wide application settings stored as key-value pairs
#
# This model provides a flexible way to store application-wide settings
# that can be modified through the UI without requiring code changes.
#
# Usage:
#   SystemSetting.get('some_key')
#   SystemSetting.set('some_key', 'some_value')
#
class SystemSetting < ApplicationRecord
  validates :setting_key, presence: true, uniqueness: true
  validates :setting_type, inclusion: { in: %w[string integer boolean json] }

  # Get a setting value by key
  # Returns nil if not found
  def self.get(key)
    setting = find_by(setting_key: key)
    return nil unless setting

    case setting.setting_type
    when "integer"
      setting.setting_value.to_i
    when "boolean"
      setting.setting_value == "true"
    when "json"
      JSON.parse(setting.setting_value) rescue nil
    else
      setting.setting_value
    end
  end

  # Set a setting value by key
  # Creates the setting if it doesn't exist
  def self.set(key, value, type: "string", description: nil)
    setting = find_or_initialize_by(setting_key: key)
    setting.setting_value = value.to_s
    setting.setting_type = type
    setting.description = description if description
    setting.save!
    setting
  end
end
