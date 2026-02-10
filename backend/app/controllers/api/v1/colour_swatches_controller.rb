# frozen_string_literal: true

# API endpoint for colour swatch WarehouseDocuments
# These are photos classified as colour swatches during pricebook photo import
# (metadata->>'category' = 'colour_swatch')
class Api::V1::ColourSwatchesController < ApplicationController
  # GET /api/v1/colour_swatches
  # Returns colour swatch documents grouped by brand with presigned URLs
  def index
    swatches = WarehouseDocument
      .where("metadata->>'category' = ?", "colour_swatch")
      .includes(:storage_blob)
      .order(Arel.sql("metadata->>'brand' ASC, metadata->>'colour_name' ASC"))

    # Group by brand
    grouped = swatches.group_by { |doc| doc.meta("brand") || "Other" }

    render json: {
      success: true,
      data: {
        totalCount: swatches.size,
        brands: grouped.map do |brand, docs|
          {
            brand: brand,
            count: docs.size,
            swatches: docs.map { |doc| swatch_json(doc) }
          }
        end
      }
    }
  end

  private

  def swatch_json(doc)
    {
      id: doc.id.to_s,
      colourName: doc.meta("colour_name") || doc.ui_name,
      brand: doc.meta("brand") || "Other",
      filename: doc.ui_name,
      imageUrl: doc.download_url(expires_in: 3600, disposition: :inline),
      thumbnailUrl: doc.download_url(expires_in: 3600, disposition: :inline),
      contentType: doc.storage_blob&.content_type,
      createdAt: doc.created_at&.iso8601
    }
  end
end
