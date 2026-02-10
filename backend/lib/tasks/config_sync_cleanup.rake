# frozen_string_literal: true

namespace :config_sync do
  desc "Delete all price histories from price_only suppliers in master tenant (re-sync will restore correctly)"
  task reset_price_histories: :environment do
    puts "\n" + "=" * 60
    puts "CONFIG SYNC: RESET PRICE HISTORIES"
    puts "=" * 60

    master = Tenant.find_by(is_master_tenant: true) || Tenant.find_by(slug: "teeem")
    unless master
      puts "  No master tenant found"
      next
    end

    ActsAsTenant.with_tenant(master) do
      price_only_ids = Contact.where(entity_type: "price_only").pluck(:id)
      count = PriceHistory.where(supplier_id: price_only_ids).count
      puts "\n  Tenant: #{master.name}"
      puts "  Price histories from price_only suppliers: #{count}"

      if count > 0
        deleted = PriceHistory.where(supplier_id: price_only_ids).delete_all
        puts "  Deleted: #{deleted}"
        puts "\n  Re-run sync to restore latest-only prices."
      else
        puts "  Nothing to delete."
      end
    end

    puts "=" * 60 + "\n"
  end
end
