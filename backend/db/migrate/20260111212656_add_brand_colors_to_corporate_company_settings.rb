# frozen_string_literal: true

# Add brand color fields to corporate_company_settings
# These colors are used to theme the UI for each company
# Colors are stored as HSL strings (e.g., "217 91% 60%") to match CSS variables
class AddBrandColorsToCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def change
    # Primary brand color (buttons, links, key UI elements)
    add_column :corporate_company_settings, :brand_color_primary, :string
    add_column :corporate_company_settings, :brand_color_primary_foreground, :string

    # Secondary color (card backgrounds, hover states)
    add_column :corporate_company_settings, :brand_color_secondary, :string

    # Muted color (labels, disabled text)
    add_column :corporate_company_settings, :brand_color_muted, :string

    # Accent color (highlights, AI elements, links)
    add_column :corporate_company_settings, :brand_color_accent, :string

    # Website URL for auto-detecting brand colors
    add_column :corporate_company_settings, :website_url, :string
  end
end
