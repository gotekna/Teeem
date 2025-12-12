class Api::V1::EmailBlacklistController < ApplicationController
  before_action :set_blacklist_item, only: [:update, :destroy]

  # GET /api/v1/email_blacklist
  def index
    items = EmailBlacklistItem.order(match_count: :desc, created_at: :desc)

    render json: {
      success: true,
      items: items.map { |item| blacklist_item_json(item) },
      pattern_types: EmailBlacklistItem::PATTERN_TYPES
    }
  end

  # POST /api/v1/email_blacklist
  def create
    item = EmailBlacklistItem.new(blacklist_params)

    if item.save
      render json: {
        success: true,
        item: blacklist_item_json(item),
        message: "Blacklist pattern added successfully"
      }, status: :created
    else
      render json: {
        success: false,
        errors: item.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/email_blacklist/:id
  def update
    if @item.update(blacklist_params)
      render json: {
        success: true,
        item: blacklist_item_json(@item),
        message: "Blacklist pattern updated successfully"
      }
    else
      render json: {
        success: false,
        errors: @item.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/email_blacklist/:id
  def destroy
    @item.destroy
    render json: {
      success: true,
      message: "Blacklist pattern deleted successfully"
    }
  end

  # POST /api/v1/email_blacklist/test
  # Test if an email would be filtered
  def test
    result = EmailBlacklistItem.should_filter?(
      from_email: params[:from_email],
      from_name: params[:from_name],
      subject: params[:subject]
    )

    # Find which pattern matched (if any)
    matched_item = nil
    if result
      email_data = {
        from_email: params[:from_email],
        from_name: params[:from_name],
        subject: params[:subject]
      }

      matched_item = EmailBlacklistItem.active.find { |item| item.matches?(email_data) }
    end

    render json: {
      success: true,
      would_filter: result,
      matched_pattern: matched_item ? blacklist_item_json(matched_item) : nil
    }
  end

  private

  def set_blacklist_item
    @item = EmailBlacklistItem.find(params[:id])
  end

  def blacklist_params
    params.require(:email_blacklist_item).permit(:pattern, :pattern_type, :description, :active)
  end

  def blacklist_item_json(item)
    {
      id: item.id,
      pattern: item.pattern,
      pattern_type: item.pattern_type,
      description: item.description,
      active: item.active,
      match_count: item.match_count,
      created_at: item.created_at,
      updated_at: item.updated_at
    }
  end
end
