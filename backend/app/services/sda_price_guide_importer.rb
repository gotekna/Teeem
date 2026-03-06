require "caxlsx"

class SdaPriceGuideImporter
  attr_reader :guide

  # Building type label → key mapping
  BUILDING_TYPE_MAP = {
    "Apartment, 1 bedroom, 1 resident" => "apartment_1br_1res",
    "Apartment, 1 bedroom, 1 SDA eligible resident" => "apartment_1br_1res",
    "Apartment, 2 bedrooms, 1 resident" => "apartment_2br_1res",
    "Apartment, 2 bedrooms, 1 SDA eligible resident" => "apartment_2br_1res",
    "Apartment, 2 bedrooms, 2 residents" => "apartment_2br_2res",
    "Apartment, 2 bedrooms, 2 SDA eligible residents" => "apartment_2br_2res",
    "Apartment, 3 bedrooms, 2 residents" => "apartment_3br_2res",
    "Apartment, 3 bedrooms, 2 SDA eligible residents" => "apartment_3br_2res",
    "Villa/Duplex/Townhouse, 1 resident" => "villa_1res",
    "Villa/Duplex/Townhouse, 1 bedroom, 1 SDA eligible resident" => "villa_1res",
    "Villa/Duplex/Townhouse, 2 residents" => "villa_2res",
    "Villa/Duplex/Townhouse, 2 bedrooms, 2 SDA eligible residents" => "villa_2res",
    "Villa/Duplex/Townhouse, 3 residents" => "villa_3res",
    "Villa/Duplex/Townhouse, 3 bedrooms, 3 SDA eligible residents" => "villa_3res",
    "House, 2 residents" => "house_2res",
    "House, 2 bedrooms, 2 SDA eligible residents" => "house_2res",
    "House, 3 residents" => "house_3res",
    "House, 3 bedrooms, 3 SDA eligible residents" => "house_3res",
    "Group Home, 4 residents" => "group_home_4res",
    "Group home, 4 bedrooms, 4 SDA eligible residents" => "group_home_4res",
    "Group Home, 5 residents" => "group_home_5res",
    "Group home, 5 bedrooms, 5 SDA eligible residents" => "group_home_5res",
  }.freeze

  # Design category column positions in Benchmark Amounts sheet
  # Columns: E(4)=IL no OOA, F(5)=IL+OOA, G(6)=FA no OOA, H(7)=FA+OOA,
  #           I(8)=R no OOA, J(9)=R+OOA, K(10)=RBR no OOA, L(11)=RBR+OOA,
  #           M(12)=HPS no OOA, N(13)=HPS+OOA
  CATEGORY_COLUMNS = [
    { col_no_ooa: 5, col_ooa: 6, category: "improved_liveability" },
    { col_no_ooa: 7, col_ooa: 8, category: "fully_accessible" },
    { col_no_ooa: 9, col_ooa: 10, category: "robust" },
    { col_no_ooa: 11, col_ooa: 12, category: "robust_breakout_room" },
    { col_no_ooa: 13, col_ooa: 14, category: "high_physical_support" },
  ].freeze

  # Location factor building type column positions
  LOCATION_BUILDING_COLS = {
    2 => "apartment_1br_1res",
    3 => "apartment_2br_1res",
    4 => "apartment_2br_2res",
    5 => "apartment_3br_2res",
    6 => "villa_1res",
    7 => "villa_2res",
    8 => "villa_3res",
    9 => "house_2res",
    10 => "house_3res",
    11 => "group_home_4res",
    12 => "group_home_5res",
  }.freeze

  def initialize(file_path)
    @file_path = file_path
    @data = read_xlsx(file_path)
  end

  def import!
    ActiveRecord::Base.transaction do
      create_guide
      import_benchmark_rates
      import_location_factors
      import_mrrc_rates
      @guide.make_current!
    end
  end

  private

  def read_xlsx(path)
    # Use TeeemXl if available, otherwise fall back to simple xlsx reader
    require "teeem_xl"
    TeeemXl::Reader.read(path)
  rescue LoadError
    # Fallback: use the xlsx npm package via a temp script
    require "json"
    result = `cd /tmp && node -e '
      const XLSX = require("xlsx");
      const wb = XLSX.readFile(#{path.to_json});
      const result = {};
      wb.SheetNames.forEach(name => {
        result[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], {header: 1, defval: null});
      });
      console.log(JSON.stringify(result));
    ' 2>/dev/null`
    JSON.parse(result)
  end

  def create_guide
    version_sheet = @data["Version"]
    version_row = version_sheet&.find { |r| r[0].is_a?(Numeric) && r[0] == version_sheet.map { |rr| rr[0] }.compact.select { |v| v.is_a?(Numeric) }.max }

    financial_year = "2025-26" # Default, extracted from title
    version = "2.0"
    valid_from = Date.new(2025, 7, 1)
    valid_to = Date.new(2026, 6, 30)

    # Try to extract from Version sheet
    if version_sheet
      version_sheet.each do |row|
        next unless row[0].is_a?(Numeric)
        version = row[0].to_s
        # Parse dates from Excel serial numbers
        if row[3].is_a?(Numeric) && row[3] > 40000
          valid_from = Date.new(1899, 12, 30) + row[3].to_i
        end
        if row[4].is_a?(Numeric) && row[4] > 40000
          valid_to = Date.new(1899, 12, 30) + row[4].to_i
        end
      end

      # Extract financial year from Calculator sheet title
      calc_sheet = @data["Calculator"]
      if calc_sheet
        calc_sheet.each do |row|
          row.each do |cell|
            if cell.is_a?(String) && cell.match?(/Price Calculator\s+(\d{4}-\d{2})/)
              financial_year = cell.match(/(\d{4}-\d{2})/)[1]
              break
            end
          end
        end
      end
    end

    @guide = SdaPriceGuide.create!(
      financial_year: financial_year,
      version: version,
      valid_from: valid_from,
      valid_to: valid_to,
      source_url: "https://www.ndis.gov.au/providers/housing-and-living-supports-and-services/specialist-disability-accommodation/sda-pricing-and-payments",
      metadata: { imported_at: Time.current.iso8601, source_file: File.basename(@file_path) }
    )
  end

  def import_benchmark_rates
    sheet = @data["Benchmark Amounts"]
    return unless sheet

    current_section = nil
    dwelling_stock = nil
    fire_sprinklers = false
    gst_claimed = true

    sheet.each do |row|
      next if row.compact.empty?

      # Detect section headers
      header_text = row.compact.find { |v| v.is_a?(String) && v.length > 20 }
      if header_text
        case header_text
        when /New Builds/i
          dwelling_stock = "post_2023_new_build"
        when /Existing Stock/i
          dwelling_stock = "existing_stock"
        when /Legacy Stock/i
          dwelling_stock = "legacy_stock"
        end

        if header_text =~ /Annual Base Price/i
          fire_sprinklers = header_text.include?("WITH SPRINKLERS")
          gst_claimed = !header_text.include?("WERE NOT CLAIMED")

          # Detect stock type from header
          if header_text =~ /NEW BUILDS/i
            dwelling_stock = "post_2023_new_build"
          end
          current_section = :rates
          next
        end
      end

      next unless current_section == :rates

      # Skip header rows
      building_label = row[2]
      next unless building_label.is_a?(String)
      building_key = BUILDING_TYPE_MAP[building_label]
      next unless building_key

      residents = row[3].is_a?(Numeric) ? row[3].to_i : SdaPriceGuide::BUILDING_TYPES.dig(building_key, :max_residents)

      CATEGORY_COLUMNS.each do |cat_config|
        # Without OOA
        val_no_ooa = row[cat_config[:col_no_ooa]]
        if val_no_ooa.is_a?(Numeric) && val_no_ooa > 0
          @guide.sda_benchmark_rates.create!(
            dwelling_stock_type: dwelling_stock,
            building_type: building_key,
            max_residents: residents,
            design_category: cat_config[:category],
            fire_sprinklers: fire_sprinklers,
            gst_credits_claimed: gst_claimed,
            onsite_overnight_assistance: false,
            annual_base_price: val_no_ooa.to_i
          )
        end

        # With OOA
        val_ooa = row[cat_config[:col_ooa]]
        if val_ooa.is_a?(Numeric) && val_ooa > 0
          @guide.sda_benchmark_rates.create!(
            dwelling_stock_type: dwelling_stock,
            building_type: building_key,
            max_residents: residents,
            design_category: cat_config[:category],
            fire_sprinklers: fire_sprinklers,
            gst_credits_claimed: gst_claimed,
            onsite_overnight_assistance: true,
            annual_base_price: val_ooa.to_i
          )
        end
      end
    end

    Rails.logger.info "Imported #{@guide.sda_benchmark_rates.count} benchmark rates"
  end

  def import_location_factors
    import_location_sheet("Location Factors - New Builds", "new_build")
    import_location_sheet("Location Factors - Other", "existing_legacy")
  end

  def import_location_sheet(sheet_name, stock_type)
    sheet = @data[sheet_name]
    return unless sheet

    sheet.each do |row|
      sa4_region = row[1]
      next unless sa4_region.is_a?(String)
      next if sa4_region == "Median capital city" # Skip header row

      LOCATION_BUILDING_COLS.each do |col_idx, building_key|
        factor = row[col_idx]
        next unless factor.is_a?(Numeric) && factor > 0

        @guide.sda_location_factors.create!(
          sa4_region: sa4_region,
          stock_type: stock_type,
          building_type: building_key,
          factor: factor
        )
      end
    end

    Rails.logger.info "Imported #{@guide.sda_location_factors.where(stock_type: stock_type).count} #{stock_type} location factors"
  end

  def import_mrrc_rates
    sheet = @data["MRRC"]
    return unless sheet

    # MRRC section - rows 4-11
    # Row 6: DSP, Row 7: Pension Supplement, Row 8: CRA, Row 9: Energy Supplement
    # Row 10: total fortnightly, Row 11: total annual
    # Columns: C(2)=label, D(3)=Max Single, E(4)=Max Couple, F(5)=MRRC Single, G(6)=MRRC Couple

    mrrc_data = extract_payment_block(sheet, "Maximum Reasonable Rent Contribution")
    if mrrc_data
      create_mrrc_record("single", "mrrc", mrrc_data, 5)
      create_mrrc_record("couple_each", "mrrc", mrrc_data, 6)
    end

    board_data = extract_payment_block(sheet, "Maximum Board Contribution")
    if board_data
      create_mrrc_record("single", "maximum_board", board_data, 5)
      create_mrrc_record("couple_each", "maximum_board", board_data, 6)
    end

    # Pension totals section
    pension_section = nil
    sheet.each_with_index do |row, i|
      if row[2].is_a?(String) && row[2].include?("Pension rates per fortnight")
        pension_section = i
        break
      end
    end

    if pension_section
      total_row = sheet[pension_section + 4] # "TOTAL per fortnight" row
      annual_row = sheet[pension_section + 6] # "TOTAL per year" row
      if total_row && annual_row
        @guide.sda_mrrc_rates.create!(
          participant_type: "couple_combined",
          payment_type: "mrrc",
          total_fortnightly: total_row[5]&.to_d,
          total_annual: annual_row[5]&.to_d
        )
      end
    end

    Rails.logger.info "Imported #{@guide.sda_mrrc_rates.count} MRRC rates"
  end

  def extract_payment_block(sheet, header_text)
    start_idx = nil
    sheet.each_with_index do |row, i|
      if row[2].is_a?(String) && row[2].include?(header_text)
        start_idx = i
        break
      end
    end
    return nil unless start_idx

    # Collect component rows (DSP, PS, CRA, Energy) and totals
    {
      dsp: sheet[start_idx + 2],
      pension_supplement: sheet[start_idx + 3],
      cra: sheet[start_idx + 4],
      energy: sheet[start_idx + 5],
      total_fortnightly: sheet[start_idx + 6],
      total_annual: sheet[start_idx + 7],
    }
  end

  def create_mrrc_record(participant_type, payment_type, data, col)
    @guide.sda_mrrc_rates.create!(
      participant_type: participant_type,
      payment_type: payment_type,
      dsp_rate: data[:dsp]&.[](col)&.to_d,
      pension_supplement: data[:pension_supplement]&.[](col)&.to_d,
      cra_rate: data[:cra]&.[](col)&.to_d,
      energy_supplement: data[:energy]&.[](col)&.to_d,
      total_fortnightly: data[:total_fortnightly]&.[](col)&.to_d,
      total_annual: data[:total_annual]&.[](col)&.to_d,
    )
  end
end
