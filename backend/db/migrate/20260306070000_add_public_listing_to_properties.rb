class AddPublicListingToProperties < ActiveRecord::Migration[7.1]
  def change
    change_table :properties do |t|
      t.boolean :publicly_listed, default: false, null: false
      t.string :public_listing_type          # "vacancy" or "for_sale"
      t.string :public_headline              # Marketing headline
      t.text :public_description             # Public-facing description
      t.string :listing_price_display        # "Contact Agent", "$850,000", etc.
      t.string :hero_image_url               # Primary photo URL
      t.jsonb :gallery_image_urls, default: [] # Additional photo URLs
      t.decimal :latitude, precision: 10, scale: 7
      t.decimal :longitude, precision: 10, scale: 7
      t.string :enquiry_email                # Where enquiries go
      t.string :enquiry_phone
      t.string :public_slug                  # SEO-friendly URL slug
    end

    add_index :properties, :publicly_listed
    add_index :properties, :public_listing_type
    add_index :properties, :public_slug, unique: true
  end
end
