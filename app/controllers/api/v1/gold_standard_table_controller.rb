class Api::V1::GoldStandardTableController < ApplicationController
  before_action :set_item, only: [:update, :destroy]

  def index
    items = GoldStandardTable.order(created_at: :desc)
    render json: items
  end

  def create
    item = GoldStandardTable.new(item_params)

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
    @item = GoldStandardTable.find(params[:id])
  end

  def item_params
    params.require(:gold_standard_table).permit(
      :section, :email, :phone, :mobile, :title, :category_type, :is_active,
      :discount, :component, :status, :price, :quantity, :whole_number, :unit,
      :severity, :content, :category, :document_link, :updated_at, :created_at
    )
  end
end
