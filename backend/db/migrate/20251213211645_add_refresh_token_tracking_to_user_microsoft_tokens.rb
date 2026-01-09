class AddRefreshTokenTrackingToUserMicrosoftTokens < ActiveRecord::Migration[8.0]
  def change
    add_column :user_microsoft_tokens, :refresh_token_dead, :boolean, default: false, null: false
    add_column :user_microsoft_tokens, :consecutive_failures, :integer, default: 0, null: false
    add_column :user_microsoft_tokens, :last_refresh_attempt_at, :datetime
  end
end
