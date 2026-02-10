namespace :release do
  desc "Sync version from git commit messages (SSoT: commit messages)"
  task increment_version: :environment do
    begin
      # SSoT: Parse version from commit messages (vNNNN pattern)
      # This ensures database version matches the version in commit messages
      git_version = parse_version_from_commits

      if git_version
        version = AppVersion.current
        old_version = version.current_version

        if git_version > old_version
          version.update!(current_version: git_version)
          puts "AppVersion synced from git: v#{old_version} → v#{git_version}"
        elsif git_version == old_version
          puts "AppVersion already in sync: v#{git_version}"
        else
          # Git version is lower - unusual, but respect git as SSoT
          version.update!(current_version: git_version)
          puts "AppVersion synced from git (rollback): v#{old_version} → v#{git_version}"
        end
      else
        # Fallback: increment if no version found in commits
        new_version = AppVersion.increment!
        puts "No version in commits, incremented to v#{new_version}"
      end
    rescue => e
      puts "Warning: Failed to sync version: #{e.message}"
      # Don't fail the release if version sync fails
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
      puts "Error: AppVersion must be a positive integer"
      exit 1
    end

    version = AppVersion.current
    old_version = version.current_version
    version.update!(current_version: version_num)
    puts "AppVersion updated: v#{old_version} → v#{version_num}"
  end

  # Parse the highest version number from recent commit messages
  # Looks for patterns like (v2711), (v2712 fix), etc.
  def parse_version_from_commits
    # Get last 50 commits to find version references
    git_log = `git log --oneline -50 2>/dev/null`.to_s

    # Extract all version numbers from commit messages
    # Pattern: (vNNNN) where NNNN is 3-5 digits
    versions = git_log.scan(/\(v(\d{3,5})\b/).flatten.map(&:to_i)

    # Return the highest version found
    versions.max
  rescue => e
    Rails.logger.warn "[release:increment_version] Failed to parse git commits: #{e.message}"
    nil
  end
end
