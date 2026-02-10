# frozen_string_literal: true

class AddColourSwatchesNavigation < ActiveRecord::Migration[8.0]
  def up
    pricebook_nav = NavigationItem.find_by(href: "/pricebook")
    return unless pricebook_nav

    # Find existing children to determine position
    max_position = NavigationItem.where(parent_id: pricebook_nav.id).maximum(:position) || -1

    NavigationItem.find_or_create_by!(href: "/pricebook/colour-swatches") do |nav|
      nav.name = "Colour Swatches"
      nav.icon = "Palette"
      nav.position = max_position + 1
      nav.parent_id = pricebook_nav.id
      nav.is_active = true
      nav.visible_to_roles = []
    end
  end

  def down
    NavigationItem.find_by(href: "/pricebook/colour-swatches")&.destroy
  end
end
