#!/usr/bin/env ruby
require 'net/http'
require 'json'
require 'uri'

# Configuration
API_BASE_URL = ENV['API_URL'] || 'https://trapid-backend-da49e8f48d24.herokuapp.com'
API_ENDPOINT = "#{API_BASE_URL}/api/v1/unreal_variables"

variables = [
  "# of Units", "#1020ExternalDoors", "#1525Bath", "#1675Bath", "#1750Bath",
  "#225WPsSale", "#2WPsSale", "#2waySwitch", "#300WPsSale", "#3in1",
  "#450GrabRails", "#4WPsSale", "#600GrabRails", "#60CanopyRange", "#60ElecCooktop",
  "#60FreestandingOven", "#60GasCooktop", "#60Oven", "#60SlideRange", "#60UndermountRange",
  "#720 doors", "#820 doors", "#820ExternalDoors", "#900GrabRails", "#90CanopyRange",
  "#90ElecCooktop", "#90FreestandingOven", "#90GasCooktop", "#90Oven", "#90SlideRange",
  "#90UndermountRange", "#920ExternalDoors", "#AC25", "#AC35", "#AC5", "#AC6",
  "#AC71", "#ACSPLITS", "#AdjustableBench", "#Basin_Mixer", "#Bath", "#BlackPlastic",
  "#BlindAutomation", "#Ceiling Fan", "#Cooktops", "#Cornerbar Sales", "#DGPOUSB",
  "#DataPoints", "#Dbar Sales", "#DisabledBasins", "#DisabledShower", "#DisabledToilets",
  "#Dishwashers", "#DoorOpenerEXT", "#DoorOpenerINT", "#Double GPO", "#Double WGPO",
  "#DoubleSpotlights", "#DoubleSpotlights+Sensor", "#DoubleTowelRail", "#Downlights",
  "#Downpipes", "#Drains", "#Drawers", "#Exhaust Fans", "#ExtCeilingFan", "#ExtWallLights",
  "#ExternalDoors", "#ExternalDoorsWet", "#ExternalSlabs", "#Fridges", "#Garages",
  "#GasPoints", "#InsetBaths", "#IntWallLights", "#KitchenSink", "#LH1020Doors",
  "#LH112JAMBS", "#LH2340112JAMBS", "#LH241020Doors", "#LH24620Doors", "#LH24720Doors",
  "#LH24820Doors", "#LH24870Doors", "#LH24920Doors", "#LH620Doors", "#LH720Doors",
  "#LH820Doors", "#LH820GarageDoors", "#LH870Doors", "#LH920Doors", "#LHCareKitchenSink",
  "#LHDoors", "#LHGrabRail", "#LHKitchenSink", "#LHLO1020Doors", "#LHLO112JAMBS",
  "#LHLO241020Doors", "#LHLO24720Doors", "#LHLO24820Doors", "#LHLO24870Doors",
  "#LHLO24920Doors", "#LHLO720Doors", "#LHLO820Doors", "#LHLO870Doors", "#LHLO920Doors",
  "#LdyTubs", "#MeshSquaresSales", "#Microwaves", "#NDISDoubleGPO", "#NDISDoubleGPOUSB",
  "#NDISSingleGPO", "#NdisRollInRobes", "#OOARobe", "#PassageHandles", "#Pendants",
  "#Penetrations", "#PhonePoints", "#Piers", "#Posts", "#PrivacyHandles", "#RH1020Doors",
  "#RH112JAMBS", "#RH2340112JAMBS", "#RH241020Doors", "#RH24620Doors", "#RH24720Doors",
  "#RH24820Doors", "#RH24870Doors", "#RH24920Doors", "#RH620Doors", "#RH720Doors",
  "#RH820Doors", "#RH820GarageDoors", "#RH870Doors", "#RH920Doors", "#RHCareKitchenSink",
  "#RHDoors", "#RHGrabRail", "#RHKitchenSink", "#RHLO1020Doors", "#RHLO112JAMBS",
  "#RHLO241020Doors", "#RHLO24720Doors", "#RHLO24820Doors", "#RHLO24870Doors",
  "#RHLO24920Doors", "#RHLO720Doors", "#RHLO820Doors", "#RHLO870Doors", "#RHLO920Doors",
  "#Rangehoods", "#RecessedVanityBasins", "#RobePosts", "#Robes", "#Sensors",
  "#ShowerRails", "#Showers", "#Single GPO", "#Single GPO Roof", "#Single WGPO",
  "#SingleSpotlights", "#SingleSpotlights+Sensor", "#SinkMixer", "#SlabGroundSpacersSales",
  "#SmokeDetectors", "#SolarPanels", "#StandAloneTubs", "#TVPoints", "#TapeSlab",
  "#ToiletRollHolders", "#Toilets", "#TrenchMesh3-TM", "#TrenchMeshSupportSales",
  "#UndermountSink", "#VanityBasins", "#WallMountedBasin", "#WallOvenCab", "#Wall_Mixer",
  "#Watertank", "#Watertank10000L", "#Watertank2000L", "#Watertank3000L", "#Watertank4000L",
  "#Watertank5000L", "#WindowActuator", "#WindowsLintels", "#WirShelves", "#WireTie",
  "#Zbar Sales", "#doubledoors", "#integratedFridge", "#ofGables", "#ofGlassSliders",
  "#ofRidges", "#ofStarterBars", "#ofWindows", "#ovens", "20mmBenchtopM2",
  "20mmWaterfallEnds", "40mmBenchtopM2", "40mmWaterfallEnds", "70mmStuds", "Access Token",
  "AccessTokenX", "AdhTotalDraw", "Alfresco Area", "AllWallTilesM2", "AppliancePrice",
  "AwGlassM2", "AxonLm", "BalRating", "BalconyArea", "BathFloorTilesM2", "BathWallTilesM2",
  "BenchPrice", "BlockLength", "BlockWidth", "BreakfastBarLamLm", "BreakfastBarLm",
  "BricksLm", "BuildBoundary", "CONSTRUCTION ID", "CabinetryPrice", "CarpenterPrices",
  "CarpetM2", "CaulkingLm", "CavitySlider1020", "CavitySlider720", "CavitySlider820",
  "CavitySlider870", "CavitySlider920", "CementExternalCorners", "CementInternalCorners",
  "CementSheetGableM2", "CementSheetLm", "CivicPrice", "CladdingLm", "Class3", "CoLiving",
  "Code", "ColouredConcreteM2", "ColouredConcreteM3", "CommisionPrice", "Component Tags",
  "ConcreteM2", "ContractAmount", "ContractPrice", "Cooktop Width", "Count", "CovercreteM2",
  "CupboardShelvingLM", "CurrentColourSelectionID", "CurrentColourSelectionTitle",
  "DelayBetweenProcessPO", "DemolitionPrice", "DeskTopsm2", "DhGlassM2", "DoorBool",
  "DoorBool2", "DrawersLM", "DuctedAC", "EB_BathroomCount", "EB_BedroomCount",
  "EB_Entry_Count", "EB_Interior_Room_Count", "EB_KitchenCount", "EB_LaundryCount",
  "EB_RoomId", "EB_RoomTitle", "EB_ToiletCount", "EasyTexLm", "EasylapLm",
  "ElectricianPrice", "EnsFloorTilesM2", "EnsWallTilesM2", "ExposedAggregateM2",
  "ExposedAggregateM3", "ExternalStripDrain", "ExternalTilesM2", "FFBrickSillLm",
  "FFCeilingHeight", "FFCementSheetM2", "FFLivingArea", "FFWeatherboardM2", "FFWetArea",
  "FJPR3111", "FJPR3131", "FJPR4242", "FJPR6642", "FaceFirstBrickM2", "FaceGroundBrickM2",
  "Fascia Length", "Fascia/Gutter Length", "FeatureFirstBrickM2", "FeatureGroundBrickM2",
  "Flood", "FlyScreens", "FullSlabOrder", "GAS", "GFBrickSillLm", "GFCeilingHeight",
  "GFCementSheetM2", "GFLivingArea", "GFWeatherboardM2", "Garage Area", "GarageLm",
  "GasFitPrice", "GasSource", "GlassM2", "GreyWater", "Gutter Length", "HWSElectric",
  "HWSGasBottles", "HWSGasLine", "HWSSolar", "HardieTexBaseSheetLm", "HardiplankM2",
  "Height", "HipsLm", "HybridM2", "InKitchen", "InternalM2", "InternalStripDrain",
  "JOBNUMBER", "Job Number", "Job_JSON", "KitDelivery", "KitchenWallTilesM2",
  "KitchenbenchLamLm", "KitchenbenchLm", "LdyWallTilesM2", "Length", "LineaM2", "LinenLm",
  "MirrorARRAY", "Misc1Price", "Misc2Price", "Misc3Price", "NDISTEKNA", "NDISYesNo",
  "New Tab ID", "NewVar", "NoiseCategory", "OverheadCupboards", "PACKAGE", "PB_ID_LENGTH",
  "PLYM2", "PLYSheets", "PMAD1020", "PMAD820", "PMAD920", "POID", "PO_Painter", "PSA4211",
  "PSA4219", "PSA6611", "PainterPrices", "PantryCabinetLm", "PartiWallBelowRoofm2",
  "PartitionM2", "Pier Height", "Pier Lm", "PlainConcreteM2", "PlainConcreteM3",
  "Plasterboard m2", "PlastererPrice", "PlumbPrice", "PlumbingGearPrice", "Porch Area",
  "Post FormedDeskLm", "Post FormedDeskm2", "PowerLine", "ProcessingItemsOnDB",
  "ProductPackage", "ProvisionalSum", "PwdrWallTilesM2", "QTYS_only", "QuickSpec_BAL",
  "QuickSpec_SOIL", "R1-5BattsM2", "R2-5BattsM2", "R3-0BattsM2", "R3-5BattsM2",
  "R4-1BattsM2", "R5-0BattsM2", "RefCabinetLm", "RenderedM2", "RidgeLm", "RobeLm",
  "Roller Blinds", "Roof Area", "RoomId", "SOF2406", "SalesYesNo", "SelectionsContentForId",
  "Shape", "ShowerARRAY", "SiteArea", "SmallGasBottles", "SmallLotCode", "SoilClass",
  "SwGlassM2", "TORSIONYesNo", "TabIdList", "TeknaKitchen", "TeknaRenoBut", "Temp",
  "TilerPrices", "TilesM2", "TilesPrice", "TotalBrickM2", "TotalFFBrickM2",
  "TotalFeatureBrickM2", "TotalGFBrickM2", "TotalM2", "TravelAllowance", "Type",
  "UndersideCupboards", "ValleyLm", "VanityLm", "Vinyl Array", "VinylM2", "WCWallTilesM2",
  "WRCQTY", "WRQTY", "WatertankList", "WatertankType", "WeatherboardGableM2", "WetAreaM2",
  "WetSeal Array", "WetSealLM", "WetSealShape", "Width", "WindPrice", "WindRating",
  "m3ConcreteSales"
]

puts "Starting to add #{variables.count} Unreal variables via API..."
puts "API Endpoint: #{API_ENDPOINT}\n\n"

success_count = 0
skip_count = 0
error_count = 0

variables.each_with_index do |variable_name, index|
  begin
    uri = URI(API_ENDPOINT)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == 'https')
    http.verify_mode = OpenSSL::SSL::VERIFY_NONE  # Disable SSL verification
    http.read_timeout = 10

    request = Net::HTTP::Post.new(uri.path, 'Content-Type' => 'application/json')
    request.body = {
      unreal_variable: {
        variable_name: variable_name,
        claude_value: 0,
        is_active: true
      }
    }.to_json

    response = http.request(request)

    if response.code == '201'
      puts "[#{index + 1}/#{variables.count}] ✓ Created: '#{variable_name}'"
      success_count += 1
    elsif response.code == '422' && JSON.parse(response.body)['errors']&.any? { |e| e.include?('already been taken') }
      puts "[#{index + 1}/#{variables.count}] - Skipped: '#{variable_name}' (already exists)"
      skip_count += 1
    else
      puts "[#{index + 1}/#{variables.count}] ✗ Error: '#{variable_name}' - #{response.code}: #{response.body}"
      error_count += 1
    end

    sleep(0.1) # Small delay to avoid overwhelming the API
  rescue => e
    puts "[#{index + 1}/#{variables.count}] ✗ Exception for '#{variable_name}': #{e.message}"
    error_count += 1
  end
end

puts "\n" + "="*60
puts "Summary:"
puts "  Successfully created: #{success_count}"
puts "  Skipped (already exists): #{skip_count}"
puts "  Errors: #{error_count}"
puts "  Total processed: #{variables.count}"
puts "="*60
