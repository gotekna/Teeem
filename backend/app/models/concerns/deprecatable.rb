# frozen_string_literal: true

# Include this concern in models that are deprecated but not yet removed.
# It provides logging helpers to track usage of deprecated code.
module Deprecatable
  extend ActiveSupport::Concern

  def log_deprecation(message)
    Rails.logger.warn "[DEPRECATED] #{message} (called from #{caller[2]})"
  end

  class_methods do
    def deprecation_warning(message)
      Rails.logger.warn "[DEPRECATED] #{message}"
    end
  end
end
