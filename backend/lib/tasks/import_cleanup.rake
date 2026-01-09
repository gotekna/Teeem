namespace :import_sessions do
  desc "Clean up expired import sessions and their files"
  task cleanup: :environment do
    puts "Cleaning up expired import sessions..."

    count = 0
    ImportSession.expired.find_each do |session|
      session.cleanup_file!
      count += 1
    end

    puts "Cleaned up #{count} expired import session(s)"
  end

  desc "Clean up all import sessions older than 24 hours"
  task cleanup_old: :environment do
    puts "Cleaning up import sessions older than 24 hours..."

    count = 0
    ImportSession.where("created_at < ?", 24.hours.ago).find_each do |session|
      session.cleanup_file!
      count += 1
    end

    puts "Cleaned up #{count} old import session(s)"
  end
end
