# frozen_string_literal: true

# Validate that all recurring.yml job entries reference existing classes
#
# Run: rails recurring:validate
#
# Add to CI to prevent deploying with invalid recurring task configs.
# FRC (Jan 2026): Job files were deleted but recurring.yml wasn't updated,
# causing worker crash in production. This task prevents that.
#
namespace :recurring do
  desc "Validate all recurring.yml entries reference existing job classes"
  task validate: :environment do
    puts "Validating recurring.yml..."
    puts "=" * 60

    config_path = Rails.root.join("config", "recurring.yml")
    unless File.exist?(config_path)
      puts "No recurring.yml found - skipping validation"
      exit 0
    end

    config = YAML.safe_load_file(config_path, permitted_classes: [Symbol])
    invalid = []
    valid = 0

    config.each do |task_name, task_config|
      next if task_name.start_with?("#") # Skip comments
      next unless task_config.is_a?(Hash)

      class_name = task_config["class"]
      next unless class_name

      begin
        class_name.constantize
        valid += 1
        puts "  ✅ #{task_name}: #{class_name}"
      rescue NameError
        invalid << { name: task_name, class: class_name }
        puts "  ❌ #{task_name}: #{class_name} - CLASS NOT FOUND"
      end
    end

    puts ""
    puts "=" * 60
    puts "Valid: #{valid}, Invalid: #{invalid.count}"

    if invalid.any?
      puts ""
      puts "ERROR: #{invalid.count} recurring tasks reference non-existent classes:"
      invalid.each do |entry|
        puts "  - #{entry[:name]}: #{entry[:class]}"
      end
      puts ""
      puts "Fix: Remove these entries from config/recurring.yml"
      puts "     or create the missing job classes."
      exit 1
    else
      puts ""
      puts "All recurring tasks are valid!"
    end
  end
end
