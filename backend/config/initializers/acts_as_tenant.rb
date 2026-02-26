# Multi-tenancy configuration using acts_as_tenant
# See: https://github.com/ErwinM/acts_as_tenant

ActsAsTenant.configure do |config|
  # Require a tenant to be set for all queries (prevents accidental data leaks)
  # This is set to false initially during migration, will be set to true after migration complete
  config.require_tenant = false

  # Don't raise error if no tenant set in development/test (helps with migration)
  # In production, this should be true once migration is complete
  # config.require_tenant = Rails.env.production?
end

# FRC (Feb 2026): Harden acts_as_tenant ActiveJob deserialization
# The gem's deserialize method crashes ALL queued jobs if GlobalID::Locator.locate
# fails (e.g., transient schema cache issue, corrupted job data). This override
# adds error handling so a single bad tenant GID doesn't cascade to all jobs.
# See: Sentry TEEEM-BACKEND-94 (14 simultaneous crashes from one bad deserialization)
Rails.application.config.after_initialize do
  if defined?(ActsAsTenant::ActiveJobExtensions)
    ActsAsTenant::ActiveJobExtensions.module_eval do
      def deserialize(job_data)
        tenant_global_id = job_data.delete("current_tenant")
        if tenant_global_id.present?
          begin
            ActsAsTenant.current_tenant = GlobalID::Locator.locate(tenant_global_id)
          rescue StandardError => e
            Rails.logger.error "[ActsAsTenant] Failed to deserialize tenant from GID '#{tenant_global_id}': #{e.class} - #{e.message}"
            Sentry.capture_exception(e, extra: { tenant_gid: tenant_global_id.to_s }) if defined?(Sentry)
            ActsAsTenant.current_tenant = nil
          end
        end
        super
      end
    end
  end
end
