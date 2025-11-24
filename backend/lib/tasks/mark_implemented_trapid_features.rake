namespace :trapid do
  namespace :features do
    desc "Mark features that Trapid has already implemented (dev_progress > 0)"
    task mark_implemented: :environment do
      puts "Marking Trapid features where dev_progress > 0..."

      # Find all features where development has started (dev_progress > 0)
      features_in_progress = FeatureTracker.where("dev_progress > 0")

      count = 0
      features_in_progress.each do |feature|
        if feature.update(trapid_has: true)
          count += 1
          puts "✓ Marked: #{feature.feature_name} (#{feature.dev_progress}% complete)"
        end
      end

      puts "\n✅ Successfully marked #{count} features as implemented in Trapid"

      # Show summary
      total = FeatureTracker.count
      implemented = FeatureTracker.where(trapid_has: true).count
      percentage = (implemented.to_f / total * 100).round(1)

      puts "\n📊 Summary:"
      puts "   Total features: #{total}"
      puts "   Trapid has: #{implemented} (#{percentage}%)"
      puts "   Still to build: #{total - implemented}"
    end
  end
end
