module Api
  module V1
    class PublicHolidaysController < ApplicationController
      # GET /api/v1/public_holidays
      def index
        region = params[:region]
        year = params[:year]&.to_i

        # When filtering by a state, also include National holidays (they apply to all states)
        holidays = if region.present? && region != "all" && region != "National"
          PublicHoliday.where(region: [region, "National"])
        elsif region == "National"
          PublicHoliday.for_region("National")
        else
          PublicHoliday.all
        end
        holidays = holidays.for_year(year) if year.present?
        holidays = holidays.order(date: :asc)

        render json: {
          holidays: holidays.map { |h| {
            id: h.id,
            name: h.name,
            date: h.date.strftime("%Y-%m-%d"),
            region: h.region
          }}
        }
      end

      # GET /api/v1/public_holidays/dates
      # Returns just array of date strings for Gantt view
      def dates
        region = params[:region]
        year_start = params[:year_start]&.to_i || CorporateCompanySetting.today.year
        year_end = params[:year_end]&.to_i || (CorporateCompanySetting.today.year + 2)

        # When filtering by a state, also include National holidays (they apply to all states)
        base_query = if region.present? && region != "all" && region != "National"
          PublicHoliday.where(region: [region, "National"])
        elsif region == "National"
          PublicHoliday.for_region("National")
        else
          PublicHoliday.all
        end

        dates = base_query
          .where("EXTRACT(YEAR FROM date) BETWEEN ? AND ?", year_start, year_end)
          .pluck(:date)
          .map { |d| d.strftime("%Y-%m-%d") }

        render json: { dates: dates }
      end

      # POST /api/v1/public_holidays
      def create
        holiday = PublicHoliday.new(holiday_params)

        if holiday.save
          render json: {
            id: holiday.id,
            name: holiday.name,
            date: holiday.date.strftime("%Y-%m-%d"),
            region: holiday.region
          }, status: :created
        else
          render json: { errors: holiday.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/public_holidays/:id
      def destroy
        holiday = PublicHoliday.find(params[:id])
        holiday.destroy
        head :no_content
      end

      private

      def holiday_params
        params.require(:public_holiday).permit(:name, :date, :region)
      end
    end
  end
end
