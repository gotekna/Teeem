# frozen_string_literal: true

namespace :xero do
  namespace :tracking do
    desc "Clear lockouts then rename tracking options. Usage: rails xero:tracking:go[tekna]"
    task :go, [:tenant_name] => :environment do |_t, args|
      # Set tenant
      if args[:tenant_name].present?
        tenant = Tenant.find_by("name ILIKE ?", "%#{args[:tenant_name]}%")
        abort "Tenant '#{args[:tenant_name]}' not found" unless tenant
        ActsAsTenant.current_tenant = tenant
        puts "Scoped to tenant: #{tenant.name} (ID: #{tenant.id})"
      end

      # Clear all lockouts
      puts "Clearing Xero rate limit lockouts..."
      XeroRateLimitTracker.clear_lockout!
      XeroRateLimitTracker.heal_all_lockouts!
      XeroCredential.pluck(:tenant_id).each do |tid|
        XeroRateLimitTracker.clear_lockout!(tenant_id: tid)
      end
      puts "Lockouts cleared."

      # Run rename
      puts ""
      puts "Renaming Xero tracking options..."
      service = XeroTrackingSyncService.new
      results = service.rename_all_tracking_options(dry_run: false, force: true)

      puts "\n=== RESULTS ==="
      puts "Updated: #{results[:updated]}"
      puts "Skipped (already correct): #{results[:skipped]}"
      puts "Failed: #{results[:failed]}"
      if results[:errors]&.any?
        puts "\nErrors:"
        results[:errors].each do |err|
          puts "  #{err[:job_code]}: #{err[:error]}"
        end
      end
    end
  end
end
