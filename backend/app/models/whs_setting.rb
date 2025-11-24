class WHSSetting < ApplicationRecord
  # Constants
  SETTING_TYPES = %w[string integer boolean json].freeze

  # Validations
  validates :setting_key, presence: true, uniqueness: true
  validates :setting_type, inclusion: { in: SETTING_TYPES }

  # Scopes
  scope :by_key, ->(key) { find_by(setting_key: key) }

  # Class methods for easy access to settings
  class << self
    def get(key, default = nil)
      setting = find_by(setting_key: key)
      return default unless setting

      parse_value(setting)
    end

    def set(key, value, description: nil, type: 'string')
      setting = find_or_initialize_by(setting_key: key)
      setting.setting_value = serialize_value(value, type)
      setting.setting_type = type
      setting.description = description if description
      setting.save!
      setting
    end

    def boolean?(key)
      setting = find_by(setting_key: key)
      return false unless setting && setting.setting_type == 'boolean'

      parse_value(setting)
    end

    def integer(key, default = 0)
      get(key, default).to_i
    end

    def string(key, default = '')
      get(key, default).to_s
    end

    private

    def parse_value(setting)
      return nil if setting.setting_value.nil?

      case setting.setting_type
      when 'boolean'
        ActiveModel::Type::Boolean.new.cast(setting.setting_value)
      when 'integer'
        setting.setting_value.to_i
      when 'json'
        JSON.parse(setting.setting_value)
      else
        setting.setting_value
      end
    rescue JSON::ParserError
      setting.setting_value
    end

    def serialize_value(value, type)
      case type
      when 'json'
        value.to_json
      when 'boolean'
        value.to_s
      else
        value.to_s
      end
    end
  end

  # Instance methods
  def parsed_value
    self.class.send(:parse_value, self)
  end

  def update_value(new_value)
    self.setting_value = self.class.send(:serialize_value, new_value, setting_type)
    save
  end
end
