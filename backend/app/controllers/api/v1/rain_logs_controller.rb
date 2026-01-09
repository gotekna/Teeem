module Api
  module V1
    class RainLogsController < ApplicationController
      before_action :set_job
      before_action :set_rain_log, only: [ :show, :update, :destroy ]

      # GET /api/v1/constructions/:job_id/rain_logs
      def index
        @rain_logs = @job.rain_logs.recent.includes(:created_by_user)

        # Optional date range filter
        if params[:start_date].present? && params[:end_date].present?
          @rain_logs = @rain_logs.by_date_range(params[:start_date], params[:end_date])
        end

        # Optional source filter
        if params[:source].present?
          @rain_logs = @rain_logs.where(source: params[:source])
        end

        render json: {
          rain_logs: @rain_logs.as_json(
            include: {
              created_by_user: {}
            }
          )
        }
      end

      # GET /api/v1/constructions/:job_id/rain_logs/:id
      def show
        render json: {
          rain_log: @rain_log.as_json(
            include: {
              created_by_user: {}
            }
          )
        }
      end

      # POST /api/v1/constructions/:job_id/rain_logs
      def create
        @rain_log = @job.rain_logs.build(rain_log_params)
        @rain_log.created_by_user = current_user
        @rain_log.source = "manual"

        # Auto-calculate severity if rainfall_mm is provided
        if @rain_log.rainfall_mm.present?
          @rain_log.severity = RainLog.calculate_severity(@rain_log.rainfall_mm)
        end

        if @rain_log.save
          render json: {
            rain_log: @rain_log.as_json(
              include: {
                created_by_user: {}
              }
            )
          }, status: :created
        else
          render json: { errors: @rain_log.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/constructions/:job_id/rain_logs/:id
      def update
        if @rain_log.update(rain_log_params)
          # Auto-calculate severity if rainfall_mm changed
          if @rain_log.saved_change_to_rainfall_mm?
            @rain_log.auto_calculate_severity!
          end

          render json: {
            rain_log: @rain_log.reload.as_json(
              include: {
                created_by_user: {}
              }
            )
          }
        else
          render json: { errors: @rain_log.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/constructions/:job_id/rain_logs/:id
      def destroy
        @rain_log.destroy
        head :no_content
      end

      # GET /api/v1/jobs/:job_id/rain_logs/weather_status
      # Returns current weather config status and job location
      def weather_status
        api_location = extract_job_location(@job)  # For API calls (coordinates)
        display_loc = display_location(@job)       # For display (human-readable)
        api_configured = ENV["WEATHER_API_KEY"].present?

        render json: {
          api_configured: api_configured,
          job_location: display_loc,               # Show human-readable address
          api_location: api_location,              # Coordinates used for API
          job_has_location: api_location.present?,
          latitude: @job.latitude,
          longitude: @job.longitude,
          address: @job.respond_to?(:address) ? @job.address : nil,
          message: status_message(api_configured, display_loc)
        }
      end

      # POST /api/v1/jobs/:job_id/rain_logs/fetch_weather
      # Manually trigger weather fetch for a specific date
      def fetch_weather
        date = params[:date].present? ? Date.parse(params[:date]) : Date.yesterday

        unless ENV["WEATHER_API_KEY"].present?
          render json: { error: "Weather API not configured. Please set WEATHER_API_KEY." }, status: :service_unavailable
          return
        end

        location = extract_job_location(@job)
        unless location
          render json: { error: "Job has no location set. Please add a location to the job." }, status: :unprocessable_entity
          return
        end

        begin
          weather_client = WeatherApiClient.new
          weather_data = weather_client.fetch_historical(location, date)

          render json: {
            success: true,
            date: date,
            location: location,
            rainfall_mm: weather_data[:rainfall_mm],
            condition: weather_data[:condition],
            max_temp_c: weather_data[:max_temp_c],
            min_temp_c: weather_data[:min_temp_c],
            weather_location: weather_data[:location],
            region: weather_data[:region]
          }
        rescue WeatherApiClient::Error => e
          render json: { error: e.message }, status: :service_unavailable
        rescue ArgumentError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/jobs/:job_id/rain_logs/auto_log
      # Auto-create rain log from weather API for a specific date
      def auto_log
        date = params[:date].present? ? Date.parse(params[:date]) : Date.yesterday

        unless ENV["WEATHER_API_KEY"].present?
          render json: { error: "Weather API not configured" }, status: :service_unavailable
          return
        end

        location = extract_job_location(@job)
        unless location
          render json: { error: "Job has no location set" }, status: :unprocessable_entity
          return
        end

        # Check if log already exists
        existing_log = @job.rain_logs.find_by(date: date)
        if existing_log
          render json: { error: "Rain log already exists for #{date}", existing_log: existing_log }, status: :conflict
          return
        end

        begin
          weather_client = WeatherApiClient.new
          weather_data = weather_client.fetch_historical(location, date)

          rainfall_mm = weather_data[:rainfall_mm]

          if rainfall_mm.nil? || rainfall_mm.zero?
            render json: {
              success: true,
              message: "No rainfall recorded for #{date}",
              rainfall_mm: 0,
              rain_log_created: false
            }
            return
          end

          # Create rain log
          rain_log = @job.rain_logs.create!(
            date: date,
            rainfall_mm: rainfall_mm,
            severity: RainLog.calculate_severity(rainfall_mm),
            source: "automatic",
            weather_api_response: weather_data[:raw_response],
            notes: "Auto-detected: #{weather_data[:condition]} at #{weather_data[:location]}",
            created_by_user: current_user
          )

          render json: {
            success: true,
            message: "Rain log created for #{date}",
            rain_log_created: true,
            rain_log: rain_log.as_json(include: { created_by_user: {} })
          }, status: :created

        rescue WeatherApiClient::Error => e
          render json: { error: e.message }, status: :service_unavailable
        end
      end

      private

      # For weather API: prefer lat/long coordinates (most accurate)
      # The text location field can be incorrectly geocoded
      def extract_job_location(job)
        # Prefer coordinates - they're always more accurate for weather APIs
        return "#{job.latitude},#{job.longitude}" if job.latitude.present? && job.longitude.present?
        # Fall back to address field (user-entered, usually correct)
        return job.address if job.respond_to?(:address) && job.address.present?
        # Last resort: location field (auto-geocoded, may be wrong)
        return job.location if job.location.present?
        nil
      end

      # Human-readable location for display purposes
      def display_location(job)
        # Prefer address (user-entered)
        return job.address if job.respond_to?(:address) && job.address.present?
        # Fall back to location
        return job.location if job.location.present?
        # Last resort: coordinates
        return "#{job.latitude}, #{job.longitude}" if job.latitude.present? && job.longitude.present?
        nil
      end

      def status_message(api_configured, location)
        if !api_configured
          "Weather API not configured. Contact admin to set WEATHER_API_KEY."
        elsif !location
          "Job has no location. Set a location or coordinates in job settings."
        else
          "Weather tracking active for: #{location}"
        end
      end

      def set_job
        @job = Job.find(params[:job_id])
      end

      def set_rain_log
        @rain_log = @job.rain_logs.find(params[:id])
      end

      def rain_log_params
        params.require(:rain_log).permit(
          :date,
          :rainfall_mm,
          :hours_affected,
          :severity,
          :notes
        )
      end
    end
  end
end
