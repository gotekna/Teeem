class PromoteESignatureNavigation < ActiveRecord::Migration[8.0]
  def up
    esign = NavigationItem.find_by(href: "/e-signature")

    if esign
      # Bump items at position 17+ to make room
      NavigationItem.where(parent_id: nil)
                    .where("position >= 17")
                    .update_all("position = position + 1")

      # Promote E-Signature to top-level at position 17 (after Corporate)
      esign.update!(
        parent_id: nil,
        position: 17,
        icon: "PenLine",
        is_active: true
      )

      puts "Promoted E-Signature to top-level navigation (position 17, after Corporate)"
    else
      # Create fresh if not found
      NavigationItem.where(parent_id: nil)
                    .where("position >= 17")
                    .update_all("position = position + 1")

      NavigationItem.create!(
        name: "E-Signature",
        href: "/e-signature",
        icon: "PenLine",
        position: 17,
        is_active: true,
        visible_to_roles: []
      )

      puts "Created E-Signature top-level navigation item (position 17)"
    end
  end

  def down
    esign = NavigationItem.find_by(href: "/e-signature")
    if esign
      missing_nav = NavigationItem.find_by(href: "/missing")
      esign.update!(parent_id: missing_nav&.id, position: 5) if missing_nav

      # Shift items back down
      NavigationItem.where(parent_id: nil)
                    .where("position > 17")
                    .update_all("position = position - 1")
    end
  end
end
