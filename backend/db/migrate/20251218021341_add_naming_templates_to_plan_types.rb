class AddNamingTemplatesToPlanTypes < ActiveRecord::Migration[8.0]
  def change
    # Short name template - for display in tables/lists (e.g., "01-PERSPECTIVE")
    add_column :plan_types, :short_name_template, :string, default: "{Code}-{Name}"

    # Long name template - for SharePoint file names (e.g., "EB2401-01-PERSPECTIVE-RevA")
    add_column :plan_types, :long_name_template, :string, default: "{JobCode}-{Code}-{Name}-Rev{Rev}"
  end
end
