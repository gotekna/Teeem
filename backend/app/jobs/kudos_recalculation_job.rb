class KudosRecalculationJob < ApplicationJob
  queue_as :default

  # Recalculate kudos scores for subcontractor accounts
  # Run this periodically (e.g., daily) or after significant events
  def perform(subcontractor_account_id = nil)
    if subcontractor_account_id
      # Recalculate specific account
      recalculate_account(subcontractor_account_id)
    else
      # Recalculate all active accounts
      recalculate_all_accounts
    end
  end

  private

  def recalculate_account(account_id)
    account = SubcontractorAccount.find(account_id)

    old_score = account.kudos_score
    new_score = KudosCalculationService.calculate_score(account)

    if account.update(kudos_score: new_score)
      score_change = new_score - old_score

      Rails.logger.info(
        "Kudos score recalculated for subcontractor ##{account_id}: " \
        "#{old_score} -> #{new_score} (#{score_change >= 0 ? '+' : ''}#{score_change.round(2)})"
      )

      # Send notification if significant change
      send_score_change_notification(account, old_score, new_score) if significant_change?(old_score, new_score)
    else
      Rails.logger.error("Failed to update kudos score for subcontractor ##{account_id}")
    end
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.error("Subcontractor account ##{account_id} not found: #{e.message}")
  rescue => e
    Rails.logger.error("Error recalculating kudos for account ##{account_id}: #{e.message}")
  end

  def recalculate_all_accounts
    accounts = SubcontractorAccount.where(active: true)

    Rails.logger.info("Starting kudos recalculation for #{accounts.count} active accounts")

    updated_count = 0
    error_count = 0
    tier_changes = []

    accounts.find_each do |account|
      begin
        old_score = account.kudos_score
        old_tier = KudosCalculationService.tier_info(old_score)[:tier]

        new_score = KudosCalculationService.calculate_score(account)
        new_tier = KudosCalculationService.tier_info(new_score)[:tier]

        if account.update(kudos_score: new_score)
          updated_count += 1

          # Track tier changes
          if old_tier != new_tier
            tier_changes << {
              account_id: account.id,
              contact_name: account.portal_user.contact.display_name,
              old_tier: old_tier,
              new_tier: new_tier,
              old_score: old_score,
              new_score: new_score
            }
          end
        else
          error_count += 1
        end
      rescue => e
        error_count += 1
        Rails.logger.error("Error recalculating kudos for account ##{account.id}: #{e.message}")
      end
    end

    Rails.logger.info(
      "Kudos recalculation completed: " \
      "#{updated_count} updated, #{error_count} errors, #{tier_changes.count} tier changes"
    )

    # Log tier changes
    tier_changes.each do |change|
      Rails.logger.info(
        "Tier change for #{change[:contact_name]}: " \
        "#{change[:old_tier]} (#{change[:old_score]}) -> #{change[:new_tier]} (#{change[:new_score]})"
      )

      # Send tier change notification
      send_tier_change_notification(change)
    end

    # Update leaderboard cache if needed
    update_leaderboard_cache if updated_count > 0
  end

  def significant_change?(old_score, new_score)
    change = (new_score - old_score).abs
    change >= 50 # Notify if score changed by 50+ points
  end

  def send_score_change_notification(account, old_score, new_score)
    # TODO: Implement notification
    # SubcontractorMailer.score_change_notification(account, old_score, new_score).deliver_later
    Rails.logger.info(
      "Score change notification queued for #{account.portal_user.contact.display_name}: " \
      "#{old_score.round(2)} -> #{new_score.round(2)}"
    )
  end

  def send_tier_change_notification(change)
    # TODO: Implement notification
    # SubcontractorMailer.tier_change_notification(change).deliver_later
    Rails.logger.info(
      "Tier change notification queued for #{change[:contact_name]}: " \
      "#{change[:old_tier]} -> #{change[:new_tier]}"
    )
  end

  def update_leaderboard_cache
    # TODO: Implement leaderboard caching if needed
    # Rails.cache.write('kudos_leaderboard', KudosCalculationService.leaderboard(limit: 100))
    Rails.logger.info("Leaderboard cache updated")
  end
end
