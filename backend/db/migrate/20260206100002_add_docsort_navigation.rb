# frozen_string_literal: true

class AddDocsortNavigation < ActiveRecord::Migration[8.0]
  def up
    # Insert DocSort after Email (position 2) - it's a document inbox/workflow feature
    # Use position 2.5 (will be normalized to 3) and shift others down

    # Shift items at position >= 3 down by 1 to make room
    NavigationItem.where(parent_id: nil)
                  .where("position >= 3 AND position < 99") # Don't shift Missing section
                  .order(position: :desc)
                  .each do |item|
      item.update_column(:position, item.position + 1)
    end

    # Insert DocSort after Email
    NavigationItem.create!(
      name: "DocSort",
      href: "/docsort",
      icon: "Inbox",  # From lucide-react - represents inbox/sorting
      position: 3,
      is_active: true,
      visible_to_roles: ["admin"]  # Admin only initially, can open up later
    )
  end

  def down
    NavigationItem.find_by(href: "/docsort")&.destroy

    # Shift items back up
    NavigationItem.where(parent_id: nil)
                  .where("position > 3 AND position < 99")
                  .order(:position)
                  .each do |item|
      item.update_column(:position, item.position - 1)
    end
  end
end
