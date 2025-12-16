class AddColorToJobTypes < ActiveRecord::Migration[8.0]
  def change
    add_column :job_types, :color, :string, default: "#6366F1"
  end
end
