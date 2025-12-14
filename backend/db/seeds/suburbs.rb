# Suburb seed data for Australia
# Focuses on QLD with SEQ councils, plus major suburbs in other states

# SEQ Council mappings by postcode ranges
SEQ_COUNCILS = {
  "Brisbane City Council" => [
    (4000..4012), (4013..4020), (4021..4030), (4031..4036), (4037..4059), (4060..4079),
    (4100..4125), (4151..4156), (4169..4179)
  ],
  "Gold Coast City Council" => [
    (4207..4230), (9726..9726)
  ],
  "Logan City Council" => [
    (4114..4118), (4119..4133), (4205..4209)
  ],
  "Moreton Bay Regional Council" => [
    (4500..4512), (4514..4521)
  ],
  "Redland City Council" => [
    (4157..4165), (4183..4184)
  ],
  "Ipswich City Council" => [
    (4300..4306), (4340..4347)
  ],
  "Sunshine Coast Council" => [
    (4550..4561), (4568..4575)
  ],
  "Noosa Shire Council" => [
    (4562..4567)
  ],
  "Scenic Rim Regional Council" => [
    (4270..4287)
  ],
  "Lockyer Valley Regional Council" => [
    (4340..4347)
  ],
  "Somerset Regional Council" => [
    (4304..4306), (4310..4313)
  ],
  "Toowoomba Regional Council" => [
    (4350..4359), (4370..4377)
  ]
}

def get_seq_council(postcode)
  pc = postcode.to_i
  SEQ_COUNCILS.each do |council, ranges|
    ranges.each do |range|
      return council if range.include?(pc)
    end
  end
  nil
end

# Queensland suburbs (comprehensive list for SEQ, major suburbs elsewhere)
QLD_SUBURBS = [
  # Brisbane CBD and Inner
  { name: "Brisbane City", postcode: "4000" },
  { name: "Spring Hill", postcode: "4000" },
  { name: "Petrie Terrace", postcode: "4000" },
  { name: "South Brisbane", postcode: "4101" },
  { name: "West End", postcode: "4101" },
  { name: "Highgate Hill", postcode: "4101" },
  { name: "Woolloongabba", postcode: "4102" },
  { name: "Kangaroo Point", postcode: "4169" },
  { name: "East Brisbane", postcode: "4169" },
  { name: "Fortitude Valley", postcode: "4006" },
  { name: "New Farm", postcode: "4005" },
  { name: "Newstead", postcode: "4006" },
  { name: "Teneriffe", postcode: "4005" },
  { name: "Bowen Hills", postcode: "4006" },
  { name: "Herston", postcode: "4006" },
  { name: "Kelvin Grove", postcode: "4059" },
  { name: "Red Hill", postcode: "4059" },
  { name: "Paddington", postcode: "4064" },
  { name: "Milton", postcode: "4064" },
  { name: "Auchenflower", postcode: "4066" },
  { name: "Toowong", postcode: "4066" },
  { name: "Taringa", postcode: "4068" },
  { name: "St Lucia", postcode: "4067" },
  { name: "Indooroopilly", postcode: "4068" },
  { name: "Chapel Hill", postcode: "4069" },
  { name: "Kenmore", postcode: "4069" },
  { name: "Kenmore Hills", postcode: "4069" },
  { name: "Fig Tree Pocket", postcode: "4069" },
  { name: "Brookfield", postcode: "4069" },
  { name: "Pullenvale", postcode: "4069" },

  # Brisbane North
  { name: "Windsor", postcode: "4030" },
  { name: "Wilston", postcode: "4051" },
  { name: "Newmarket", postcode: "4051" },
  { name: "Grange", postcode: "4051" },
  { name: "Ashgrove", postcode: "4060" },
  { name: "Alderley", postcode: "4051" },
  { name: "Enoggera", postcode: "4051" },
  { name: "Mitchelton", postcode: "4053" },
  { name: "Gaythorne", postcode: "4051" },
  { name: "Everton Park", postcode: "4053" },
  { name: "Stafford", postcode: "4053" },
  { name: "Stafford Heights", postcode: "4053" },
  { name: "Gordon Park", postcode: "4031" },
  { name: "Lutwyche", postcode: "4030" },
  { name: "Kedron", postcode: "4031" },
  { name: "Wooloowin", postcode: "4030" },
  { name: "Clayfield", postcode: "4011" },
  { name: "Hendra", postcode: "4011" },
  { name: "Hamilton", postcode: "4007" },
  { name: "Ascot", postcode: "4007" },
  { name: "Eagle Farm", postcode: "4009" },
  { name: "Pinkenba", postcode: "4008" },
  { name: "Albion", postcode: "4010" },
  { name: "Nundah", postcode: "4012" },
  { name: "Northgate", postcode: "4013" },
  { name: "Banyo", postcode: "4014" },
  { name: "Nudgee", postcode: "4014" },
  { name: "Virginia", postcode: "4014" },
  { name: "Geebung", postcode: "4034" },
  { name: "Zillmere", postcode: "4034" },
  { name: "Aspley", postcode: "4034" },
  { name: "Chermside", postcode: "4032" },
  { name: "Chermside West", postcode: "4032" },
  { name: "Wavell Heights", postcode: "4012" },
  { name: "McDowall", postcode: "4053" },
  { name: "Bridgeman Downs", postcode: "4035" },
  { name: "Carseldine", postcode: "4034" },
  { name: "Bracken Ridge", postcode: "4017" },
  { name: "Bald Hills", postcode: "4036" },
  { name: "Sandgate", postcode: "4017" },
  { name: "Brighton", postcode: "4017" },
  { name: "Shorncliffe", postcode: "4017" },
  { name: "Deagon", postcode: "4017" },
  { name: "Boondall", postcode: "4034" },
  { name: "Taigum", postcode: "4018" },
  { name: "Fitzgibbon", postcode: "4018" },

  # Brisbane South
  { name: "Annerley", postcode: "4103" },
  { name: "Fairfield", postcode: "4103" },
  { name: "Greenslopes", postcode: "4120" },
  { name: "Coorparoo", postcode: "4151" },
  { name: "Camp Hill", postcode: "4152" },
  { name: "Carina", postcode: "4152" },
  { name: "Carina Heights", postcode: "4152" },
  { name: "Carindale", postcode: "4152" },
  { name: "Stones Corner", postcode: "4120" },
  { name: "Norman Park", postcode: "4170" },
  { name: "Seven Hills", postcode: "4170" },
  { name: "Morningside", postcode: "4170" },
  { name: "Hawthorne", postcode: "4171" },
  { name: "Balmoral", postcode: "4171" },
  { name: "Bulimba", postcode: "4171" },
  { name: "Murarrie", postcode: "4172" },
  { name: "Cannon Hill", postcode: "4170" },
  { name: "Tingalpa", postcode: "4173" },
  { name: "Wynnum", postcode: "4178" },
  { name: "Wynnum West", postcode: "4178" },
  { name: "Manly", postcode: "4179" },
  { name: "Manly West", postcode: "4179" },
  { name: "Lota", postcode: "4179" },
  { name: "Gumdale", postcode: "4154" },
  { name: "Wakerley", postcode: "4154" },
  { name: "Chandler", postcode: "4155" },
  { name: "Burbank", postcode: "4156" },
  { name: "Belmont", postcode: "4153" },
  { name: "Ransome", postcode: "4154" },
  { name: "Hemmant", postcode: "4174" },
  { name: "Lytton", postcode: "4178" },
  { name: "Holland Park", postcode: "4121" },
  { name: "Holland Park West", postcode: "4121" },
  { name: "Tarragindi", postcode: "4121" },
  { name: "Mount Gravatt", postcode: "4122" },
  { name: "Mount Gravatt East", postcode: "4122" },
  { name: "Upper Mount Gravatt", postcode: "4122" },
  { name: "Wishart", postcode: "4122" },
  { name: "Mansfield", postcode: "4122" },
  { name: "Mackenzie", postcode: "4156" },
  { name: "Rochedale", postcode: "4123" },
  { name: "Rochedale South", postcode: "4123" },
  { name: "Eight Mile Plains", postcode: "4113" },
  { name: "Runcorn", postcode: "4113" },
  { name: "Kuraby", postcode: "4112" },
  { name: "Moorooka", postcode: "4105" },
  { name: "Salisbury", postcode: "4107" },
  { name: "Rocklea", postcode: "4106" },
  { name: "Archerfield", postcode: "4108" },
  { name: "Coopers Plains", postcode: "4108" },
  { name: "Yeerongpilly", postcode: "4105" },
  { name: "Yeronga", postcode: "4104" },
  { name: "Tennyson", postcode: "4105" },
  { name: "Graceville", postcode: "4075" },
  { name: "Sherwood", postcode: "4075" },
  { name: "Corinda", postcode: "4075" },
  { name: "Chelmer", postcode: "4068" },
  { name: "Oxley", postcode: "4075" },
  { name: "Darra", postcode: "4076" },
  { name: "Wacol", postcode: "4076" },
  { name: "Sumner", postcode: "4074" },
  { name: "Middle Park", postcode: "4074" },
  { name: "Riverhills", postcode: "4074" },
  { name: "Westlake", postcode: "4074" },
  { name: "Jindalee", postcode: "4074" },
  { name: "Sinnamon Park", postcode: "4073" },
  { name: "Seventeen Mile Rocks", postcode: "4073" },
  { name: "Jamboree Heights", postcode: "4074" },
  { name: "Mount Ommaney", postcode: "4074" },
  { name: "Ellen Grove", postcode: "4078" },
  { name: "Forest Lake", postcode: "4078" },
  { name: "Richlands", postcode: "4077" },
  { name: "Inala", postcode: "4077" },
  { name: "Durack", postcode: "4077" },
  { name: "Acacia Ridge", postcode: "4110" },
  { name: "Pallara", postcode: "4110" },
  { name: "Willawong", postcode: "4110" },
  { name: "Sunnybank", postcode: "4109" },
  { name: "Sunnybank Hills", postcode: "4109" },
  { name: "Robertson", postcode: "4109" },
  { name: "Calamvale", postcode: "4116" },
  { name: "Stretton", postcode: "4116" },
  { name: "Drewvale", postcode: "4116" },
  { name: "Algester", postcode: "4115" },
  { name: "Parkinson", postcode: "4115" },

  # Redland City
  { name: "Cleveland", postcode: "4163" },
  { name: "Ormiston", postcode: "4160" },
  { name: "Wellington Point", postcode: "4160" },
  { name: "Birkdale", postcode: "4159" },
  { name: "Alexandra Hills", postcode: "4161" },
  { name: "Thornlands", postcode: "4164" },
  { name: "Victoria Point", postcode: "4165" },
  { name: "Redland Bay", postcode: "4165" },
  { name: "Mount Cotton", postcode: "4165" },
  { name: "Capalaba", postcode: "4157" },
  { name: "Thorneside", postcode: "4158" },
  { name: "North Stradbroke Island", postcode: "4183" },
  { name: "Russell Island", postcode: "4184" },

  # Logan City
  { name: "Logan Central", postcode: "4114" },
  { name: "Woodridge", postcode: "4114" },
  { name: "Kingston", postcode: "4114" },
  { name: "Slacks Creek", postcode: "4127" },
  { name: "Daisy Hill", postcode: "4127" },
  { name: "Springwood", postcode: "4127" },
  { name: "Shailer Park", postcode: "4128" },
  { name: "Cornubia", postcode: "4130" },
  { name: "Loganholme", postcode: "4129" },
  { name: "Tanah Merah", postcode: "4128" },
  { name: "Underwood", postcode: "4119" },
  { name: "Priestdale", postcode: "4127" },
  { name: "Logan Reserve", postcode: "4133" },
  { name: "Park Ridge", postcode: "4125" },
  { name: "Chambers Flat", postcode: "4133" },
  { name: "Greenbank", postcode: "4124" },
  { name: "Browns Plains", postcode: "4118" },
  { name: "Regents Park", postcode: "4118" },
  { name: "Heritage Park", postcode: "4118" },
  { name: "Hillcrest", postcode: "4118" },
  { name: "Boronia Heights", postcode: "4124" },
  { name: "Crestmead", postcode: "4132" },
  { name: "Marsden", postcode: "4132" },
  { name: "Waterford West", postcode: "4133" },
  { name: "Beenleigh", postcode: "4207" },
  { name: "Eagleby", postcode: "4207" },
  { name: "Bethania", postcode: "4205" },
  { name: "Edens Landing", postcode: "4207" },
  { name: "Holmview", postcode: "4207" },
  { name: "Windaroo", postcode: "4207" },
  { name: "Bannockburn", postcode: "4207" },
  { name: "Waterford", postcode: "4133" },
  { name: "Buccan", postcode: "4207" },

  # Gold Coast
  { name: "Surfers Paradise", postcode: "4217" },
  { name: "Broadbeach", postcode: "4218" },
  { name: "Broadbeach Waters", postcode: "4218" },
  { name: "Mermaid Beach", postcode: "4218" },
  { name: "Mermaid Waters", postcode: "4218" },
  { name: "Miami", postcode: "4220" },
  { name: "Burleigh Heads", postcode: "4220" },
  { name: "Burleigh Waters", postcode: "4220" },
  { name: "Palm Beach", postcode: "4221" },
  { name: "Currumbin", postcode: "4223" },
  { name: "Currumbin Waters", postcode: "4223" },
  { name: "Tugun", postcode: "4224" },
  { name: "Bilinga", postcode: "4225" },
  { name: "Coolangatta", postcode: "4225" },
  { name: "Southport", postcode: "4215" },
  { name: "Labrador", postcode: "4215" },
  { name: "Biggera Waters", postcode: "4216" },
  { name: "Runaway Bay", postcode: "4216" },
  { name: "Paradise Point", postcode: "4216" },
  { name: "Hollywell", postcode: "4216" },
  { name: "Coombabah", postcode: "4216" },
  { name: "Arundel", postcode: "4214" },
  { name: "Parkwood", postcode: "4214" },
  { name: "Molendinar", postcode: "4214" },
  { name: "Ashmore", postcode: "4214" },
  { name: "Benowa", postcode: "4217" },
  { name: "Bundall", postcode: "4217" },
  { name: "Isle of Capri", postcode: "4217" },
  { name: "Main Beach", postcode: "4217" },
  { name: "Clear Island Waters", postcode: "4226" },
  { name: "Robina", postcode: "4226" },
  { name: "Varsity Lakes", postcode: "4227" },
  { name: "Mudgeeraba", postcode: "4213" },
  { name: "Reedy Creek", postcode: "4227" },
  { name: "Merrimac", postcode: "4226" },
  { name: "Carrara", postcode: "4211" },
  { name: "Nerang", postcode: "4211" },
  { name: "Highland Park", postcode: "4211" },
  { name: "Pacific Pines", postcode: "4211" },
  { name: "Gaven", postcode: "4211" },
  { name: "Helensvale", postcode: "4212" },
  { name: "Hope Island", postcode: "4212" },
  { name: "Oxenford", postcode: "4210" },
  { name: "Upper Coomera", postcode: "4209" },
  { name: "Coomera", postcode: "4209" },
  { name: "Pimpama", postcode: "4209" },
  { name: "Ormeau", postcode: "4208" },
  { name: "Ormeau Hills", postcode: "4208" },
  { name: "Jacobs Well", postcode: "4208" },
  { name: "Worongary", postcode: "4213" },
  { name: "Elanora", postcode: "4221" },
  { name: "Tallebudgera", postcode: "4228" },
  { name: "Tallebudgera Valley", postcode: "4228" },
  { name: "Springbrook", postcode: "4213" },

  # Moreton Bay
  { name: "Caboolture", postcode: "4510" },
  { name: "Caboolture South", postcode: "4510" },
  { name: "Morayfield", postcode: "4506" },
  { name: "Burpengary", postcode: "4505" },
  { name: "Burpengary East", postcode: "4505" },
  { name: "Narangba", postcode: "4504" },
  { name: "North Lakes", postcode: "4509" },
  { name: "Mango Hill", postcode: "4509" },
  { name: "Griffin", postcode: "4503" },
  { name: "Kallangur", postcode: "4503" },
  { name: "Dakabin", postcode: "4503" },
  { name: "Petrie", postcode: "4502" },
  { name: "Lawnton", postcode: "4501" },
  { name: "Strathpine", postcode: "4500" },
  { name: "Bray Park", postcode: "4500" },
  { name: "Warner", postcode: "4500" },
  { name: "Cashmere", postcode: "4500" },
  { name: "Brendale", postcode: "4500" },
  { name: "Albany Creek", postcode: "4035" },
  { name: "Eatons Hill", postcode: "4037" },
  { name: "Ferny Hills", postcode: "4055" },
  { name: "Arana Hills", postcode: "4054" },
  { name: "Everton Hills", postcode: "4053" },
  { name: "Keperra", postcode: "4054" },
  { name: "The Gap", postcode: "4061" },
  { name: "Upper Kedron", postcode: "4055" },
  { name: "Samford Valley", postcode: "4520" },
  { name: "Samford Village", postcode: "4520" },
  { name: "Camp Mountain", postcode: "4520" },
  { name: "Closeburn", postcode: "4520" },
  { name: "Draper", postcode: "4520" },
  { name: "Highvale", postcode: "4520" },
  { name: "Dayboro", postcode: "4521" },
  { name: "Clear Mountain", postcode: "4500" },
  { name: "Joyner", postcode: "4500" },
  { name: "Redcliffe", postcode: "4020" },
  { name: "Scarborough", postcode: "4020" },
  { name: "Margate", postcode: "4019" },
  { name: "Woody Point", postcode: "4019" },
  { name: "Clontarf", postcode: "4019" },
  { name: "Kippa-Ring", postcode: "4021" },
  { name: "Rothwell", postcode: "4022" },
  { name: "Deception Bay", postcode: "4508" },
  { name: "Murrumba Downs", postcode: "4503" },
  { name: "Kurwongbah", postcode: "4503" },
  { name: "Bribie Island", postcode: "4507" },
  { name: "Woorim", postcode: "4507" },
  { name: "Bellara", postcode: "4507" },
  { name: "Bongaree", postcode: "4507" },
  { name: "Banksia Beach", postcode: "4507" },
  { name: "Ningi", postcode: "4511" },
  { name: "Beachmere", postcode: "4510" },
  { name: "Bellmere", postcode: "4510" },
  { name: "Elimbah", postcode: "4516" },
  { name: "Wamuran", postcode: "4512" },
  { name: "D'Aguilar", postcode: "4514" },
  { name: "Woodford", postcode: "4514" },

  # Ipswich
  { name: "Ipswich", postcode: "4305" },
  { name: "Brassall", postcode: "4305" },
  { name: "North Booval", postcode: "4304" },
  { name: "Booval", postcode: "4304" },
  { name: "Bundamba", postcode: "4304" },
  { name: "Silkstone", postcode: "4304" },
  { name: "Blackstone", postcode: "4304" },
  { name: "Coalfalls", postcode: "4305" },
  { name: "Basin Pocket", postcode: "4305" },
  { name: "Newtown", postcode: "4305" },
  { name: "Sadliers Crossing", postcode: "4305" },
  { name: "East Ipswich", postcode: "4305" },
  { name: "One Mile", postcode: "4305" },
  { name: "Leichhardt", postcode: "4305" },
  { name: "Woodend", postcode: "4305" },
  { name: "Raceview", postcode: "4305" },
  { name: "Flinders View", postcode: "4305" },
  { name: "Yamanto", postcode: "4305" },
  { name: "Camira", postcode: "4300" },
  { name: "Springfield", postcode: "4300" },
  { name: "Springfield Lakes", postcode: "4300" },
  { name: "Springfield Central", postcode: "4300" },
  { name: "Augustine Heights", postcode: "4300" },
  { name: "Brookwater", postcode: "4300" },
  { name: "Redbank Plains", postcode: "4301" },
  { name: "Redbank", postcode: "4301" },
  { name: "Collingwood Park", postcode: "4301" },
  { name: "Bellbird Park", postcode: "4300" },
  { name: "Goodna", postcode: "4300" },
  { name: "Gailes", postcode: "4300" },
  { name: "Carole Park", postcode: "4300" },
  { name: "Riverview", postcode: "4303" },
  { name: "Dinmore", postcode: "4303" },
  { name: "Ebbw Vale", postcode: "4304" },
  { name: "Ripley", postcode: "4306" },
  { name: "South Ripley", postcode: "4306" },
  { name: "Deebing Heights", postcode: "4306" },
  { name: "Rosewood", postcode: "4340" },
  { name: "Walloon", postcode: "4306" },
  { name: "Karrabin", postcode: "4306" },
  { name: "Karalee", postcode: "4306" },
  { name: "Pine Mountain", postcode: "4306" },
  { name: "Chuwar", postcode: "4306" },
  { name: "Muirlea", postcode: "4306" },
  { name: "Mount Crosby", postcode: "4306" },
  { name: "Karana Downs", postcode: "4306" },
  { name: "Lake Manchester", postcode: "4306" },

  # Sunshine Coast
  { name: "Caloundra", postcode: "4551" },
  { name: "Kings Beach", postcode: "4551" },
  { name: "Moffat Beach", postcode: "4551" },
  { name: "Dicky Beach", postcode: "4551" },
  { name: "Shelly Beach", postcode: "4551" },
  { name: "Currimundi", postcode: "4551" },
  { name: "Aroona", postcode: "4551" },
  { name: "Battery Hill", postcode: "4551" },
  { name: "Golden Beach", postcode: "4551" },
  { name: "Pelican Waters", postcode: "4551" },
  { name: "Little Mountain", postcode: "4551" },
  { name: "Caloundra West", postcode: "4551" },
  { name: "Meridan Plains", postcode: "4551" },
  { name: "Bells Creek", postcode: "4551" },
  { name: "Aura", postcode: "4551" },
  { name: "Baringa", postcode: "4551" },
  { name: "Nirimba", postcode: "4551" },
  { name: "Kawana Waters", postcode: "4575" },
  { name: "Bokarina", postcode: "4575" },
  { name: "Wurtulla", postcode: "4575" },
  { name: "Buddina", postcode: "4575" },
  { name: "Minyama", postcode: "4575" },
  { name: "Parrearra", postcode: "4575" },
  { name: "Warana", postcode: "4575" },
  { name: "Birtinya", postcode: "4575" },
  { name: "Palmview", postcode: "4553" },
  { name: "Sippy Downs", postcode: "4556" },
  { name: "Chancellor Park", postcode: "4556" },
  { name: "Buderim", postcode: "4556" },
  { name: "Mountain Creek", postcode: "4557" },
  { name: "Mooloolaba", postcode: "4557" },
  { name: "Alexandra Headland", postcode: "4572" },
  { name: "Maroochydore", postcode: "4558" },
  { name: "Cotton Tree", postcode: "4558" },
  { name: "Kuluin", postcode: "4558" },
  { name: "Kunda Park", postcode: "4556" },
  { name: "Forest Glen", postcode: "4556" },
  { name: "Tanawha", postcode: "4556" },
  { name: "Mons", postcode: "4556" },
  { name: "Kiels Mountain", postcode: "4559" },
  { name: "Bli Bli", postcode: "4560" },
  { name: "Diddillibah", postcode: "4559" },
  { name: "Marcoola", postcode: "4564" },
  { name: "Mudjimba", postcode: "4564" },
  { name: "Pacific Paradise", postcode: "4564" },
  { name: "Twin Waters", postcode: "4564" },
  { name: "Mount Coolum", postcode: "4573" },
  { name: "Coolum Beach", postcode: "4573" },
  { name: "Point Arkwright", postcode: "4573" },
  { name: "Yaroomba", postcode: "4573" },
  { name: "Peregian Springs", postcode: "4573" },
  { name: "Peregian Beach", postcode: "4573" },
  { name: "Marcus Beach", postcode: "4573" },
  { name: "Castaways Beach", postcode: "4567" },
  { name: "Sunrise Beach", postcode: "4567" },
  { name: "Sunshine Beach", postcode: "4567" },
  { name: "Nambour", postcode: "4560" },
  { name: "Burnside", postcode: "4560" },
  { name: "Image Flat", postcode: "4560" },
  { name: "Woombye", postcode: "4559" },
  { name: "Palmwoods", postcode: "4555" },
  { name: "Eudlo", postcode: "4554" },
  { name: "Mooloolah Valley", postcode: "4553" },
  { name: "Landsborough", postcode: "4550" },
  { name: "Beerwah", postcode: "4519" },
  { name: "Glass House Mountains", postcode: "4518" },
  { name: "Maleny", postcode: "4552" },
  { name: "Montville", postcode: "4560" },
  { name: "Mapleton", postcode: "4560" },
  { name: "Flaxton", postcode: "4560" },
  { name: "Kenilworth", postcode: "4574" },
  { name: "Yandina", postcode: "4561" },
  { name: "Eumundi", postcode: "4562" },
  { name: "Cooroy", postcode: "4563" },
  { name: "Cooroy Mountain", postcode: "4563" },
  { name: "Pomona", postcode: "4568" },
  { name: "Cooran", postcode: "4569" },
  { name: "Kin Kin", postcode: "4571" },

  # Noosa
  { name: "Noosa Heads", postcode: "4567" },
  { name: "Noosaville", postcode: "4566" },
  { name: "Noosa Junction", postcode: "4567" },
  { name: "Tewantin", postcode: "4565" },
  { name: "Doonan", postcode: "4562" },
  { name: "Tinbeerwah", postcode: "4563" },
  { name: "Cooroibah", postcode: "4565" },
  { name: "Boreen Point", postcode: "4565" },
  { name: "Lake Cootharaba", postcode: "4565" },

  # Scenic Rim
  { name: "Beaudesert", postcode: "4285" },
  { name: "Tamborine Mountain", postcode: "4272" },
  { name: "North Tamborine", postcode: "4272" },
  { name: "Mount Tamborine", postcode: "4272" },
  { name: "Eagle Heights", postcode: "4271" },
  { name: "Canungra", postcode: "4275" },
  { name: "Boonah", postcode: "4310" },
  { name: "Rathdowney", postcode: "4287" },

  # Toowoomba
  { name: "Toowoomba", postcode: "4350" },
  { name: "Toowoomba City", postcode: "4350" },
  { name: "East Toowoomba", postcode: "4350" },
  { name: "South Toowoomba", postcode: "4350" },
  { name: "North Toowoomba", postcode: "4350" },
  { name: "Newtown", postcode: "4350" },
  { name: "Mount Lofty", postcode: "4350" },
  { name: "Rangeville", postcode: "4350" },
  { name: "Middle Ridge", postcode: "4350" },
  { name: "Darling Heights", postcode: "4350" },
  { name: "Harristown", postcode: "4350" },
  { name: "Kearneys Spring", postcode: "4350" },
  { name: "Glenvale", postcode: "4350" },
  { name: "Wilsonton", postcode: "4350" },
  { name: "Wilsonton Heights", postcode: "4350" },
  { name: "Centenary Heights", postcode: "4350" },
  { name: "Rockville", postcode: "4350" },
  { name: "Cranley", postcode: "4350" },
  { name: "Highfields", postcode: "4352" },
  { name: "Meringandan", postcode: "4352" },
  { name: "Crows Nest", postcode: "4355" },
  { name: "Oakey", postcode: "4401" },
  { name: "Pittsworth", postcode: "4356" },
  { name: "Millmerran", postcode: "4357" },
  { name: "Gatton", postcode: "4343" },
  { name: "Laidley", postcode: "4341" },
  { name: "Plainland", postcode: "4341" },
  { name: "Lockyer Waters", postcode: "4311" },

  # Regional QLD major towns
  { name: "Cairns", postcode: "4870" },
  { name: "Cairns City", postcode: "4870" },
  { name: "Cairns North", postcode: "4870" },
  { name: "Edge Hill", postcode: "4870" },
  { name: "Whitfield", postcode: "4870" },
  { name: "Earlville", postcode: "4870" },
  { name: "Westcourt", postcode: "4870" },
  { name: "Manoora", postcode: "4870" },
  { name: "Parramatta Park", postcode: "4870" },
  { name: "Bungalow", postcode: "4870" },
  { name: "Portsmith", postcode: "4870" },
  { name: "Townsville", postcode: "4810" },
  { name: "Townsville City", postcode: "4810" },
  { name: "South Townsville", postcode: "4810" },
  { name: "North Ward", postcode: "4810" },
  { name: "Belgian Gardens", postcode: "4810" },
  { name: "Rockhampton", postcode: "4700" },
  { name: "Rockhampton City", postcode: "4700" },
  { name: "The Range", postcode: "4700" },
  { name: "Wandal", postcode: "4700" },
  { name: "Mackay", postcode: "4740" },
  { name: "Mackay City", postcode: "4740" },
  { name: "South Mackay", postcode: "4740" },
  { name: "North Mackay", postcode: "4740" },
  { name: "Gladstone", postcode: "4680" },
  { name: "Gladstone Central", postcode: "4680" },
  { name: "Bundaberg", postcode: "4670" },
  { name: "Bundaberg Central", postcode: "4670" },
  { name: "Bundaberg East", postcode: "4670" },
  { name: "Bundaberg North", postcode: "4670" },
  { name: "Hervey Bay", postcode: "4655" },
  { name: "Pialba", postcode: "4655" },
  { name: "Scarness", postcode: "4655" },
  { name: "Torquay", postcode: "4655" },
  { name: "Urangan", postcode: "4655" },
  { name: "Maryborough", postcode: "4650" }
].freeze

# NSW major suburbs
NSW_SUBURBS = [
  { name: "Sydney", postcode: "2000" },
  { name: "The Rocks", postcode: "2000" },
  { name: "Darling Harbour", postcode: "2000" },
  { name: "Haymarket", postcode: "2000" },
  { name: "Surry Hills", postcode: "2010" },
  { name: "Darlinghurst", postcode: "2010" },
  { name: "Paddington", postcode: "2021" },
  { name: "Bondi", postcode: "2026" },
  { name: "Bondi Beach", postcode: "2026" },
  { name: "Bondi Junction", postcode: "2022" },
  { name: "Newtown", postcode: "2042" },
  { name: "Marrickville", postcode: "2204" },
  { name: "Parramatta", postcode: "2150" },
  { name: "Liverpool", postcode: "2170" },
  { name: "Penrith", postcode: "2750" },
  { name: "Campbelltown", postcode: "2560" },
  { name: "Blacktown", postcode: "2148" },
  { name: "Chatswood", postcode: "2067" },
  { name: "North Sydney", postcode: "2060" },
  { name: "Manly", postcode: "2095" },
  { name: "Newcastle", postcode: "2300" },
  { name: "Wollongong", postcode: "2500" },
  { name: "Central Coast", postcode: "2250" },
  { name: "Gosford", postcode: "2250" },
  { name: "Tweed Heads", postcode: "2485" },
  { name: "Byron Bay", postcode: "2481" },
  { name: "Ballina", postcode: "2478" },
  { name: "Lismore", postcode: "2480" },
  { name: "Coffs Harbour", postcode: "2450" },
  { name: "Port Macquarie", postcode: "2444" }
].freeze

# VIC major suburbs
VIC_SUBURBS = [
  { name: "Melbourne", postcode: "3000" },
  { name: "Southbank", postcode: "3006" },
  { name: "Docklands", postcode: "3008" },
  { name: "South Melbourne", postcode: "3205" },
  { name: "St Kilda", postcode: "3182" },
  { name: "Brighton", postcode: "3186" },
  { name: "Richmond", postcode: "3121" },
  { name: "Fitzroy", postcode: "3065" },
  { name: "Carlton", postcode: "3053" },
  { name: "Brunswick", postcode: "3056" },
  { name: "Footscray", postcode: "3011" },
  { name: "Geelong", postcode: "3220" },
  { name: "Ballarat", postcode: "3350" },
  { name: "Bendigo", postcode: "3550" }
].freeze

# SA major suburbs
SA_SUBURBS = [
  { name: "Adelaide", postcode: "5000" },
  { name: "North Adelaide", postcode: "5006" },
  { name: "Glenelg", postcode: "5045" },
  { name: "Norwood", postcode: "5067" },
  { name: "Prospect", postcode: "5082" }
].freeze

# WA major suburbs
WA_SUBURBS = [
  { name: "Perth", postcode: "6000" },
  { name: "Fremantle", postcode: "6160" },
  { name: "Subiaco", postcode: "6008" },
  { name: "Scarborough", postcode: "6019" },
  { name: "Joondalup", postcode: "6027" }
].freeze

# TAS major suburbs
TAS_SUBURBS = [
  { name: "Hobart", postcode: "7000" },
  { name: "Sandy Bay", postcode: "7005" },
  { name: "Launceston", postcode: "7250" }
].freeze

# NT major suburbs
NT_SUBURBS = [
  { name: "Darwin", postcode: "0800" },
  { name: "Darwin City", postcode: "0800" },
  { name: "Alice Springs", postcode: "0870" }
].freeze

# ACT suburbs
ACT_SUBURBS = [
  { name: "Canberra", postcode: "2600" },
  { name: "Civic", postcode: "2601" },
  { name: "Braddon", postcode: "2612" },
  { name: "Kingston", postcode: "2604" },
  { name: "Manuka", postcode: "2603" }
].freeze

puts "Seeding suburbs..."

# Seed QLD suburbs with councils
QLD_SUBURBS.each do |suburb_data|
  council = get_seq_council(suburb_data[:postcode])
  Suburb.find_or_create_by(name: suburb_data[:name], state: "QLD") do |s|
    s.postcode = suburb_data[:postcode]
    s.council = council
  end
end
puts "  - QLD: #{QLD_SUBURBS.count} suburbs"

# Seed NSW suburbs
NSW_SUBURBS.each do |suburb_data|
  Suburb.find_or_create_by(name: suburb_data[:name], state: "NSW") do |s|
    s.postcode = suburb_data[:postcode]
  end
end
puts "  - NSW: #{NSW_SUBURBS.count} suburbs"

# Seed VIC suburbs
VIC_SUBURBS.each do |suburb_data|
  Suburb.find_or_create_by(name: suburb_data[:name], state: "VIC") do |s|
    s.postcode = suburb_data[:postcode]
  end
end
puts "  - VIC: #{VIC_SUBURBS.count} suburbs"

# Seed SA suburbs
SA_SUBURBS.each do |suburb_data|
  Suburb.find_or_create_by(name: suburb_data[:name], state: "SA") do |s|
    s.postcode = suburb_data[:postcode]
  end
end
puts "  - SA: #{SA_SUBURBS.count} suburbs"

# Seed WA suburbs
WA_SUBURBS.each do |suburb_data|
  Suburb.find_or_create_by(name: suburb_data[:name], state: "WA") do |s|
    s.postcode = suburb_data[:postcode]
  end
end
puts "  - WA: #{WA_SUBURBS.count} suburbs"

# Seed TAS suburbs
TAS_SUBURBS.each do |suburb_data|
  Suburb.find_or_create_by(name: suburb_data[:name], state: "TAS") do |s|
    s.postcode = suburb_data[:postcode]
  end
end
puts "  - TAS: #{TAS_SUBURBS.count} suburbs"

# Seed NT suburbs
NT_SUBURBS.each do |suburb_data|
  Suburb.find_or_create_by(name: suburb_data[:name], state: "NT") do |s|
    s.postcode = suburb_data[:postcode]
  end
end
puts "  - NT: #{NT_SUBURBS.count} suburbs"

# Seed ACT suburbs
ACT_SUBURBS.each do |suburb_data|
  Suburb.find_or_create_by(name: suburb_data[:name], state: "ACT") do |s|
    s.postcode = suburb_data[:postcode]
  end
end
puts "  - ACT: #{ACT_SUBURBS.count} suburbs"

total = Suburb.count
with_council = Suburb.where.not(council: nil).count
puts "\nSuburb seeding complete!"
puts "Total suburbs: #{total}"
puts "Suburbs with council: #{with_council}"
