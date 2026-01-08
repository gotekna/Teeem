namespace :release do
  desc "Increment version after successful deployment"
  task increment_version: :environment do
    begin
      new_version = Version.increment!
      puts "Version incremented to v#{new_version}"
    rescue => e
      puts "Warning: Failed to increment version: #{e.message}"
      # Don't fail the release if version increment fails
    end
  end

  desc "Set version to specific number (e.g., rake release:set_version[2711])"
  task :set_version, [:version_number] => :environment do |t, args|
    unless args[:version_number]
      puts "Usage: rake release:set_version[2711]"
      exit 1
    end

    version_num = args[:version_number].to_i
    if version_num <= 0
      puts "Error: Version must be a positive integer"
      exit 1
    end

    version = Version.current
    old_version = version.current_version
    version.update!(current_version: version_num)
    puts "Version updated: v#{old_version} → v#{version_num}"
  end
end
