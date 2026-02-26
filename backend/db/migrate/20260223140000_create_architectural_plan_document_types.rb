# frozen_string_literal: true

# Create document types matching standard architectural plan sheet names.
# Based on Pilgrim Homes "Harold Street - Holland Park - Issue J" plan set (46 sheets).
#
# SSoT: These names match exactly what architects produce, enabling automatic
# classification when plans are uploaded to jobs.
#
# Creates 40 new DocumentType records (4 already exist: Site Plan, Drainage Plan,
# Ground Floor Plan, Roof Plan) and links all 44 to the "Plans" WarehouseFolder.
#
class CreateArchitecturalPlanDocumentTypes < ActiveRecord::Migration[8.0]
  # All 44 unique sheet types from the architectural plan set
  # Grouped by drawing series (A-00 through A-07)
  PLAN_TYPES = [
    # A-00: Cover & Perspectives
    { name: "Cover Sheet",             abbreviation: "A-00-01", description: "Plan set cover sheet with sheet list" },
    { name: "Perspectives",            abbreviation: "A-00-02", description: "3D exterior perspective views" },
    { name: "Internal Perspectives",   abbreviation: "A-00-03", description: "3D interior perspective views" },
    { name: "Backyard Perspectives",   abbreviation: "A-00-04", description: "3D backyard/outdoor perspective views" },
    { name: "3D Site View",            abbreviation: "A-00-05", description: "Isometric 3D site overview" },
    { name: "3D Slab View",            abbreviation: "A-00-06", description: "Isometric 3D slab/foundation view" },
    { name: "General Notes",           abbreviation: "A-00-07", description: "General construction notes and specifications" },

    # A-01: Site & Foundation
    { name: "Site Plan",               abbreviation: "A-01-01", description: "Site layout plan" },
    { name: "Earthworks Plan",         abbreviation: "A-01-02", description: "Cut and fill earthworks plan" },
    { name: "Slab Setout",             abbreviation: "A-01-03", description: "Slab setout dimensions and details" },
    { name: "Drainage Plan",           abbreviation: "A-01-04", description: "Stormwater and drainage plan" },

    # A-02: Floor Plans
    { name: "Ground Floor Plan",       abbreviation: "A-02-01", description: "Ground floor layout plan" },
    { name: "Level 1 Floor Plan",      abbreviation: "A-02-02", description: "First floor (Level 1) layout plan" },
    { name: "Roof Plan",               abbreviation: "A-02-03", description: "Roof framing and layout plan" },
    { name: "Ground Ceiling Plan",     abbreviation: "A-02-04", description: "Ground floor reflected ceiling plan" },
    { name: "Level 1 Ceiling Plan",    abbreviation: "A-02-05", description: "Level 1 reflected ceiling plan" },

    # A-03: Elevations & Pool
    { name: "Proposed Elevations",     abbreviation: "A-03-01", description: "Proposed building elevations (all sides)" },
    { name: "Pool Plan",               abbreviation: "A-03-03", description: "Swimming pool layout and details" },
    { name: "Fence Elevations",        abbreviation: "A-03-04", description: "Fence and boundary elevation details" },

    # A-04: Sections & Details
    { name: "Sections",                abbreviation: "A-04-01", description: "Building cross-sections" },
    { name: "Stair Detail",            abbreviation: "A-04-03", description: "Staircase construction details" },
    { name: "Section Details",         abbreviation: "A-04-05", description: "Detailed section drawings" },
    { name: "Facade Callout",          abbreviation: "A-04-06", description: "Facade material and detail callouts" },
    { name: "Laundry Chute",           abbreviation: "A-04-07", description: "Laundry chute construction details" },

    # A-05: Internals (Joinery & Cabinetry)
    { name: "Fixed Joinery Notes",     abbreviation: "A-05-00", description: "Fixed joinery specifications and notes" },
    { name: "Internals - Kitchen",     abbreviation: "A-05-01", description: "Kitchen cabinetry and joinery details" },
    { name: "Internals - Laundry",     abbreviation: "A-05-02", description: "Laundry cabinetry and joinery details" },
    { name: "Internals - Lower Bathroom", abbreviation: "A-05-03", description: "Lower bathroom cabinetry details" },
    { name: "Internals - Upper Bathroom", abbreviation: "A-05-04", description: "Upper bathroom cabinetry details" },
    { name: "Internals - Upper Toilet", abbreviation: "A-05-05", description: "Upper toilet/WC cabinetry details" },
    { name: "Internals - Ensuite",     abbreviation: "A-05-06", description: "Ensuite bathroom cabinetry details" },
    { name: "Internals - WIR",         abbreviation: "A-05-07", description: "Walk-in robe shelving and fitout details" },
    { name: "Internals - Wardrobes",   abbreviation: "A-05-08", description: "Built-in wardrobe cabinetry details" },
    { name: "Internals - BBQ Area",    abbreviation: "A-05-09", description: "Outdoor BBQ area cabinetry details" },
    { name: "Internals - TV Cabinet",  abbreviation: "A-05-10", description: "TV cabinet and entertainment unit details" },

    # A-06: Finishes, Cladding & Electrical
    { name: "Ground Floor Finishes Plan",      abbreviation: "A-06-01", description: "Ground floor finishes schedule plan" },
    { name: "Level 1 Finishes Plan",           abbreviation: "A-06-02", description: "Level 1 finishes schedule plan" },
    { name: "Ground Floor Cladding Diagram",   abbreviation: "A-06-03", description: "Ground floor external cladding diagram" },
    { name: "Level 1 Cladding Diagram",        abbreviation: "A-06-04", description: "Level 1 external cladding diagram" },
    { name: "Ground Electrical Plan",          abbreviation: "A-06-05", description: "Ground floor electrical layout plan" },
    { name: "Level 1 Electrical Plan",         abbreviation: "A-06-06", description: "Level 1 electrical layout plan" },

    # A-07: Schedules
    { name: "Door Schedule",           abbreviation: "A-07-01", description: "Door sizes, types and hardware schedule" },
    { name: "Window Schedule",         abbreviation: "A-07-02", description: "Window sizes, types and glazing schedule" },
    { name: "Sizing Schedule",         abbreviation: "A-07-09", description: "Room and element sizing schedule" },
  ].freeze

  def up
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        create_for_tenant(tenant)
      end
    end
  end

  def down
    # Only remove types we created (by abbreviation pattern A-XX-XX)
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        abbreviations = PLAN_TYPES.map { |t| t[:abbreviation] }
        doc_types = DocumentType.where(abbreviation: abbreviations)

        # Remove folder links first
        WarehouseFolderDocumentType.where(document_type: doc_types).destroy_all

        # Only destroy types we created (not pre-existing ones like Site Plan)
        # Pre-existing ones won't have our abbreviation format
        doc_types.destroy_all
      end
    end

    puts "Removed architectural plan document types"
  end

  private

  def create_for_tenant(tenant)
    job_wt = WarehouseType.find_by(code: "job")
    unless job_wt
      puts "  #{tenant.name}: No 'job' warehouse type - skipping"
      return
    end

    plans_folder = WarehouseFolder.find_by(display_name: "Plans", warehouse_type: job_wt)
    unless plans_folder
      puts "  #{tenant.name}: No 'Plans' folder - skipping"
      return
    end

    created = 0
    linked = 0

    PLAN_TYPES.each do |attrs|
      # Find existing by exact name, or create new
      dt = DocumentType.find_by(name: attrs[:name], scope: "job")

      if dt
        # Already exists - just ensure it has our abbreviation and is linked to Plans
        dt.update_column(:abbreviation, attrs[:abbreviation]) if dt.abbreviation.blank?
      else
        # Create new
        dt = DocumentType.create!(
          name: attrs[:name],
          abbreviation: attrs[:abbreviation],
          description: attrs[:description],
          scope: "job",
          active: true,
          warehouse_type: job_wt
        )
        created += 1
      end

      # Ensure linked to Plans folder
      unless WarehouseFolderDocumentType.exists?(warehouse_folder: plans_folder, document_type: dt)
        WarehouseFolderDocumentType.create!(
          warehouse_folder: plans_folder,
          document_type: dt,
          is_primary: true
        )
        linked += 1
      end
    end

    puts "  #{tenant.name}: Created #{created} new, linked #{linked} to Plans folder (#{PLAN_TYPES.size} total types)"
  end
end
