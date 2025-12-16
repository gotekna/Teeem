# Load ALL Australian suburbs from CSV data
# Source: https://github.com/Elkfox/Australian-Postcode-Data

require 'csv'

puts "Loading all Australian suburbs..."

# SEQ Council mappings by postcode ranges and specific suburbs
# IMPORTANT: Explicit suburb lists take priority over postcode ranges
SEQ_COUNCIL_MAPPINGS = {
  # Brisbane City Council - 4000-4179 (core Brisbane)
  # Note: Many postcodes in 4113-4179 are actually Logan/Redland - those are listed explicitly below
  "Brisbane City Council" => {
    postcode_ranges: [4000..4112, 4180..4199],
    suburbs: [
      # Explicitly Brisbane suburbs in shared postcodes
      "Eight Mile Plains", "Runcorn", "Rochedale", "Underwood", "Greenslopes", "Stones Corner",
      "Holland Park", "Holland Park East", "Holland Park West", "Tarragindi", "Wellers Hill",
      "Mansfield", "Mount Gravatt", "Mount Gravatt East", "Upper Mount Gravatt", "Wishart",
      "Algester", "Parkinson", "Calamvale", "Drewvale", "Stretton", "Berrinba", "Karawatha",
      "Sunnybank", "Sunnybank Hills", "Robertson", "Macgregor", "Coopers Plains", "Salisbury",
      "Nathan", "Moorooka", "Annerley", "Woolloongabba", "Coorparoo", "Camp Hill", "Carina",
      "Carina Heights", "Tingalpa", "Hemmant", "Lytton", "Wynnum", "Wynnum West", "Manly",
      "Manly West", "Belmont", "Gumdale", "Wakerley", "Chandler", "Burbank"
    ]
  },
  # Gold Coast City Council - 4207-4230, 4270-4275
  "Gold Coast City Council" => {
    postcode_ranges: [4207..4230, 4270..4275],
    suburbs: ["Advancetown", "Beechmont", "Binna Burra", "Canungra", "Clagiraba", "Natural Bridge", "Numinbah Valley", "Springbrook"]
  },
  # Logan City Council - explicit suburb list is authoritative for boundary areas
  "Logan City Council" => {
    postcode_ranges: [4205..4209],
    suburbs: [
      # 4114 - Logan Central area
      "Kingston", "Logan Central", "Woodridge",
      # 4115-4118 - Western Logan
      "Browns Plains", "Forestdale", "Heritage Park", "Hillcrest", "Regents Park",
      # 4119-4125 - Central/Southern Logan
      "Rochedale South", "Daisy Hill", "Priestdale", "Slacks Creek", "Springwood",
      "Shailer Park", "Tanah Merah", "Loganholme", "Carbrook", "Cornubia",
      "Loganlea", "Meadowbrook", "Crestmead", "Marsden",
      # 4124-4125 - Greenbank/Park Ridge area
      "Boronia Heights", "Greenbank", "Lyons", "New Beith", "Spring Mountain",
      "Munruben", "Park Ridge", "Park Ridge South",
      # 4127-4133 - Eastern/Southern Logan
      "Chambers Flat", "Logan Reserve", "Waterford", "Waterford West",
      # 4205-4209 - Southern Logan
      "Logan Village", "Yarrabilba", "Jimboomba", "Flagstone", "North Maclean", "South Maclean",
      "Stockleigh", "Cedar Grove", "Cedar Vale", "Veresdale", "Veresdale Scrub",
      "Kagaru", "Mundoolun", "Tamborine", "Kairabah"
    ]
  },
  # Moreton Bay Regional Council - 4500-4521, 4550-4560
  "Moreton Bay Regional Council" => {
    postcode_ranges: [4500..4521, 4550..4560],
    suburbs: ["Redcliffe", "Scarborough", "Margate", "Woody Point", "Clontarf", "Kippa-Ring", "Rothwell", "Deception Bay", "North Lakes", "Mango Hill", "Kallangur", "Dakabin", "Petrie", "Lawnton", "Strathpine", "Brendale", "Albany Creek", "Eatons Hill", "Warner", "Cashmere", "Kurwongbah", "Narangba", "Burpengary", "Morayfield", "Caboolture", "Caboolture South", "Bellmere", "Wamuran", "Elimbah", "Bribie Island", "Bongaree", "Woorim", "Banksia Beach", "Bellara", "White Patch", "Sandstone Point", "Ningi", "Godwin Beach", "Toorbul", "Donnybrook", "Meldale"]
  },
  # Redland City Council - 4157-4165, 4183-4184
  "Redland City Council" => {
    postcode_ranges: [4157..4165, 4183..4184],
    suburbs: ["Capalaba", "Alexandra Hills", "Cleveland", "Ormiston", "Wellington Point", "Birkdale", "Thorneside", "Thornlands", "Victoria Point", "Redland Bay", "Mount Cotton", "Sheldon", "Capalaba West", "Ransome", "Karragarra Island", "Russell Island", "Macleay Island", "Lamb Island", "Coochiemudlo Island", "North Stradbroke Island", "Dunwich", "Amity Point", "Point Lookout"]
  },
  # Ipswich City Council - 4300-4306, 4340-4347
  "Ipswich City Council" => {
    postcode_ranges: [4300..4306, 4340..4347],
    suburbs: ["Ipswich", "Woodend", "Newtown", "Basin Pocket", "East Ipswich", "Silkstone", "Booval", "North Booval", "Bundamba", "Blackstone", "Dinmore", "Riverview", "Leichhardt", "One Mile", "Flinders View", "Raceview", "Eastern Heights", "Sadliers Crossing", "Tivoli", "North Ipswich", "Brassall", "Wulkuraka", "Karrabin", "Coalfalls", "Yamanto", "Churchill", "Ripley", "Deebing Heights", "Bellbird Park", "Augustine Heights", "Brookwater", "Springfield", "Springfield Lakes", "Spring Mountain", "Redbank Plains", "Collingwood Park", "Redbank", "Goodna", "Gailes", "Camira", "Springfield Central"]
  },
  # Sunshine Coast Council - 4550-4575
  "Sunshine Coast Council" => {
    postcode_ranges: [4550..4575],
    suburbs: ["Maroochydore", "Mooloolaba", "Alexandra Headland", "Buddina", "Warana", "Kawana Waters", "Bokarina", "Wurtulla", "Currimundi", "Caloundra", "Caloundra West", "Golden Beach", "Pelican Waters", "Little Mountain", "Aroona", "Battery Hill", "Dicky Beach", "Moffat Beach", "Shelly Beach", "Kings Beach", "Nambour", "Buderim", "Sippy Downs", "Mountain Creek", "Kuluin", "Kunda Park", "Forest Glen", "Mons", "Tanawha", "Pacific Paradise", "Mudjimba", "Twin Waters", "Mount Coolum", "Marcoola", "Coolum Beach", "Peregian Beach", "Peregian Springs", "Verrierdale", "Doonan", "Eudlo", "Mooloolah Valley", "Landsborough", "Beerwah", "Glasshouse Mountains", "Beerburrum", "Bribie Island North"]
  },
  # Noosa Shire Council - 4562-4573
  "Noosa Shire Council" => {
    postcode_ranges: [4562..4573],
    suburbs: ["Noosa Heads", "Noosaville", "Sunshine Beach", "Sunrise Beach", "Castaways Beach", "Peregian Beach", "Marcus Beach", "Tewantin", "Cooroibah", "Tinbeerwah", "Doonan", "Eumundi", "Cooroy", "Pomona", "Cooran", "Federal", "Kin Kin", "Boreen Point", "Cootharaba", "Lake Cootharaba", "Ringtail Creek"]
  },
  # Scenic Rim Regional Council - 4270-4285, 4306-4314
  "Scenic Rim Regional Council" => {
    postcode_ranges: [4270..4285, 4306..4314],
    suburbs: ["Beaudesert", "Tamborine", "Tamborine Mountain", "North Tamborine", "Eagle Heights", "Mount Tamborine", "Canungra", "Beechmont", "Boonah", "Rathdowney", "Kalbar", "Harrisville", "Peak Crossing", "Mutdapilly", "Warrill View", "Aratula", "Fassifern", "Fassifern Valley", "Roadvale", "Templin", "Moogerah"]
  },
  # Lockyer Valley Regional Council - 4340-4347
  "Lockyer Valley Regional Council" => {
    postcode_ranges: [4340..4347],
    suburbs: ["Gatton", "Laidley", "Forest Hill", "Plainland", "Hatton Vale", "Kensington Grove", "Lockrose", "Glenore Grove", "Regency Downs", "Crowley Vale", "Summerholm", "Withcott", "Helidon", "Helidon Spa", "Postmans Ridge", "Murphy's Creek", "Murphys Creek"]
  },
  # Somerset Regional Council - 4306-4314, 4352
  "Somerset Regional Council" => {
    postcode_ranges: [4306..4314],
    suburbs: ["Esk", "Kilcoy", "Lowood", "Fernvale", "Toogoolawah", "Somerset Dam", "Wivenhoe Pocket", "Coominya", "Linville", "Moore", "Jimna", "Villeneuve", "Hazeldean", "Harlin", "Monsildale"]
  },
  # Toowoomba Regional Council - 4350-4359, 4370-4379
  "Toowoomba Regional Council" => {
    postcode_ranges: [4350..4359, 4370..4379],
    suburbs: ["Toowoomba", "Toowoomba City", "East Toowoomba", "South Toowoomba", "North Toowoomba", "Mount Lofty", "Rangeville", "Middle Ridge", "Darling Heights", "Kearneys Spring", "Glenvale", "Harristown", "Rockville", "Newtown", "Wilsonton", "Wilsonton Heights", "Centenary Heights", "Cranley", "Westbrook", "Highfields", "Meringandan", "Crows Nest", "Pittsworth", "Oakey", "Clifton", "Allora", "Cambooya", "Greenmount", "Nobby", "Millmerran", "Cecil Plains"]
  }
}

def get_council_for_suburb(suburb_name, postcode, state)
  return nil unless state == "QLD"

  postcode_int = postcode.to_i
  suburb_lower = suburb_name.downcase

  # FIRST PASS: Check explicit suburb lists (highest priority)
  # This ensures suburbs in shared postcodes get the correct council
  SEQ_COUNCIL_MAPPINGS.each do |council_name, config|
    if config[:suburbs].any? { |s| s.downcase == suburb_lower }
      return council_name
    end
  end

  # SECOND PASS: Fall back to postcode range matching
  SEQ_COUNCIL_MAPPINGS.each do |council_name, config|
    if config[:postcode_ranges].any? { |range| range.include?(postcode_int) }
      return council_name
    end
  end

  nil
end

# Read the CSV file
csv_path = Rails.root.join('tmp', 'au_postcodes.csv')

unless File.exist?(csv_path)
  puts "ERROR: CSV file not found at #{csv_path}"
  puts "Please download from: https://raw.githubusercontent.com/Elkfox/Australian-Postcode-Data/master/au_postcodes.csv"
  exit 1
end

# Clear existing suburbs
puts "Clearing existing suburbs..."
Suburb.delete_all

# Track stats
stats = {
  total: 0,
  by_state: Hash.new(0),
  with_council: 0,
  duplicates_skipped: 0
}

# Track seen combinations to avoid duplicates
seen = Set.new

puts "Importing suburbs from CSV..."

CSV.foreach(csv_path, headers: true) do |row|
  postcode = row['postcode']&.strip
  suburb_name = row['place_name']&.strip
  state = row['state_code']&.strip

  next if postcode.blank? || suburb_name.blank? || state.blank?

  # Create unique key
  key = "#{suburb_name.downcase}|#{state}"

  if seen.include?(key)
    stats[:duplicates_skipped] += 1
    next
  end
  seen.add(key)

  # Get council if in SEQ
  council = get_council_for_suburb(suburb_name, postcode, state)

  begin
    Suburb.create!(
      name: suburb_name,
      postcode: postcode,
      state: state,
      council: council,
      position: stats[:total] + 1,
      is_active: true
    )

    stats[:total] += 1
    stats[:by_state][state] += 1
    stats[:with_council] += 1 if council.present?

    print "." if stats[:total] % 500 == 0
  rescue ActiveRecord::RecordInvalid => e
    puts "\nWarning: Skipped #{suburb_name}, #{state} - #{e.message}"
  end
end

puts "\n\nImport complete!"
puts "=" * 50
puts "Total suburbs imported: #{stats[:total]}"
puts "Duplicates skipped: #{stats[:duplicates_skipped]}"
puts "Suburbs with council: #{stats[:with_council]}"
puts "\nBy state:"
stats[:by_state].sort.each do |state, count|
  puts "  #{state}: #{count}"
end
puts "=" * 50
