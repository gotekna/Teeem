# frozen_string_literal: true

class CreateAiServiceConfigs < ActiveRecord::Migration[8.0]
  def change
    create_table :ai_service_configs do |t|
      t.string :service_type, null: false
      t.string :display_name, null: false
      t.boolean :ocr_enabled, default: true
      t.integer :ai_threshold, default: 80
      t.string :ai_model, default: "sonnet"
      t.boolean :ai_always, default: false
      t.boolean :active, default: true
      t.jsonb :extra_config, default: {}

      t.timestamps

      t.index :service_type, unique: true
    end
  end
end
