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
      boolean: true
    }
  end

  let(:invalid_attributes) do
    {
      email: "invalid-email",
      percentage: 150  # Over 100%
    }
  end

  describe "GET /index" do
    it "returns http success" do
      get "/api/v1/gold_standard_items"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
      expect(json["items"]).to be_an(Array)
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
    end

    context "with invalid parameters" do
      it "returns validation errors" do
        post "/api/v1/gold_standard_items", params: { gold_standard_item: invalid_attributes }

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json["success"]).to eq(false)
        expect(json["errors"]).to be_present
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
  end
end
