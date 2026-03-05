class RenamePropertiesNavAndAddJobId < ActiveRecord::Migration[8.0]
  def up
    # 1. Rename navigation item
    if defined?(NavigationItem)
      NavigationItem.find_by(href: "/properties")&.update!(name: "Property Management")
    end

    # 2. Add job_id to properties (track source job for "Convert from Job" flow)
    add_reference :properties, :job, foreign_key: true, null: true
  end

  def down
    remove_reference :properties, :job

    if defined?(NavigationItem)
      NavigationItem.find_by(href: "/properties")&.update!(name: "Properties")
    end
  end
end
