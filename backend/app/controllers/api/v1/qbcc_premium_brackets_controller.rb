# frozen_string_literal: true

module Api
  module V1
    class QbccPremiumBracketsController < ApplicationController
      before_action :set_bracket, only: [:update, :destroy]

      # GET /api/v1/qbcc_premium_brackets
      def index
        brackets = QbccPremiumBracket.order(:category, :min_value)

        render json: {
          success: true,
          brackets: brackets.map { |b| bracket_to_json(b) }
        }
      end

      # POST /api/v1/qbcc_premium_brackets
      def create
        bracket = QbccPremiumBracket.new(bracket_params)

        if bracket.save
          render json: { success: true, bracket: bracket_to_json(bracket) }, status: :created
        else
          render_error(bracket.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      # PATCH /api/v1/qbcc_premium_brackets/:id
      def update
        if @bracket.update(bracket_params)
          render json: { success: true, bracket: bracket_to_json(@bracket) }
        else
          render_error(@bracket.errors.full_messages.join(", "), status: :unprocessable_entity)
        end
      end

      # DELETE /api/v1/qbcc_premium_brackets/:id
      def destroy
        @bracket.destroy!
        render json: { success: true }
      end

      # POST /api/v1/qbcc_premium_brackets/bulk_import
      def bulk_import
        rows = params[:brackets]
        return render_error("No brackets provided", status: :unprocessable_entity) if rows.blank?

        category = params[:category] || "new_home"

        ActiveRecord::Base.transaction do
          # Clear existing brackets for this category
          QbccPremiumBracket.where(category: category).delete_all

          rows.each_with_index do |row, idx|
            QbccPremiumBracket.create!(
              category: category,
              min_value: row[:minValue] || row[:min_value],
              max_value: row[:maxValue] || row[:max_value],
              premium: row[:premium],
              rate_per_thousand: row[:ratePerThousand] || row[:rate_per_thousand],
              sort_order: idx
            )
          end
        end

        brackets = QbccPremiumBracket.where(category: category).order(:min_value)
        render json: {
          success: true,
          brackets: brackets.map { |b| bracket_to_json(b) },
          imported: brackets.count
        }
      rescue ActiveRecord::RecordInvalid => e
        render_error(e.message, status: :unprocessable_entity)
      end

      # POST /api/v1/qbcc_premium_brackets/lookup
      def lookup
        value = params[:insurable_value].to_f
        category = params[:category] || "new_home"

        premium = QbccPremiumBracket.lookup_premium(value, category: category)

        render json: {
          success: true,
          insurableValue: value,
          category: category,
          premium: premium
        }
      end

      private

      def set_bracket
        @bracket = QbccPremiumBracket.find(params[:id])
      end

      def bracket_params
        params.require(:bracket).permit(
          :category, :min_value, :max_value, :premium, :rate_per_thousand, :sort_order
        )
      end

      def bracket_to_json(bracket)
        {
          id: bracket.id,
          category: bracket.category,
          minValue: bracket.min_value&.to_f,
          maxValue: bracket.max_value&.to_f,
          premium: bracket.premium&.to_f,
          ratePerThousand: bracket.rate_per_thousand&.to_f,
          sortOrder: bracket.sort_order
        }
      end
    end
  end
end
