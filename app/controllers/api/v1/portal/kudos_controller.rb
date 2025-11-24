module Api
  module V1
    module Portal
      class KudosController < BaseController
        before_action :require_subcontractor

        # GET /api/v1/portal/kudos
        # Get kudos score and breakdown for logged-in subcontractor
        def index
          account = current_subcontractor_account

          unless account
            render json: { success: false, error: 'No subcontractor account found' }, status: :not_found
            return
          end

          data = {
            kudos_score: account.kudos_score,
            tier: calculate_tier(account.kudos_score),
            tier_progress: calculate_tier_progress(account.kudos_score),
            next_tier: next_tier(account.kudos_score),
            points_to_next_tier: points_to_next_tier(account.kudos_score),
            breakdown: account.kudos_breakdown,
            total_events: account.kudos_events.count,
            recent_events: account.kudos_events.order(created_at: :desc).limit(10).map { |event| kudos_event_json(event) },
            statistics: {
              total_jobs_completed: account.jobs_completed_count,
              on_time_arrivals: account.kudos_events.where(event_type: 'arrival').where('points_awarded > 0').count,
              on_time_completions: account.kudos_events.where(event_type: 'completion').where('points_awarded > 0').count,
              fast_quote_responses: account.kudos_events.where(event_type: 'quote_response').where('points_awarded >= 75').count,
              average_response_time_hours: calculate_average_response_time
            }
          }

          render json: { success: true, data: data }
        end

        # GET /api/v1/portal/kudos/leaderboard
        # Get kudos leaderboard
        def leaderboard
          # Get all subcontractor accounts ordered by kudos score
          accounts = SubcontractorAccount.where(active: true)
                                        .where('kudos_score > 0')
                                        .order(kudos_score: :desc)
                                        .limit(100)

          # Find current user's rank
          current_rank = SubcontractorAccount.where(active: true)
                                            .where('kudos_score > ?', current_subcontractor_account.kudos_score)
                                            .count + 1

          data = {
            leaderboard: accounts.map.with_index(1) { |account, index| leaderboard_entry(account, index) },
            my_rank: current_rank,
            my_score: current_subcontractor_account.kudos_score,
            total_subcontractors: SubcontractorAccount.where(active: true).count,
            top_10_threshold: accounts[9]&.kudos_score || 0,
            month: Date.current.strftime('%B %Y')
          }

          render json: { success: true, data: data }
        end

        # GET /api/v1/portal/kudos/events
        # Get paginated kudos events history
        def events
          page = (params[:page] || 1).to_i
          per_page = (params[:per_page] || 20).to_i

          events = current_subcontractor_account.kudos_events
                                                .order(created_at: :desc)
                                                .offset((page - 1) * per_page)
                                                .limit(per_page)

          total_count = current_subcontractor_account.kudos_events.count
          total_pages = (total_count.to_f / per_page).ceil

          data = {
            events: events.map { |event| kudos_event_json(event) },
            pagination: {
              current_page: page,
              per_page: per_page,
              total_count: total_count,
              total_pages: total_pages,
              has_next_page: page < total_pages,
              has_previous_page: page > 1
            }
          }

          render json: { success: true, data: data }
        end

        # GET /api/v1/portal/kudos/trends
        # Get kudos score trends over time
        def trends
          days = (params[:days] || 30).to_i
          days = [[days, 1].max, 365].min # Clamp between 1 and 365

          start_date = days.days.ago.beginning_of_day

          # Get events grouped by day
          events_by_day = current_subcontractor_account.kudos_events
                                                       .where('created_at >= ?', start_date)
                                                       .group_by { |e| e.created_at.to_date }

          # Calculate cumulative score over time
          trends_data = []
          cumulative_points = 0

          (start_date.to_date..Date.current).each do |date|
            day_events = events_by_day[date] || []
            day_points = day_events.sum(&:points_awarded)
            cumulative_points += day_points

            trends_data << {
              date: date,
              points_earned: day_points,
              cumulative_score: cumulative_points,
              events_count: day_events.count,
              event_types: day_events.group_by(&:event_type).transform_values(&:count)
            }
          end

          data = {
            trends: trends_data,
            period_start: start_date.to_date,
            period_end: Date.current,
            total_points_earned: cumulative_points,
            average_daily_points: cumulative_points.to_f / days
          }

          render json: { success: true, data: data }
        end

        # POST /api/v1/portal/kudos/recalculate
        # Manually trigger kudos recalculation
        def recalculate
          account = current_subcontractor_account

          old_score = account.kudos_score
          account.recalculate_kudos_score!
          new_score = account.kudos_score

          render json: {
            success: true,
            message: 'Kudos score recalculated',
            data: {
              old_score: old_score,
              new_score: new_score,
              change: new_score - old_score,
              breakdown: account.kudos_breakdown
            }
          }
        end

        private

        def kudos_event_json(event)
          {
            id: event.id,
            event_type: event.event_type,
            points_awarded: event.points_awarded,
            expected_time: event.expected_time,
            actual_time: event.actual_time,
            created_at: event.created_at,
            job: event.purchase_order ? {
              id: event.purchase_order.id,
              po_number: event.purchase_order.po_number,
              construction_name: event.purchase_order.construction.job_name
            } : nil,
            quote: event.quote_response ? {
              id: event.quote_response.id,
              price: event.quote_response.price
            } : nil,
            performance_rating: calculate_performance_rating(event)
          }
        end

        def leaderboard_entry(account, rank)
          {
            rank: rank,
            subcontractor_name: account.portal_user.contact.display_name,
            company_name: account.portal_user.contact.company_name,
            kudos_score: account.kudos_score,
            tier: calculate_tier(account.kudos_score),
            jobs_completed: account.jobs_completed_count,
            is_me: account.id == current_subcontractor_account.id
          }
        end

        def calculate_tier(score)
          case score
          when 0...100
            'bronze'
          when 100...300
            'silver'
          when 300...600
            'gold'
          when 600...900
            'platinum'
          else
            'diamond'
          end
        end

        def calculate_tier_progress(score)
          tier_ranges = {
            'bronze' => [0, 100],
            'silver' => [100, 300],
            'gold' => [300, 600],
            'platinum' => [600, 900],
            'diamond' => [900, 1000]
          }

          current_tier = calculate_tier(score)
          range = tier_ranges[current_tier]
          tier_min, tier_max = range

          return 100 if current_tier == 'diamond' && score >= 1000

          ((score - tier_min).to_f / (tier_max - tier_min) * 100).round(1)
        end

        def next_tier(score)
          case calculate_tier(score)
          when 'bronze' then 'silver'
          when 'silver' then 'gold'
          when 'gold' then 'platinum'
          when 'platinum' then 'diamond'
          when 'diamond' then nil
          end
        end

        def points_to_next_tier(score)
          case calculate_tier(score)
          when 'bronze' then 100 - score
          when 'silver' then 300 - score
          when 'gold' then 600 - score
          when 'platinum' then 900 - score
          when 'diamond' then 0
          end
        end

        def calculate_performance_rating(event)
          return 'neutral' if event.points_awarded == 0

          case event.event_type
          when 'quote_response'
            event.points_awarded >= 75 ? 'excellent' : 'good'
          when 'arrival', 'completion'
            if event.points_awarded >= 100
              'excellent'
            elsif event.points_awarded >= 50
              'good'
            elsif event.points_awarded > 0
              'fair'
            else
              'poor'
            end
          else
            'neutral'
          end
        end

        def calculate_average_response_time
          quote_events = current_subcontractor_account.kudos_events
                                                      .where(event_type: 'quote_response')
                                                      .where.not(expected_time: nil, actual_time: nil)

          return 0 if quote_events.empty?

          total_hours = quote_events.sum do |event|
            (event.actual_time - event.expected_time) / 1.hour
          end

          (total_hours / quote_events.count).round(1)
        end
      end
    end
  end
end
