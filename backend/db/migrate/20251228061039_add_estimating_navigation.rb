class AddEstimatingNavigation < ActiveRecord::Migration[8.0]
  def up
    jobs_nav = NavigationItem.find_by(name: "Jobs")
    return unless jobs_nav

    # Add Estimating under Jobs (if not exists)
    estimating = NavigationItem.find_or_create_by!(href: "/estimates") do |nav|
      nav.name = "Estimating"
      nav.icon = "Calculator"
      nav.position = 6
      nav.parent_id = jobs_nav.id
      nav.is_active = true
    end

    # Update name if it was created with different name
    estimating.update!(name: "Estimating") if estimating.name != "Estimating"

    # Add Recipes under Estimating
    NavigationItem.find_or_create_by!(href: "/recipes") do |nav|
      nav.name = "Recipes"
      nav.icon = "ChefHat"
      nav.position = 1
      nav.parent_id = estimating.id
      nav.is_active = true
    end
  end

  def down
    NavigationItem.find_by(href: "/recipes")&.destroy
    # Don't destroy Estimating as it may have existed before
  end
end
