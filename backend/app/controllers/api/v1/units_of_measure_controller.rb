module Api
  module V1
    class UnitsOfMeasureController < ApplicationController
      # GET /api/v1/units_of_measure
      # Returns active units for dropdown selection
      def index
        units = UnitOfMeasure.for_dropdown

        render json: {
          success: true,
          units: units.map { |u| { id: u.id, code: u.code, name: u.name } }
        }
      end
    end
  end
end
