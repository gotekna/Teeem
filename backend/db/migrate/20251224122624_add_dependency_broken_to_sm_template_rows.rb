class AddDependencyBrokenToSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_template_rows, :dependency_broken, :boolean
  end
end
