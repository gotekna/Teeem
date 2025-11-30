class AddExpiryDatesToDirectorOnboardingRequests < ActiveRecord::Migration[8.0]
  def change
    add_column :director_onboarding_requests, :drivers_licence_expiry, :date
    add_column :director_onboarding_requests, :passport_expiry, :date
  end
end
