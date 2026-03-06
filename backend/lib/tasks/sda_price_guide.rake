namespace :sda do
  desc "Import SDA Price Guide from NDIS xlsx spreadsheet. Usage: rails sda:import[path/to/file.xlsx]"
  task :import, [:file_path] => :environment do |_t, args|
    file_path = args[:file_path]
    abort "Usage: rails sda:import[path/to/file.xlsx]" unless file_path && File.exist?(file_path)

    importer = SdaPriceGuideImporter.new(file_path)
    importer.import!

    puts "SDA Price Guide imported successfully!"
    puts "  Financial Year: #{importer.guide.financial_year}"
    puts "  Version: #{importer.guide.version}"
    puts "  Valid: #{importer.guide.valid_from} to #{importer.guide.valid_to}"
    puts "  Benchmark rates: #{importer.guide.sda_benchmark_rates.count}"
    puts "  Location factors: #{importer.guide.sda_location_factors.count}"
    puts "  MRRC rates: #{importer.guide.sda_mrrc_rates.count}"
  end

  desc "Check if the current SDA Price Guide has expired"
  task check_expiry: :environment do
    if SdaPriceGuide.expired?
      guide = SdaPriceGuide.current_guide
      if guide
        puts "WARNING: SDA Price Guide #{guide.financial_year} v#{guide.version} expired on #{guide.valid_to}"
        puts "Download the latest from: https://www.ndis.gov.au/providers/housing-and-living-supports-and-services/specialist-disability-accommodation/sda-pricing-and-payments"
      else
        puts "WARNING: No SDA Price Guide loaded. Import one with: rails sda:import[path/to/file.xlsx]"
      end
    else
      guide = SdaPriceGuide.current_guide
      puts "SDA Price Guide #{guide.financial_year} v#{guide.version} is current (valid until #{guide.valid_to})"
    end
  end

  desc "Show current SDA Price Guide summary"
  task summary: :environment do
    guide = SdaPriceGuide.current_guide
    unless guide
      puts "No SDA Price Guide loaded."
      next
    end

    puts "=== SDA Price Guide #{guide.financial_year} v#{guide.version} ==="
    puts "Valid: #{guide.valid_from} to #{guide.valid_to}"
    puts "Expired: #{SdaPriceGuide.expired? ? 'YES' : 'No'}"
    puts ""
    puts "Benchmark Rates: #{guide.sda_benchmark_rates.count}"
    puts "Location Factors: #{guide.sda_location_factors.count}"
    puts "MRRC Rates: #{guide.sda_mrrc_rates.count}"
    puts ""
    puts "MRRC Annual (Single): $#{SdaPriceGuide.mrrc_annual(participant_type: 'single')}"
    puts "MRRC Annual (Couple): $#{SdaPriceGuide.mrrc_annual(participant_type: 'couple_each')}"
    puts ""

    # Sample rates
    puts "--- Sample New Build Rates (no sprinklers, GST claimed, no OOA) ---"
    guide.sda_benchmark_rates
      .where(dwelling_stock_type: "post_2023_new_build", fire_sprinklers: false,
             gst_credits_claimed: true, onsite_overnight_assistance: false)
      .order(:building_type, :design_category)
      .each do |rate|
        puts "  #{rate.label} | #{rate.design_category.humanize} | $#{rate.annual_base_price}/yr ($#{rate.weekly_rate}/wk)"
      end
  end
end
