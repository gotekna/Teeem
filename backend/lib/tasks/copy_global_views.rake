# frozen_string_literal: true

namespace :views do
  desc "Copy global foundation views from source tenant to all other tenants"
  task copy_globals: :environment do
    # The migration assigned all global views to Tenant.first (TEEEM, id=1)
    # Other tenants need copies of these global views
    source_tenant = Tenant.order(:id).first
    abort "No tenants found!" unless source_tenant

    puts "Source tenant: #{source_tenant.id} (#{source_tenant.name})"

    ActsAsTenant.without_tenant do
      global_views = FoundationView.where(tenant_id: source_tenant.id, is_global: true, user_id: nil)
      puts "Found #{global_views.count} global views to copy"

      other_tenants = Tenant.where.not(id: source_tenant.id)
      puts "Target tenants: #{other_tenants.pluck(:id, :name).inspect}"

      total_copied = 0
      total_skipped = 0

      other_tenants.each do |tenant|
        puts "\n--- Tenant #{tenant.id} (#{tenant.name}) ---"

        global_views.each do |view|
          existing = FoundationView.find_by(
            tenant_id: tenant.id,
            foundation_id: view.foundation_id,
            slug: view.slug
          )

          if existing
            total_skipped += 1
            next
          end

          new_view = FoundationView.new(
            tenant_id: tenant.id,
            foundation_id: view.foundation_id,
            user_id: nil,
            name: view.name,
            slug: view.slug,
            view_type: view.view_type,
            view_display_type: view.view_display_type,
            filters: view.filters,
            columns: view.columns,
            sort_order: view.sort_order,
            group_by_column: view.group_by_column,
            group_by_columns: view.group_by_columns,
            is_default: view.is_default,
            is_global: true,
            display_order: view.display_order
          )
          new_view.save!(validate: false)
          puts "  COPIED: #{view.name} (#{view.slug}) -> foundation #{view.foundation_id}"
          total_copied += 1
        end
      end

      puts "\n=== Summary ==="
      puts "Copied: #{total_copied}"
      puts "Skipped (already existed): #{total_skipped}"
    end
  end
end
