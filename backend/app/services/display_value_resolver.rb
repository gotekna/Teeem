# Centralized service for resolving display values from any model
# This is the Single Source of Truth for "how to display a record"
class DisplayValueResolver
  class << self
    # Get the best display value for any ActiveRecord model
    # Order of preference: display_name > name > title > subject > ID fallback
    def resolve(record)
      return "Unknown" if record.nil?

      # Try display_name first (standard convention across app)
      return record.display_name if record.respond_to?(:display_name) && record.display_name.present?

      # Try name (most models)
      return record.name if record.respond_to?(:name) && record.name.present?

      # Try title (documents, items)
      return record.title if record.respond_to?(:title) && record.title.present?

      # Try subject (emails, messages)
      return record.subject if record.respond_to?(:subject) && record.subject.present?

      # Fallback to ID
      "#{record.class.name} ##{record.id}"
    end

    # Alias for convenience
    def call(record)
      resolve(record)
    end
  end
end
