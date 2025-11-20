class KudosCalculationService
  # Scoring constants
  HALF_LIFE_DAYS = 90.0 # Events decay to 50% weight after 90 days
  MAX_KUDOS_SCORE = 1000.0
  MAX_EVENTS_FOR_CALCULATION = 50 # Only consider last 50 events

  # Point values for different event types
  QUOTE_RESPONSE_POINTS = {
    within_2_hours: 100,
    within_6_hours: 75,
    within_24_hours: 50,
    within_48_hours: 25,
    after_48_hours: 10
  }.freeze

  ARRIVAL_POINTS = {
    early_or_ontime: 100,
    within_30_min: 75,
    within_1_hour: 50,
    within_2_hours: 25,
    late_more_than_2_hours: -50
  }.freeze

  COMPLETION_POINTS = {
    early_or_ontime: 100,
    within_1_day: 75,
    within_2_days: 50,
    within_3_days: 25,
    late_more_than_3_days: -50
  }.freeze

  # Calculate kudos score for a subcontractor account
  def self.calculate_score(subcontractor_account)
    events = subcontractor_account.kudos_events
                                  .order(created_at: :desc)
                                  .limit(MAX_EVENTS_FOR_CALCULATION)

    return 0.0 if events.empty?

    # Calculate weighted score with exponential decay
    weighted_score = events.sum do |event|
      age_days = (Time.current - event.created_at) / 1.day
      decay_factor = calculate_decay_factor(age_days)
      event.points_awarded * decay_factor
    end

    # Normalize to 0-1000 scale
    normalized_score = [[weighted_score, 0].max, MAX_KUDOS_SCORE].min
    normalized_score.round(2)
  end

  # Calculate points for quote response based on speed
  def self.calculate_quote_response_points(response_time_hours)
    case response_time_hours
    when 0..2
      QUOTE_RESPONSE_POINTS[:within_2_hours]
    when 2..6
      QUOTE_RESPONSE_POINTS[:within_6_hours]
    when 6..24
      QUOTE_RESPONSE_POINTS[:within_24_hours]
    when 24..48
      QUOTE_RESPONSE_POINTS[:within_48_hours]
    else
      QUOTE_RESPONSE_POINTS[:after_48_hours]
    end
  end

  # Calculate points for arrival timeliness
  def self.calculate_arrival_points(expected_time, actual_time)
    return 0 if expected_time.nil? || actual_time.nil?

    difference_minutes = ((actual_time - expected_time) / 60).round

    case difference_minutes
    when -Float::INFINITY..0
      ARRIVAL_POINTS[:early_or_ontime]
    when 0..30
      ARRIVAL_POINTS[:within_30_min]
    when 30..60
      ARRIVAL_POINTS[:within_1_hour]
    when 60..120
      ARRIVAL_POINTS[:within_2_hours]
    else
      ARRIVAL_POINTS[:late_more_than_2_hours]
    end
  end

  # Calculate points for completion timeliness
  def self.calculate_completion_points(expected_time, actual_time)
    return 0 if expected_time.nil? || actual_time.nil?

    difference_days = ((actual_time - expected_time) / 1.day).round(1)

    case difference_days
    when -Float::INFINITY..0
      COMPLETION_POINTS[:early_or_ontime]
    when 0..1
      COMPLETION_POINTS[:within_1_day]
    when 1..2
      COMPLETION_POINTS[:within_2_days]
    when 2..3
      COMPLETION_POINTS[:within_3_days]
    else
      COMPLETION_POINTS[:late_more_than_3_days]
    end
  end

  # Get kudos breakdown by event type
  def self.score_breakdown(subcontractor_account)
    events = subcontractor_account.kudos_events
                                  .order(created_at: :desc)
                                  .limit(MAX_EVENTS_FOR_CALCULATION)

    breakdown = events.group_by(&:event_type).transform_values do |type_events|
      weighted_points = type_events.sum do |event|
        age_days = (Time.current - event.created_at) / 1.day
        decay_factor = calculate_decay_factor(age_days)
        event.points_awarded * decay_factor
      end

      {
        total_events: type_events.count,
        weighted_points: weighted_points.round(2),
        average_points: (weighted_points / [type_events.count, 1].max).round(2),
        recent_events: type_events.first(5).map { |e| event_summary(e) }
      }
    end

    breakdown
  end

  # Recalculate scores for all active subcontractor accounts
  def self.recalculate_all_scores
    SubcontractorAccount.where(active: true).find_each do |account|
      new_score = calculate_score(account)
      account.update_column(:kudos_score, new_score)
    end
  end

  # Get tier information for a score
  def self.tier_info(score)
    tier = case score
           when 0...100 then 'bronze'
           when 100...300 then 'silver'
           when 300...600 then 'gold'
           when 600...900 then 'platinum'
           else 'diamond'
           end

    tier_ranges = {
      'bronze' => { min: 0, max: 100, color: '#CD7F32' },
      'silver' => { min: 100, max: 300, color: '#C0C0C0' },
      'gold' => { min: 300, max: 600, color: '#FFD700' },
      'platinum' => { min: 600, max: 900, color: '#E5E4E2' },
      'diamond' => { min: 900, max: 1000, color: '#B9F2FF' }
    }

    range = tier_ranges[tier]
    progress = ((score - range[:min]).to_f / (range[:max] - range[:min]) * 100).round(1)
    progress = [progress, 100].min # Cap at 100%

    {
      tier: tier,
      tier_name: tier.capitalize,
      score: score,
      min_score: range[:min],
      max_score: range[:max],
      progress_percent: progress,
      color: range[:color],
      next_tier: next_tier(tier),
      points_to_next_tier: next_tier(tier) ? tier_ranges[next_tier(tier)][:min] - score : 0
    }
  end

  # Get leaderboard data
  def self.leaderboard(limit: 100)
    SubcontractorAccount.where(active: true)
                        .where('kudos_score > 0')
                        .order(kudos_score: :desc)
                        .limit(limit)
                        .map.with_index(1) do |account, rank|
      {
        rank: rank,
        contact_id: account.portal_user.contact_id,
        contact_name: account.portal_user.contact.display_name,
        company_name: account.portal_user.contact.company_name,
        kudos_score: account.kudos_score,
        tier: tier_info(account.kudos_score)[:tier],
        jobs_completed: account.jobs_completed_count
      }
    end
  end

  # Get rank for a specific subcontractor
  def self.get_rank(subcontractor_account)
    SubcontractorAccount.where(active: true)
                        .where('kudos_score > ?', subcontractor_account.kudos_score)
                        .count + 1
  end

  # Calculate monthly kudos trend
  def self.monthly_trend(subcontractor_account, months: 6)
    start_date = months.months.ago.beginning_of_month

    events_by_month = subcontractor_account.kudos_events
                                           .where('created_at >= ?', start_date)
                                           .group_by { |e| e.created_at.beginning_of_month }

    trend_data = []
    current_date = start_date

    while current_date <= Time.current.beginning_of_month
      month_events = events_by_month[current_date] || []
      total_points = month_events.sum(&:points_awarded)

      trend_data << {
        month: current_date.strftime('%B %Y'),
        total_events: month_events.count,
        total_points: total_points,
        average_points_per_event: month_events.any? ? (total_points.to_f / month_events.count).round(2) : 0,
        event_breakdown: month_events.group_by(&:event_type).transform_values(&:count)
      }

      current_date += 1.month
    end

    trend_data
  end

  # Get performance insights
  def self.performance_insights(subcontractor_account)
    events = subcontractor_account.kudos_events.order(created_at: :desc).limit(MAX_EVENTS_FOR_CALCULATION)

    {
      total_events: events.count,
      average_points_per_event: events.any? ? (events.sum(&:points_awarded).to_f / events.count).round(2) : 0,
      positive_events: events.count { |e| e.points_awarded > 0 },
      negative_events: events.count { |e| e.points_awarded < 0 },
      perfect_score_events: events.count { |e| e.points_awarded >= 100 },
      strengths: identify_strengths(events),
      areas_for_improvement: identify_areas_for_improvement(events),
      recent_trend: recent_trend(events)
    }
  end

  private

  # Calculate exponential decay factor based on event age
  def self.calculate_decay_factor(age_days)
    Math.exp(-age_days / HALF_LIFE_DAYS)
  end

  def self.next_tier(current_tier)
    tiers = %w[bronze silver gold platinum diamond]
    current_index = tiers.index(current_tier)
    current_index && current_index < tiers.length - 1 ? tiers[current_index + 1] : nil
  end

  def self.event_summary(event)
    {
      date: event.created_at,
      type: event.event_type,
      points: event.points_awarded,
      age_days: ((Time.current - event.created_at) / 1.day).round
    }
  end

  def self.identify_strengths(events)
    strengths = []

    # Analyze by event type
    by_type = events.group_by(&:event_type)

    by_type.each do |type, type_events|
      avg_points = type_events.sum(&:points_awarded).to_f / type_events.count
      if avg_points >= 75
        strengths << {
          area: type.humanize,
          average_score: avg_points.round(2),
          description: strength_description(type, avg_points)
        }
      end
    end

    strengths
  end

  def self.identify_areas_for_improvement(events)
    areas = []

    # Analyze by event type
    by_type = events.group_by(&:event_type)

    by_type.each do |type, type_events|
      avg_points = type_events.sum(&:points_awarded).to_f / type_events.count
      if avg_points < 50
        areas << {
          area: type.humanize,
          average_score: avg_points.round(2),
          description: improvement_description(type, avg_points)
        }
      end
    end

    areas
  end

  def self.recent_trend(events)
    return 'insufficient_data' if events.count < 10

    recent_events = events.first(10)
    older_events = events.offset(10).limit(10)

    return 'insufficient_data' if older_events.empty?

    recent_avg = recent_events.sum(&:points_awarded).to_f / recent_events.count
    older_avg = older_events.sum(&:points_awarded).to_f / older_events.count

    if recent_avg > older_avg * 1.1
      'improving'
    elsif recent_avg < older_avg * 0.9
      'declining'
    else
      'stable'
    end
  end

  def self.strength_description(event_type, avg_points)
    case event_type
    when 'quote_response'
      'Consistently provides fast quote responses'
    when 'arrival'
      'Excellent punctuality for job arrivals'
    when 'completion'
      'Consistently completes jobs on time or early'
    else
      'Strong performance in this area'
    end
  end

  def self.improvement_description(event_type, avg_points)
    case event_type
    when 'quote_response'
      'Consider responding to quote requests more quickly'
    when 'arrival'
      'Focus on arriving on time for scheduled jobs'
    when 'completion'
      'Work on completing jobs by the expected date'
    else
      'Room for improvement in this area'
    end
  end
end
