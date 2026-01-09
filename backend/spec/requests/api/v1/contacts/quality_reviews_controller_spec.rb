# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Contacts::QualityReviews", type: :request do
  # Create test user for authentication
  let(:user) { create(:user) }

  # Stub authentication
  before do
    allow_any_instance_of(ApplicationController).to receive(:authorize_request).and_return(true)
    allow_any_instance_of(ApplicationController).to receive(:current_user).and_return(user)
  end

  describe "GET /api/v1/contacts/quality_reviews" do
    it "returns quality reviews list" do
      get "/api/v1/contacts/quality_reviews"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
      expect(json["data"]).to be_an(Array)
    end

    it "supports status filtering" do
      get "/api/v1/contacts/quality_reviews", params: { status: "pending" }
      expect(response).to have_http_status(:success)
    end

    it "supports pagination" do
      get "/api/v1/contacts/quality_reviews", params: { page: 1, per_page: 10 }
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["page"]).to eq(1)
      expect(json["per_page"]).to eq(10)
    end
  end

  describe "POST /api/v1/contacts/quality_reviews/scan" do
    it "triggers a quality scan" do
      post "/api/v1/contacts/quality_reviews/scan"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
      expect(json["message"]).to include("Quality scan completed")
    end
  end

  describe "POST /api/v1/contacts/quality_reviews/:id/approve" do
    it "approves a quality review", skip: "Requires ContactQualityReview factory" do
      # Would need to create a ContactQualityReview record
    end
  end

  describe "POST /api/v1/contacts/quality_reviews/:id/reject" do
    it "rejects a quality review", skip: "Requires ContactQualityReview factory" do
      # Would need to create a ContactQualityReview record
    end
  end

  describe "POST /api/v1/contacts/quality_reviews/:id/skip" do
    it "skips a quality review", skip: "Requires ContactQualityReview factory" do
      # Would need to create a ContactQualityReview record
    end
  end

  describe "POST /api/v1/contacts/quality_reviews/bulk_approve" do
    it "requires review_ids array" do
      post "/api/v1/contacts/quality_reviews/bulk_approve", params: { review_ids: nil }
      expect(response).to have_http_status(:bad_request)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(false)
      expect(json["error"]).to include("review_ids")
    end

    it "bulk approves with empty array" do
      # Use JSON format to ensure empty array is properly transmitted
      post "/api/v1/contacts/quality_reviews/bulk_approve",
           params: { review_ids: [] }.to_json,
           headers: { "Content-Type" => "application/json" }
      expect(response).to have_http_status(:bad_request)
    end
  end

  describe "GET /api/v1/contacts/quality_reviews/:contact_id/analyze" do
    let(:contact) { create(:contact, :person) }

    it "analyzes quality for a single contact" do
      get "/api/v1/contacts/quality_reviews/#{contact.id}/analyze"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
      expect(json["data"]).to be_present
    end
  end
end
