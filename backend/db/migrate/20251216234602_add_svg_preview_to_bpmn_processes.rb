class AddSvgPreviewToBpmnProcesses < ActiveRecord::Migration[8.0]
  def change
    add_column :bpmn_processes, :svg_preview, :text
  end
end
