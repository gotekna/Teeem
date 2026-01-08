class AddBoqEntityTab < ActiveRecord::Migration[8.0]
  def up
    # Find the Estimates parent tab (under Estimating section)
    estimates_tab = EntityTab.find_by(tab_key: "estimates")
    return unless estimates_tab

    # Create BOQ tab under Estimates
    EntityTab.find_or_create_by!(tab_key: "boq") do |tab|
      tab.display_name = "BOQ"
      tab.icon_name = "ClipboardList"
      tab.order_position = 38
      tab.parent_id = estimates_tab.id
      tab.enabled = true
      tab.scope = "job"
    end
  end

  def down
    EntityTab.find_by(tab_key: "boq")&.destroy
  end
end
