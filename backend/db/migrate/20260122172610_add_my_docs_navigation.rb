# frozen_string_literal: true

class AddMyDocsNavigation < ActiveRecord::Migration[8.0]
  def up
    # Shift items at position >= 15 down by 1 to make room for My Docs
    NavigationItem.where(parent_id: nil)
                  .where("position >= 15")
                  .order(position: :desc)
                  .each do |item|
      item.update!(position: item.position + 1)
    end

    # Insert Teeem Docs after Documents (position 14)
    # Uses FolderHeart icon to distinguish from Documents (FolderOpen)
    NavigationItem.create!(
      name: "Teeem Docs",
      href: "/my-docs",
      icon: "FolderHeart",
      position: 15,
      is_active: true,
      visible_to_roles: []  # Visible to all authenticated users
    )
  end

  def down
    NavigationItem.find_by(href: "/my-docs")&.destroy

    # Shift items back up
    NavigationItem.where(parent_id: nil)
                  .where("position > 15")
                  .order(:position)
                  .each do |item|
      item.update!(position: item.position - 1)
    end
  end
end
