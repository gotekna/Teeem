require 'rails_helper'

RSpec.describe "Api::V1::GoldStandardItems", type: :request do
  let(:valid_attributes) do
    {
      email: "test@example.com",
      phone: "555-1234",
      mobile: "555-5678",
      single_line_text: "Sample text",
      whole_number: 42,
      number: 3.14,
      currency: 99.99,
      percentage: 75.5,
      boolean: true,
      url: "https://example.com",
      gps_coordinates: "-33.8688,151.2093",
      color_picker: "#FF5733"
    }
  end

  let(:invalid_attributes) do
    {
      email: "invalid-email",
      percentage: 150  # Over 100%
    }
  end

  describe "GET /index" do
    context "without pagination params" do
      it "returns http success with default pagination" do
        get "/api/v1/gold_standard_items"
        expect(response).to have_http_status(:success)
        json = JSON.parse(response.body)
        expect(json["success"]).to eq(true)
        expect(json["items"]).to be_an(Array)
        expect(json["pagination"]).to be_present
        expect(json["pagination"]["per_page"]).to eq(100)
      end
    end

    context "with pagination params" do
      before do
        create_list(:gold_standard_item, 5)
      end

      it "respects page and per_page parameters" do
        get "/api/v1/gold_standard_items", params: { page: 1, per_page: 2 }
        json = JSON.parse(response.body)
        expect(json["items"].length).to eq(2)
        expect(json["pagination"]["current_page"]).to eq(1)
        expect(json["pagination"]["per_page"]).to eq(2)
      end

      it "caps per_page at 500" do
        get "/api/v1/gold_standard_items", params: { per_page: 1000 }
        json = JSON.parse(response.body)
        expect(json["pagination"]["per_page"]).to eq(500)
      end
    end

    context "with caching headers" do
      it "includes cache-control headers" do
        get "/api/v1/gold_standard_items"
        expect(response.headers["Cache-Control"]).to include("public")
      end
    end
  end

  describe "POST /create" do
    context "with valid parameters" do
      it "creates a new gold standard item" do
        expect {
          post "/api/v1/gold_standard_items", params: { gold_standard_item: valid_attributes }
        }.to change(GoldStandardItem, :count).by(1)

        expect(response).to have_http_status(:created)
        json = JSON.parse(response.body)
        expect(json["success"]).to eq(true)
        expect(json["item"]["email"]).to eq("test@example.com")
      end

      it "creates item with all field types" do
        post "/api/v1/gold_standard_items", params: { gold_standard_item: valid_attributes }
        json = JSON.parse(response.body)
        item = json["item"]

        expect(item["email"]).to eq("test@example.com")
        expect(item["phone"]).to eq("555-1234")
        expect(item["whole_number"]).to eq(42)
        expect(item["percentage"]).to eq("75.5")
        expect(item["boolean"]).to eq(true)
        expect(item["url"]).to eq("https://example.com")
      end
    end

    context "with invalid parameters" do
      it "rejects invalid email format" do
        post "/api/v1/gold_standard_items", params: {
          gold_standard_item: { email: "invalid-email" }
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json["success"]).to eq(false)
        expect(json["errors"]).to include(match(/email/i))
      end

      it "rejects percentage over 100" do
        post "/api/v1/gold_standard_items", params: {
          gold_standard_item: { percentage: 150 }
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json["errors"]).to include(match(/percentage/i))
      end

      it "rejects invalid URL format" do
        post "/api/v1/gold_standard_items", params: {
          gold_standard_item: { url: "not-a-url" }
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json["errors"]).to include(match(/url/i))
      end

      it "rejects invalid GPS coordinates" do
        post "/api/v1/gold_standard_items", params: {
          gold_standard_item: { gps_coordinates: "invalid" }
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json["errors"]).to include(match(/gps/i))
      end

      it "rejects invalid color format" do
        post "/api/v1/gold_standard_items", params: {
          gold_standard_item: { color_picker: "red" }
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json["errors"]).to include(match(/color/i))
      end

      it "rejects negative currency" do
        post "/api/v1/gold_standard_items", params: {
          gold_standard_item: { currency: -10 }
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json["errors"]).to include(match(/currency/i))
      end
    end

    context "security tests" do
      it "rejects attempts to set system columns" do
        post "/api/v1/gold_standard_items", params: {
          gold_standard_item: {
            email: "test@example.com",
            id: 99999,  # Should be ignored
            created_at: 1.year.ago,  # Should be ignored
            updated_at: 1.year.ago   # Should be ignored
          }
        }

        expect(response).to have_http_status(:created)
        json = JSON.parse(response.body)
        # ID should be auto-assigned, not 99999
        expect(json["item"]["id"]).not_to eq(99999)
        # Timestamps should be recent, not 1 year ago
        expect(Time.parse(json["item"]["created_at"])).to be_within(1.minute).of(Time.now)
      end
    end
  end

  describe "PATCH /update" do
    let!(:item) { GoldStandardItem.create!(valid_attributes) }

    context "with valid parameters" do
      it "updates the gold standard item" do
        patch "/api/v1/gold_standard_items/#{item.id}", params: {
          gold_standard_item: { email: "updated@example.com" }
        }

        expect(response).to have_http_status(:success)
        json = JSON.parse(response.body)
        expect(json["success"]).to eq(true)
        expect(json["item"]["email"]).to eq("updated@example.com")
      end

      it "updates multiple fields at once" do
        patch "/api/v1/gold_standard_items/#{item.id}", params: {
          gold_standard_item: {
            email: "updated@example.com",
            phone: "999-8888",
            percentage: 85.0
          }
        }

        json = JSON.parse(response.body)
        expect(json["item"]["email"]).to eq("updated@example.com")
        expect(json["item"]["phone"]).to eq("999-8888")
        expect(json["item"]["percentage"]).to eq("85.0")
      end
    end

    context "with invalid parameters" do
      it "returns validation errors" do
        patch "/api/v1/gold_standard_items/#{item.id}", params: {
          gold_standard_item: { email: "invalid-email" }
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json["success"]).to eq(false)
      end

      it "does not update when validation fails" do
        original_email = item.email
        patch "/api/v1/gold_standard_items/#{item.id}", params: {
          gold_standard_item: { percentage: 150 }
        }

        item.reload
        expect(item.email).to eq(original_email)
        expect(item.percentage).not_to eq(150)
      end
    end

    context "edge cases" do
      it "returns 404 for non-existent item" do
        patch "/api/v1/gold_standard_items/99999", params: {
          gold_standard_item: { email: "test@example.com" }
        }

        expect(response).to have_http_status(:not_found)
        json = JSON.parse(response.body)
        expect(json["success"]).to eq(false)
      end
    end
  end

  describe "DELETE /destroy" do
    let!(:item) { GoldStandardItem.create!(valid_attributes) }

    it "destroys the gold standard item" do
      expect {
        delete "/api/v1/gold_standard_items/#{item.id}"
      }.to change(GoldStandardItem, :count).by(-1)

      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
    end

    it "returns 404 for non-existent item" do
      delete "/api/v1/gold_standard_items/99999"

      expect(response).to have_http_status(:not_found)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(false)
    end

    context "bulk delete scenario" do
      it "successfully deletes multiple items in sequence" do
        item2 = GoldStandardItem.create!(valid_attributes.merge(email: "item2@example.com"))
        item3 = GoldStandardItem.create!(valid_attributes.merge(email: "item3@example.com"))

        expect {
          delete "/api/v1/gold_standard_items/#{item.id}"
          delete "/api/v1/gold_standard_items/#{item2.id}"
          delete "/api/v1/gold_standard_items/#{item3.id}"
        }.to change(GoldStandardItem, :count).by(-3)
      end
    end
  end

  describe "Model validations" do
    it "validates email format" do
      item = GoldStandardItem.new(email: "invalid")
      expect(item).not_to be_valid
      expect(item.errors[:email]).to be_present
    end

    it "validates percentage range" do
      item = GoldStandardItem.new(percentage: 150)
      expect(item).not_to be_valid
      expect(item.errors[:percentage]).to include("must be less than or equal to 100")
    end

    it "validates URL format" do
      item = GoldStandardItem.new(url: "not-a-url")
      expect(item).not_to be_valid
      expect(item.errors[:url]).to be_present
    end

    it "validates GPS coordinates format" do
      item = GoldStandardItem.new(gps_coordinates: "invalid")
      expect(item).not_to be_valid
      expect(item.errors[:gps_coordinates]).to be_present
    end

    it "validates color picker hex format" do
      item = GoldStandardItem.new(color_picker: "red")
      expect(item).not_to be_valid
      expect(item.errors[:color_picker]).to be_present
    end
  end
end
