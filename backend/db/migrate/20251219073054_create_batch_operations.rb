class CreateBatchOperations < ActiveRecord::Migration[8.0]
  def change
    create_table :batch_operations do |t|
      t.timestamps
    end
  end
end
