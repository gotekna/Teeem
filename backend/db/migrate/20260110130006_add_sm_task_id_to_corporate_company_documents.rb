class AddSmTaskIdToCorporateCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_reference :corporate_documents, :sm_task,
                  null: true,
                  foreign_key: { to_table: :sm_tasks },
                  index: true
  end
end
