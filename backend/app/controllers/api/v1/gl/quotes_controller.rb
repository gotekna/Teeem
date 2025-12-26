# frozen_string_literal: true

module Api
  module V1
    module Gl
      # Controller for sales quotes
      class QuotesController < ApplicationController
        before_action :set_corporate_company
        before_action :set_quote, only: [:show, :update, :destroy, :send_quote, :accept, :reject, :convert, :duplicate]

        # GET /api/v1/gl/quotes
        def index
          quotes = @corporate_company.gl_quotes
                                     .includes(:contact, :job, :lines)
                                     .order(created_at: :desc)

          quotes = quotes.where(status: params[:status]) if params[:status].present?
          quotes = quotes.where(contact_id: params[:contact_id]) if params[:contact_id].present?

          render json: { success: true, data: quotes.as_json(include: [:contact, :job]) }
        end

        # GET /api/v1/gl/quotes/:id
        def show
          render json: {
            success: true,
            data: @quote.as_json(
              include: {
                contact: {},
                job: {},
                lines: { include: :pricebook_item },
                versions: {}
              }
            )
          }
        end

        # POST /api/v1/gl/quotes
        def create
          @quote = @corporate_company.gl_quotes.build(quote_params)
          @quote.created_by = current_user
          @quote.quote_date ||= Date.current
          @quote.expiry_date ||= Date.current + 30.days

          if @quote.save
            @quote.create_version!("Quote created")
            render json: { success: true, data: @quote }, status: :created
          else
            render json: { success: false, error: @quote.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # PATCH/PUT /api/v1/gl/quotes/:id
        def update
          if @quote.update(quote_params)
            @quote.calculate_totals
            @quote.save!
            render json: { success: true, data: @quote }
          else
            render json: { success: false, error: @quote.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/quotes/:id
        def destroy
          if @quote.status == "converted"
            render json: { success: false, error: "Cannot delete converted quote" }, status: :unprocessable_entity
            return
          end

          @quote.destroy
          render json: { success: true, message: "Quote deleted" }
        end

        # POST /api/v1/gl/quotes/:id/send
        def send_quote
          if @quote.send_to_customer!
            # TODO: Send email notification
            render json: { success: true, data: @quote, message: "Quote sent to customer" }
          else
            render json: { success: false, error: "Quote must be in draft status" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/quotes/:id/accept
        def accept
          signature = params[:signature]
          ip = request.remote_ip

          if @quote.accept!(signature: signature, ip: ip)
            render json: { success: true, data: @quote, message: "Quote accepted" }
          else
            render json: { success: false, error: "Quote cannot be accepted" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/quotes/:id/reject
        def reject
          reason = params[:reason]

          if @quote.reject!(reason)
            render json: { success: true, data: @quote, message: "Quote rejected" }
          else
            render json: { success: false, error: "Quote cannot be rejected" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/quotes/:id/convert
        def convert
          invoice = @quote.convert_to_invoice!

          if invoice
            render json: {
              success: true,
              data: { quote: @quote, invoice: invoice },
              message: "Quote converted to invoice"
            }
          else
            render json: { success: false, error: "Quote must be accepted before conversion" },
                   status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/quotes/:id/duplicate
        def duplicate
          new_quote = @quote.duplicate!
          render json: { success: true, data: new_quote, message: "Quote duplicated" }, status: :created
        end

        # POST /api/v1/gl/quotes/:id/add_line
        def add_line
          @quote = @corporate_company.gl_quotes.find(params[:id])
          line = @quote.lines.build(line_params)
          line.sort_order = @quote.lines.maximum(:sort_order).to_i + 1

          if line.save
            @quote.calculate_totals
            @quote.save!
            render json: { success: true, data: line }
          else
            render json: { success: false, error: line.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/quotes/:id/add_from_pricebook
        def add_from_pricebook
          @quote = @corporate_company.gl_quotes.find(params[:id])
          item = Pricebook.find(params[:pricebook_item_id])
          quantity = params[:quantity]&.to_d || 1

          line = ::Gl::QuoteLine.from_pricebook(item, quantity: quantity)
          line.quote = @quote
          line.sort_order = @quote.lines.maximum(:sort_order).to_i + 1

          if line.save
            @quote.calculate_totals
            @quote.save!
            render json: { success: true, data: line }
          else
            render json: { success: false, error: line.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/quotes/:id/toggle_line/:line_id
        def toggle_line
          @quote = @corporate_company.gl_quotes.find(params[:id])
          line = @quote.lines.find(params[:line_id])

          if line.toggle_selection!
            render json: { success: true, data: { line: line, quote: @quote } }
          else
            render json: { success: false, error: "Line is not optional" }, status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/quotes/summary
        def summary
          quotes = @corporate_company.gl_quotes

          render json: {
            success: true,
            data: {
              by_status: {
                draft: quotes.draft.count,
                sent: quotes.sent.count,
                pending: quotes.pending.count,
                accepted: quotes.accepted.count,
                converted: quotes.where(status: "converted").count
              },
              totals: {
                pending_value: quotes.pending.sum(:total),
                accepted_value: quotes.accepted.sum(:total),
                win_rate: ::Gl::Quote.win_rate(@corporate_company)
              },
              recent: quotes.order(created_at: :desc).limit(5).as_json(include: :contact)
            }
          }
        end

        # POST /api/v1/gl/quotes/check_expired
        def check_expired
          ::Gl::Quote.mark_expired!
          expired_count = @corporate_company.gl_quotes.expired.count

          render json: { success: true, message: "#{expired_count} quotes are expired" }
        end

        private

        def set_corporate_company
          @corporate_company = CorporateCompany.find(params[:corporate_company_id])
        end

        def set_quote
          @quote = @corporate_company.gl_quotes.find(params[:id])
        end

        def quote_params
          params.require(:quote).permit(
            :contact_id, :job_id, :quote_date, :expiry_date, :reference,
            :discount, :discount_type, :terms, :notes, :internal_notes,
            lines_attributes: [:id, :code, :description, :quantity, :unit_of_measure,
                               :unit_price, :discount_percent, :tax_rate, :line_type,
                               :optional, :selected, :sort_order, :pricebook_item_id, :_destroy]
          )
        end

        def line_params
          params.require(:line).permit(
            :code, :description, :quantity, :unit_of_measure, :unit_price,
            :discount_percent, :tax_rate, :line_type, :optional, :pricebook_item_id
          )
        end
      end
    end
  end
end
