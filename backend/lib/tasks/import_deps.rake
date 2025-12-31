# frozen_string_literal: true

require "json"

namespace :deps do
  desc "Import dependencies from NDIS Template Excel by matching names"
  task import: :environment do
    # Dependencies extracted from NDIS Template (1).xlsx
    # Key: task name, Value: array of {name, type, lag}
    deps_json = <<~JSON
      {
        "ORDER - Soil Test and Wind Rating": [],
        "ORDER - Contour Survey Plan": [],
        "DO - Request Full Ghost Siting": [
          {"name": "ORDER - Soil Test and Wind Rating", "type": "FS", "lag": 0},
          {"name": "ORDER - Contour Survey Plan", "type": "FS", "lag": 0}
        ],
        "DO - Covenant Approval (if required)": [
          {"name": "ORDER - Soil Test and Wind Rating", "type": "FS", "lag": 0},
          {"name": "ORDER - Contour Survey Plan", "type": "FS", "lag": 0},
          {"name": "DO - Request Full Ghost Siting", "type": "FS", "lag": 0}
        ],
        "CONFIRM - Price for ADH": [
          {"name": "DO - Request Full Ghost Siting", "type": "FS", "lag": 0},
          {"name": "DO - Covenant Approval (if required)", "type": "FS", "lag": 0}
        ],
        "SIGN - CPN": [
          {"name": "CONFIRM - Price for ADH", "type": "FS", "lag": 0}
        ],
        "CREATE - Contracts": [
          {"name": "SIGN - CPN", "type": "FS", "lag": 0}
        ],
        "DO - Load Invoices into XERO": [
          {"name": "CREATE - Contracts", "type": "FS", "lag": 0}
        ],
        "GET - Finance Approval": [
          {"name": "CREATE - Contracts", "type": "FS", "lag": 0}
        ],
        "DO - Plumbing Approval": [
          {"name": "GET - Finance Approval", "type": "FS", "lag": 0}
        ],
        "DO - QLeave": [
          {"name": "GET - Finance Approval", "type": "FS", "lag": 0}
        ],
        "DO - Slab Design": [
          {"name": "GET - Finance Approval", "type": "FS", "lag": 0}
        ],
        "DO - Hydraulics Design": [
          {"name": "GET - Finance Approval", "type": "FS", "lag": 0}
        ],
        "DO - Energy Efficiency": [
          {"name": "GET - Finance Approval", "type": "FS", "lag": 0}
        ],
        "CHECK - Land Settlement": [
          {"name": "GET - Finance Approval", "type": "FS", "lag": 0}
        ],
        "DO - Certification": [
          {"name": "DO - Plumbing Approval", "type": "FS", "lag": 0},
          {"name": "DO - QLeave", "type": "FS", "lag": 0},
          {"name": "DO - Slab Design", "type": "FS", "lag": 0},
          {"name": "DO - Hydraulics Design", "type": "FS", "lag": 0},
          {"name": "DO - Energy Efficiency", "type": "FS", "lag": 0}
        ],
        "CLAIM - Deposit": [
          {"name": "CHECK - Land Settlement", "type": "FS", "lag": 0}
        ],
        "DO - Driveway Application": [
          {"name": "DO - Certification", "type": "FS", "lag": 0}
        ],
        "ORDER - Trusses": [
          {"name": "CHECK - Land Settlement", "type": "FS", "lag": 0},
          {"name": "DO - Certification", "type": "FS", "lag": 0}
        ],
        "ORDER - Window Actuators": [
          {"name": "CHECK - Land Settlement", "type": "FS", "lag": 0},
          {"name": "DO - Certification", "type": "FS", "lag": 0}
        ],
        "ORDER - Kitchen Parts": [
          {"name": "CHECK - Land Settlement", "type": "FS", "lag": 0},
          {"name": "DO - Certification", "type": "FS", "lag": 0}
        ],
        "ORDER - Door Automation": [
          {"name": "CHECK - Land Settlement", "type": "FS", "lag": 0},
          {"name": "DO - Certification", "type": "FS", "lag": 0}
        ],
        "ORDER - Plumbing Items": [
          {"name": "CHECK - Land Settlement", "type": "FS", "lag": 0},
          {"name": "DO - Certification", "type": "FS", "lag": 0}
        ],
        "ORDER - Frame": [
          {"name": "CHECK - Land Settlement", "type": "FS", "lag": 0},
          {"name": "DO - Certification", "type": "FS", "lag": 0}
        ],
        "ORDER - Roof": [
          {"name": "CHECK - Land Settlement", "type": "FS", "lag": 0},
          {"name": "DO - Certification", "type": "FS", "lag": 0}
        ],
        "ORDER - EXT Doors": [
          {"name": "CHECK - Land Settlement", "type": "FS", "lag": 0},
          {"name": "DO - Certification", "type": "FS", "lag": 0}
        ],
        "ORDER - Surveyor": [
          {"name": "CHECK - Land Settlement", "type": "FS", "lag": 0},
          {"name": "DO - Certification", "type": "FS", "lag": 0}
        ],
        "ORDER - Windows": [
          {"name": "CHECK - Land Settlement", "type": "FS", "lag": 0},
          {"name": "DO - Certification", "type": "FS", "lag": 0}
        ],
        "Order SDA Auto Desk Stand For Kitchen": [
          {"name": "CHECK - Land Settlement", "type": "FS", "lag": 0},
          {"name": "DO - Certification", "type": "FS", "lag": 0}
        ],
        "Order SDA Manual Adjustable Desks Kitchen": [
          {"name": "CHECK - Land Settlement", "type": "FS", "lag": 0},
          {"name": "DO - Certification", "type": "FS", "lag": 0}
        ],
        "Req Site Cut": [
          {"name": "CHECK - Land Settlement", "type": "FS", "lag": 0},
          {"name": "DO - Certification", "type": "FS", "lag": 0}
        ],
        "SLAB": [],
        "Req Surveyor to Setout Wafflepod": [
          {"name": "Req Site Cut", "type": "FS", "lag": 0}
        ],
        "Req Drainer for Drains Wafflepod": [
          {"name": "Req Surveyor to Setout Wafflepod", "type": "FS", "lag": 0}
        ],
        "Req Electrician Underground (INC NBN)": [
          {"name": "Req Drainer for Drains Wafflepod", "type": "SS", "lag": 0}
        ],
        "Req Power To Site": [
          {"name": "Req Electrician Underground (INC NBN)", "type": "FS", "lag": 0}
        ],
        "DO - Formwork for Courtyard Seat": [
          {"name": "Req Concreter For Complete Slab Labour And Materials", "type": "SS", "lag": 0}
        ],
        "Req Concreter For Complete Slab Labour And Materials": [
          {"name": "Req Surveyor to Setout Wafflepod", "type": "FS", "lag": 0},
          {"name": "Req Drainer for Drains Wafflepod", "type": "FS", "lag": 0},
          {"name": "Req Electrician Underground (INC NBN)", "type": "FS", "lag": 0}
        ],
        "Req Termite Protection Penetrations": [
          {"name": "Req Concreter For Complete Slab Labour And Materials", "type": "SS", "lag": 0}
        ],
        "DO - Fill with Concrete Courtyard Seat": [
          {"name": "Req Concreter For Complete Slab Labour And Materials", "type": "FF", "lag": 0}
        ],
        "PHOTO - Slab": [
          {"name": "Req Concreter For Complete Slab Labour And Materials", "type": "FS", "lag": 0}
        ],
        "CERTIFICATE - 12 Form 43 - Stormwater Installation": [
          {"name": "SLAB", "type": "FS", "lag": 0}
        ],
        "Admin": [
          {"name": "Req Site Cut", "type": "FS", "lag": 0}
        ],
        "Pay Coaching Fee": [],
        "Pay Franchise Fee": [],
        "Pay Franchise Marketing Fee": [],
        "Pay Overhead Fee": [],
        "Pay Supervisor Fee": [],
        "Req 3D Drafting Qtys and Certification": [],
        "Req Soil Removal": [
          {"name": "Req Site Cut", "type": "FS", "lag": 0}
        ],
        "CLAIM - Slab": [
          {"name": "Req Concreter For Complete Slab Labour And Materials", "type": "FS", "lag": 0}
        ],
        "Req Waterproof Slab Edge": [
          {"name": "Req Concreter For Complete Slab Labour And Materials", "type": "FS", "lag": 0}
        ],
        "DO - Strip Formwork for Courtyard Seat": [
          {"name": "Req Concreter For Complete Slab Labour And Materials", "type": "FS", "lag": 0}
        ],
        "FRAME": [],
        "Req Frame Hardware": [
          {"name": "Req Carpenter Ground Floor", "type": "SS", "lag": -1}
        ],
        "Req Frame Material Ground Floor": [
          {"name": "Req Carpenter Ground Floor", "type": "SS", "lag": -1}
        ],
        "Req Carpenter Ground Floor": [
          {"name": "Req Concreter For Complete Slab Labour And Materials", "type": "FS", "lag": 2}
        ],
        "Req Termite Perimeter": [
          {"name": "Req Carpenter Ground Floor", "type": "SS", "lag": 0}
        ],
        "Req Roof Trusses": [
          {"name": "Req Carpenter Ground Floor", "type": "SS", "lag": 2}
        ],
        "Req Crane Roof Trusses": [
          {"name": "Req Roof Trusses", "type": "SS", "lag": 0}
        ],
        "Req Steel Posts": [
          {"name": "Req Roof Trusses", "type": "FS", "lag": 0}
        ],
        "PHOTO - Frame": [
          {"name": "Req Carpenter Ground Floor", "type": "FS", "lag": 0}
        ],
        "Do Frame Inspection": [
          {"name": "Req Carpenter Ground Floor", "type": "FS", "lag": 0}
        ],
        "Req Partition Wall": [
          {"name": "Req Carpenter Ground Floor", "type": "FS", "lag": 0}
        ],
        "CERTIFICATE - 05 Form 43 - Termite Installation Part B": [
          {"name": "Req Termite Perimeter", "type": "FS", "lag": 5}
        ],
        "CLAIM - Frame": [
          {"name": "Req Carpenter Ground Floor", "type": "FS", "lag": 0},
          {"name": "PHOTO - Frame", "type": "FS", "lag": 0}
        ],
        "CERTIFICATE - 04 Form 15 Truss Layout Plan": [
          {"name": "Req Roof Trusses", "type": "FS", "lag": 5}
        ],
        "CERTIFICATE - Engineer Frame INC Hoist": [
          {"name": "Do Frame Inspection", "type": "FS", "lag": 5}
        ],
        "CERTIFICATE - 01 Form 12 - Surveyor Setout": [
          {"name": "Req Surveyor to Setout Wafflepod", "type": "FS", "lag": 10}
        ],
        "CERTIFICATE - 02 Form 43 - Termite Installation Part A": [
          {"name": "SLAB", "type": "FS", "lag": 5}
        ],
        "Req Level Site After Slab Poured Soil Removal": [
          {"name": "SLAB", "type": "FS", "lag": 0}
        ],
        "ENCLOSED": [],
        "Req Fascia and Gutter and Colorbond Roof": [
          {"name": "Req Carpenter Ground Floor", "type": "FS", "lag": 0},
          {"name": "Req Partition Wall", "type": "FS", "lag": 0}
        ],
        "CERTIFICATION - 07 Form 43 - Roof Insulation": [
          {"name": "Req Fascia and Gutter and Colorbond Roof", "type": "FS", "lag": 10}
        ],
        "Req External Doors": [
          {"name": "Req Fascia and Gutter and Colorbond Roof", "type": "FF", "lag": -1}
        ],
        "Req Windows": [
          {"name": "Req Fascia and Gutter and Colorbond Roof", "type": "FF", "lag": -1}
        ],
        "Req External Door Handle Locks": [
          {"name": "Req External Doors", "type": "SS", "lag": 0}
        ],
        "Req Carpenter Install Windows/Doors": [
          {"name": "Req Carpenter Ground Floor", "type": "FS", "lag": 0},
          {"name": "Req Partition Wall", "type": "FS", "lag": 0},
          {"name": "Req Windows", "type": "FS", "lag": 0}
        ],
        "Req Carpenter Straighten Frame": [
          {"name": "Req Carpenter Install Windows/Doors", "type": "SS", "lag": 0}
        ],
        "Req Mixer Bodies For Plumber Rough In": [
          {"name": "Req Plumber Rough In", "type": "SS", "lag": -1}
        ],
        "FIT - Window Actuators": [
          {"name": "Req Windows", "type": "FS", "lag": 0},
          {"name": "Req Carpenter Install Windows/Doors", "type": "SS", "lag": 0}
        ],
        "Req Wall Sisilation Ground Floor": [
          {"name": "Req Carpenter Install Windows/Doors", "type": "SS", "lag": 0}
        ],
        "Req Site Clean After Roof": [
          {"name": "Req Fascia and Gutter and Colorbond Roof", "type": "FS", "lag": 0}
        ],
        "Req Measure Garage Doors": [
          {"name": "Req Carpenter Install Windows/Doors", "type": "FS", "lag": 0}
        ],
        "Req Rough In Solar Panels": [
          {"name": "Req Fascia and Gutter and Colorbond Roof", "type": "FS", "lag": 0}
        ],
        "Req Air Conditioning Rough In": [
          {"name": "Req Fascia and Gutter and Colorbond Roof", "type": "FS", "lag": 0}
        ],
        "Req Electrician - Prewire": [
          {"name": "Req Fascia and Gutter and Colorbond Roof", "type": "FS", "lag": 0}
        ],
        "Req Plumber Rough In": [
          {"name": "Req Fascia and Gutter and Colorbond Roof", "type": "FS", "lag": 0}
        ],
        "Req Soffit Hardware and Cladding": [
          {"name": "Req Fascia and Gutter and Colorbond Roof", "type": "FS", "lag": 0}
        ],
        "Req Fire Rough In": [
          {"name": "Req Fascia and Gutter and Colorbond Roof", "type": "FS", "lag": 0}
        ],
        "Req Carpenter Soffits Ground Floor": [
          {"name": "Req Fascia and Gutter and Colorbond Roof", "type": "FS", "lag": 0},
          {"name": "Req Soffit Hardware and Cladding", "type": "FS", "lag": 0}
        ],
        "Req Install Ply to Bathrooms": [
          {"name": "Req Plumber Rough In", "type": "FS", "lag": 0}
        ],
        "Do Plumbing Rough-In Inspection": [
          {"name": "Req Plumber Rough In", "type": "FS", "lag": 0}
        ],
        "Req Carpenter Cladding": [
          {"name": "Req Carpenter Soffits Ground Floor", "type": "FS", "lag": 0}
        ],
        "Do Inspection NDIS - Frame": [
          {"name": "Req Install Ply to Bathrooms", "type": "FS", "lag": 0}
        ],
        "PHOTO - Ply Bathrooms, Bedroom Crane Supports": [
          {"name": "Req Install Ply to Bathrooms", "type": "FS", "lag": 0}
        ],
        "CERTIFICATE - 08 Compliance Certificate - Glazing - Window and Doors": [
          {"name": "Req Windows", "type": "FS", "lag": 5}
        ],
        "PHOTO - Enclosed": [
          {"name": "Req Carpenter Cladding", "type": "FS", "lag": 0}
        ],
        "Req Down Pipes Ground Floor": [
          {"name": "Req Carpenter Cladding", "type": "FS", "lag": 0}
        ],
        "CLAIM - Enclosed": [
          {"name": "Req Carpenter Cladding", "type": "FS", "lag": 0},
          {"name": "PHOTO - Enclosed", "type": "FS", "lag": 0}
        ],
        "CERTIFICATE - 03 Form 12 Engineering  Slab": [
          {"name": "Req Concreter For Complete Slab Labour And Materials", "type": "FS", "lag": 10}
        ],
        "FIXING": [],
        "Req Ceiling & Wall Insulation Before Plasterboard": [
          {"name": "Req Plumber Rough In", "type": "FS", "lag": 0},
          {"name": "Req Electrician - Prewire", "type": "FS", "lag": 0},
          {"name": "Req Fire Rough In", "type": "FS", "lag": 0},
          {"name": "Req Air Conditioning Rough In", "type": "FS", "lag": 0},
          {"name": "Req Rough In Solar Panels", "type": "FS", "lag": 0}
        ],
        "Req Plaster Board": [
          {"name": "Do Plumbing Rough-In Inspection", "type": "FS", "lag": 0},
          {"name": "Req Air Conditioning Rough In", "type": "FS", "lag": 0},
          {"name": "Req Electrician - Prewire", "type": "FS", "lag": 0},
          {"name": "Req Plumber Rough In", "type": "FS", "lag": 0},
          {"name": "Req Ceiling & Wall Insulation Before Plasterboard", "type": "FS", "lag": 0}
        ],
        "Req Internal Fixout": [
          {"name": "Req Carpenter Fixout", "type": "SS", "lag": -1}
        ],
        "Req Site Clean After Plasterboard & Brickwork": [
          {"name": "Req Plaster Board", "type": "FS", "lag": 0},
          {"name": "Req Carpenter Cladding", "type": "FS", "lag": 0}
        ],
        "Req Carpenter Fixout": [
          {"name": "Req Plaster Board", "type": "FS", "lag": 0}
        ],
        "Req Garage Doors": [
          {"name": "Req Plaster Board", "type": "FS", "lag": 0}
        ],
        "SPO - Electrician - Cutouts": [
          {"name": "Req Plaster Board", "type": "FS", "lag": 0}
        ],
        "Req Internal Door Handles": [
          {"name": "Req Carpenter Fixout", "type": "SS", "lag": 0}
        ],
        "FIT - Auto Door Openers": [
          {"name": "Req Carpenter Fixout", "type": "FS", "lag": 0}
        ],
        "Req Kitchen": [
          {"name": "Req Carpenter Fixout", "type": "FS", "lag": 0}
        ],
        "Req Water Proofer": [
          {"name": "Req Carpenter Fixout", "type": "FS", "lag": 0}
        ],
        "Req Tiles": [
          {"name": "Req Tiler", "type": "SS", "lag": -1}
        ],
        "Do Make and Install Kitchen": [
          {"name": "Req Kitchen", "type": "FS", "lag": 0}
        ],
        "Req Tiler": [
          {"name": "Req Kitchen", "type": "FS", "lag": 0},
          {"name": "Req Water Proofer", "type": "FS", "lag": 0}
        ],
        "SPO - Plaster Fit Cornice": [
          {"name": "Req Kitchen", "type": "FS", "lag": 0}
        ],
        "CERTIFICATE - 11 Form 43 - Waterproofing": [
          {"name": "Req Water Proofer", "type": "FS", "lag": 5}
        ],
        "Req Painter Internal  House": [
          {"name": "Req Tiler", "type": "FS", "lag": 0}
        ],
        "Measure Shower Screens Book Fitting": [
          {"name": "Req Tiler", "type": "FS", "lag": 0}
        ],
        "Req Pre Paint (Including Sanding)": [
          {"name": "Req Painter Internal  House", "type": "SS", "lag": 1}
        ],
        "PHOTO - Fixing": [
          {"name": "Req Tiles", "type": "FS", "lag": 0},
          {"name": "Req Painter Internal  House", "type": "FS", "lag": 0}
        ],
        "Req Painter External House": [
          {"name": "Req Painter Internal  House", "type": "FS", "lag": 0},
          {"name": "Req Carpenter Cladding", "type": "FS", "lag": 0},
          {"name": "Req Down Pipes Ground Floor", "type": "FS", "lag": 0}
        ],
        "CLAIM - Fixing": [
          {"name": "Req Tiler", "type": "FS", "lag": 0},
          {"name": "Req Painter Internal  House", "type": "FS", "lag": 0},
          {"name": "PHOTO - Fixing", "type": "FS", "lag": 0}
        ],
        "DRIVEWAY": [],
        "Req Driveway Kerb Cut Out": [
          {"name": "Req Driveway Concretor", "type": "SS", "lag": -2}
        ],
        "FIT - Drains to Front of Doors": [
          {"name": "Req Driveway Concretor", "type": "SS", "lag": -2}
        ],
        "Req Driveway Steel Reo": [
          {"name": "Req Driveway Concretor", "type": "SS", "lag": -1}
        ],
        "Req Driveway Concretor": [
          {"name": "Req Down Pipes Ground Floor", "type": "FS", "lag": 0},
          {"name": "Req Tiler", "type": "FS", "lag": 0}
        ],
        "PHOTO - Driveway": [
          {"name": "Req Driveway Concretor", "type": "FS", "lag": 0}
        ],
        "Req Driveway Prep Site Clean": [],
        "LANDSCAPING": [],
        "Req Retaining Wall": [
          {"name": "Req Driveway Concretor", "type": "FS", "lag": 0}
        ],
        "Req Fence": [
          {"name": "Req Retaining Wall", "type": "FS", "lag": 0},
          {"name": "Req Driveway Concretor", "type": "FS", "lag": 0}
        ],
        "Req Landscaping": [
          {"name": "Req Fence", "type": "FS", "lag": 0}
        ],
        "PHOTO - Fence and Landscaping": [
          {"name": "Req Fence", "type": "FS", "lag": 0},
          {"name": "Req Landscaping", "type": "FS", "lag": 0}
        ],
        "Req Landscape Prep Final Site Clean": [],
        "PRACTICAL COMPLETION": [],
        "Req Hot Water System": [
          {"name": "Req Plumber - Fit Off", "type": "SS", "lag": -1}
        ],
        "Req Plumber Fitoff Gear": [
          {"name": "Req Plumber - Fit Off", "type": "SS", "lag": -1}
        ],
        "Req Fire System Fitoff": [
          {"name": "Req Painter Internal  House", "type": "FS", "lag": 0},
          {"name": "Req Tiler", "type": "FS", "lag": 0}
        ],
        "Req Electrical Items": [
          {"name": "Req Electrician - Fit Off", "type": "SS", "lag": -1}
        ],
        "Req Vinyl Sliders": [
          {"name": "Req Painter Internal  House", "type": "FS", "lag": 0},
          {"name": "Req Tiler", "type": "FS", "lag": 0}
        ],
        "Req Window Coverings": [
          {"name": "Req Painter Internal  House", "type": "FS", "lag": 0},
          {"name": "Req Tiler", "type": "FS", "lag": 0}
        ],
        "Req Carpenter For Final Fitoff": [
          {"name": "Req Tiler", "type": "FS", "lag": 0},
          {"name": "Req Painter Internal  House", "type": "FS", "lag": 0}
        ],
        "Req Plumber - Fit Off": [
          {"name": "Req Tiler", "type": "FS", "lag": 0},
          {"name": "Req Painter Internal  House", "type": "FS", "lag": 0}
        ],
        "Req Shower Screens": [
          {"name": "Req Tiler", "type": "FS", "lag": 0},
          {"name": "Req Painter Internal  House", "type": "FS", "lag": 0}
        ],
        "Req SAT System": [
          {"name": "Req Electrician - Fit Off", "type": "SS", "lag": -1}
        ],
        "CERTIFICATE - 09 Form 15 - Shower Screens": [
          {"name": "Req Shower Screens", "type": "FS", "lag": 0}
        ],
        "Do Finishing Touches": [
          {"name": "Req Carpenter For Final Fitoff", "type": "FS", "lag": 0}
        ],
        "Req Electrician - Fit Off": [
          {"name": "Req Tiler", "type": "FS", "lag": 0},
          {"name": "Req Painter Internal  House", "type": "FS", "lag": 0},
          {"name": "Req Window Coverings", "type": "FS", "lag": 0}
        ],
        "DO - Courtyard Seat and Sprinkler": [
          {"name": "Req Carpenter For Final Fitoff", "type": "FS", "lag": 0}
        ],
        "Do Plumbing Final Inspection": [
          {"name": "Req Plumber - Fit Off", "type": "FS", "lag": 0}
        ],
        "Req Gapping To Skirting and Expansion Joints": [
          {"name": "Req Plumber - Fit Off", "type": "FS", "lag": 0},
          {"name": "Req Carpenter For Final Fitoff", "type": "FS", "lag": 0}
        ],
        "Req Air Conditioning Fit Off": [
          {"name": "Req Electrician - Fit Off", "type": "FF", "lag": -1}
        ],
        "GET - All Forms for Final Inspection": [
          {"name": "Do Council Final Inspection", "type": "SS", "lag": -5}
        ],
        "DO - Get Hot Water Rebate": [
          {"name": "Do Plumbing Final Inspection", "type": "FS", "lag": 0}
        ],
        "Req Site Clean Final": [
          {"name": "Req Plumber - Fit Off", "type": "FS", "lag": 0},
          {"name": "Req Electrician - Fit Off", "type": "FS", "lag": 0}
        ],
        "Req Full Turn Key Package": [
          {"name": "Req Electrician - Fit Off", "type": "FS", "lag": 0},
          {"name": "Req Plumber - Fit Off", "type": "FS", "lag": 0}
        ],
        "Req Painter Touch Ups": [
          {"name": "Req Plumber - Fit Off", "type": "FS", "lag": 0},
          {"name": "Req Electrician - Fit Off", "type": "FS", "lag": 0},
          {"name": "Req Vinyl Sliders", "type": "FS", "lag": 0}
        ],
        "Req Solar Panel Commisions": [
          {"name": "Req Electrician - Fit Off", "type": "FS", "lag": 0}
        ],
        "CERTIFICATE - 10 Form 12 - Smoke Alarms": [
          {"name": "Req Electrician - Fit Off", "type": "FS", "lag": 0}
        ],
        "Req Ceiling Insulation": [
          {"name": "Req Electrician - Fit Off", "type": "FS", "lag": 0},
          {"name": "Req Solar Panel Commisions", "type": "FS", "lag": 0}
        ],
        "Req Vinyl Floor": [
          {"name": "Req Full Turn Key Package", "type": "FS", "lag": 0}
        ],
        "Req Window Handover Service": [
          {"name": "Req Full Turn Key Package", "type": "FS", "lag": 0}
        ],
        "SPO -  Insulation Spread Ceiling Insulation": [
          {"name": "Req Electrician - Fit Off", "type": "FS", "lag": 0},
          {"name": "Req Solar Panel Commisions", "type": "FS", "lag": 0}
        ],
        "Do - Put Termite Sticker In MeterBox and Kitchen Cupboard": [
          {"name": "Do Council Final Inspection", "type": "SS", "lag": -1}
        ],
        "Req Builders Clean": [
          {"name": "Req Electrician - Fit Off", "type": "FS", "lag": 0},
          {"name": "Req Solar Panel Commisions", "type": "FS", "lag": 0},
          {"name": "Req Vinyl Floor", "type": "FS", "lag": 0},
          {"name": "Do Finishing Touches", "type": "FS", "lag": 0}
        ],
        "CERTIFICATE - 06 Form 43 Energy Efficiency": [
          {"name": "Req Ceiling Insulation", "type": "FS", "lag": 0}
        ],
        "PHOTO - Practical Completion": [
          {"name": "Req Builders Clean", "type": "FS", "lag": 0}
        ],
        "Do Council Final Inspection": [
          {"name": "Req Builders Clean", "type": "FS", "lag": 0}
        ],
        "GET - Form 11/21 from Certifier": [
          {"name": "Do Council Final Inspection", "type": "FS", "lag": 0}
        ],
        "CREATE - Builder Confirmation": [
          {"name": "Do Council Final Inspection", "type": "FS", "lag": 0}
        ],
        "GET - Engineer For Future Ceiling": [],
        "GET - SDA Site Density Report": [
          {"name": "Do Council Final Inspection", "type": "FS", "lag": 0}
        ],
        "CREATE - Evacuation Plan": [
          {"name": "Do Council Final Inspection", "type": "FS", "lag": 0}
        ],
        "CLAIM - Practical Completion": [
          {"name": "Do Council Final Inspection", "type": "FS", "lag": 0}
        ],
        "DO - NDIS Final Inspection": [
          {"name": "Do Council Final Inspection", "type": "FS", "lag": 0},
          {"name": "CREATE - Builder Confirmation", "type": "FS", "lag": 0},
          {"name": "CREATE - Evacuation Plan", "type": "FS", "lag": 0}
        ],
        "DO - Final Payment has been made, Organize Handover house": [
          {"name": "Do Council Final Inspection", "type": "FS", "lag": 0},
          {"name": "CLAIM - Practical Completion", "type": "FS", "lag": 0}
        ]
      }
    JSON

    deps = JSON.parse(deps_json)

    # Build name -> task_number map
    name_to_tn = {}
    SmScheduleMaster.pluck(:name, :task_number).each do |name, tn|
      name_to_tn[name.strip] = tn if name
    end

    updated = 0
    deps.each do |task_name, preds|
      task_tn = name_to_tn[task_name]
      next unless task_tn

      task = SmScheduleMaster.find_by(task_number: task_tn)
      next unless task

      new_preds = preds.filter_map do |p|
        pred_tn = name_to_tn[p["name"]]
        next unless pred_tn
        { "id" => pred_tn, "type" => p["type"], "lag" => p["lag"] }
      end

      task.update!(predecessor_ids: new_preds)
      updated += 1
    end

    puts "Updated #{updated} tasks"

    # Verify DO - Certification
    cert = SmScheduleMaster.find_by(name: "DO - Certification")
    if cert
      puts ""
      puts "DO - Certification predecessors:"
      cert.predecessor_ids.each do |p|
        pred = SmScheduleMaster.find_by(task_number: p["id"])
        puts "  #{p['id']}: #{pred&.name}"
      end
    end
  end
end
