class CreateTeeemPresentations < ActiveRecord::Migration[8.0]
  def change
    create_table :teeem_presentations do |t|
      t.timestamps
    end
  end
end
