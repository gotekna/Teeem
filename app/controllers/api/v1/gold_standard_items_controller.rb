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
      # Existing columns
      :section, :email, :phone, :mobile, :title, :category_type, :is_active,
      :discount, :component, :status, :price, :quantity, :whole_number, :unit,
      :severity, :content, :category, :document_link, :updated_at, :created_at,
      :action_buttons,
      # New columns added for complete 22 column type coverage
      :item_code,           # single_line_text
      :notes,               # multiple_lines_text
      :start_date,          # date
      :location_coords,     # gps_coordinates
      :color_code,          # color_picker
      :file_attachment,     # file_upload
      :multi_tags,          # multiple_lookups
      :assigned_user_id,    # user
      :total_cost           # computed
    )
  end
end
