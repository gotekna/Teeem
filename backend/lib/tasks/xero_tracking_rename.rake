# frozen_string_literal: true

namespace :xero do
  namespace :tracking do
    desc "Preview renaming tracking options to new format (job_code + address). Usage: rails xero:tracking:preview[tekna]"
    task :preview, [:tenant_name] => :environment do |_t, args|
      set_tenant!(args[:tenant_name])

      service = XeroTrackingSyncService.new
      results = service.rename_all_tracking_options(dry_run: true)
      puts "\n=== DRY RUN RESULTS ==="
      puts "Tenant: #{ActsAsTenant.current_tenant&.name || 'ALL'}"
      puts "Would update: #{results[:updated]}"
      puts "Already correct: #{results[:skipped]}"
      puts "Check logs for details"
    end

    desc "Rename tracking options in Xero to new format (job_code + address). Usage: rails xero:tracking:rename[tekna]"
    task :rename, [:tenant_name] => :environment do |_t, args|
      set_tenant!(args[:tenant_name])

      puts "Renaming Xero tracking options to new format..."
      puts "Tenant: #{ActsAsTenant.current_tenant&.name || 'ALL'}"
      puts "Format: J201 - 17 Redruth Rd Alexandra Hills"
      puts ""

      service = XeroTrackingSyncService.new
      results = service.rename_all_tracking_options(dry_run: false)

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

    def set_tenant!(tenant_name)
      return unless tenant_name.present?

      tenant = Tenant.find_by("name ILIKE ?", "%#{tenant_name}%")
      abort "Tenant '#{tenant_name}' not found" unless tenant

      ActsAsTenant.current_tenant = tenant
      puts "Scoped to tenant: #{tenant.name} (ID: #{tenant.id})"
    end
  end
end
