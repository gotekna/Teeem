class RenameErrorsToOperationErrorsInBatchOperations < ActiveRecord::Migration[8.0]
  def change
    rename_column :batch_operations, :errors, :operation_errors
  end
end
