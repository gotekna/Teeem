class AddTakeoffRoomSlotToMeasurements < ActiveRecord::Migration[7.2]
  def change
    add_reference :unreal_measurements, :takeoff_room_slot, null: true, foreign_key: true
  end
end
