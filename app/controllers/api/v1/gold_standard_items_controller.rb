class Api::V1::GoldStandardItemsController < ApplicationController
  before_action :set_item, only: [:update, :destroy]

  def index
    items = GoldStandardItem.order(created_at: :desc)
    render json: items
  end

  def create
    item = GoldStandardItem.new(item_params)

    if item.save
      render json: item, status: :created
    else
      render json: { errors: item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @item.update(item_params)
      render json: @item
    else
      render json: { errors: @item.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @item.destroy
    head :no_content
  end

  private

  def set_item
    @item = GoldStandardItem.find(params[:id])
  end

  def item_params
    params.require(:gold_standard_item).permit(
      # System columns
      :id, :created_at, :updated_at,
      # Gold Standard columns (after cleanup migration - using generic type names)
      :single_line_text,
      :multiple_lines_text,
      :email,
      :phone,
      :mobile,
      :url,
      :number,
      :whole_number,
      :currency,
      :percentage,
      :date,
      :date_and_time,
      :gps_coordinates,
      :color_picker,
      :file_upload,
      :action_buttons,
      :boolean,
      :choice,
      :lookup,
      :multiple_lookups,
      :user,
      :computed
    )
  end
end
