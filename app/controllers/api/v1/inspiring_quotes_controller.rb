module Api
  module V1
    class InspiringQuotesController < ApplicationController
      before_action :set_inspiring_quote, only: [ :show, :update, :destroy ]

      # GET /api/v1/inspiring_quotes
      def index
        quotes = InspiringQuote.ordered
        quotes = quotes.active if params[:active_only] == "true"

        render json: {
          success: true,
          data: quotes.map { |q| serialize_quote(q) }
        }
      end

      # GET /api/v1/inspiring_quotes/daily
      def daily
        quote = InspiringQuote.daily_quote

        if quote
          render json: {
            success: true,
            data: serialize_quote(quote)
          }
        else
          render json: {
            success: false,
            message: "No active quotes available"
          }, status: :not_found
        end
      end

      # GET /api/v1/inspiring_quotes/random
      def random
        quote = InspiringQuote.random_active

        if quote
          render json: {
            success: true,
            data: serialize_quote(quote)
          }
        else
          render json: {
            success: false,
            message: "No active quotes available"
          }, status: :not_found
        end
      end

      # GET /api/v1/inspiring_quotes/:id
      def show
        render json: {
          success: true,
          data: serialize_quote(@inspiring_quote)
        }
      end

      # POST /api/v1/inspiring_quotes
      def create
        quote = InspiringQuote.new(inspiring_quote_params)

        if quote.save
          render json: {
            success: true,
            data: serialize_quote(quote),
            message: "Quote created successfully"
          }, status: :created
        else
          render json: {
            success: false,
            errors: quote.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PUT /api/v1/inspiring_quotes/:id
      def update
        if @inspiring_quote.update(inspiring_quote_params)
          render json: {
            success: true,
            data: serialize_quote(@inspiring_quote),
            message: "Quote updated successfully"
          }
        else
          render json: {
            success: false,
            errors: @inspiring_quote.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/inspiring_quotes/:id
      def destroy
        @inspiring_quote.destroy
        render json: {
          success: true,
          message: "Quote deleted successfully"
        }
      end

      private

      def set_inspiring_quote
        @inspiring_quote = InspiringQuote.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          message: "Quote not found"
        }, status: :not_found
      end

      def inspiring_quote_params
        params.require(:inspiring_quote).permit(
          :quote,
          :author,
          :category,
          :aussie_slang,
          :is_active,
          :display_order
        )
      end

      def serialize_quote(quote)
        {
          id: quote.id,
          quote: quote.aussie_slang || quote.quote,
          original_quote: quote.quote,
          author: quote.author,
          category: quote.category,
          is_active: quote.is_active,
          display_order: quote.display_order,
          aussie_slang: quote.aussie_slang,
          created_at: quote.created_at,
          updated_at: quote.updated_at
        }
      end
    end
  end
end
