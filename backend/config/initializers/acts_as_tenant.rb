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
