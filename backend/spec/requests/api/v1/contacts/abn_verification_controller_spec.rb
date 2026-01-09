# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Contacts::AbnVerification", type: :request do
  # Create test user for authentication
  let(:user) { create(:user) }

  # Stub authentication
  before do
    allow_any_instance_of(ApplicationController).to receive(:authorize_request).and_return(true)
    allow_any_instance_of(ApplicationController).to receive(:current_user).and_return(user)
  end

  describe "GET /api/v1/contacts/abn/validate" do
    it "validates an ABN format" do
      get "/api/v1/contacts/abn/validate", params: { abn: "12345678901" }
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      # AbnLookupService returns { valid: true/false, ... }
      expect(json).to have_key("valid")
    end

    it "returns error for blank ABN" do
      get "/api/v1/contacts/abn/validate", params: { abn: "" }
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["valid"]).to eq(false)
      expect(json["error"]).to include("required")
    end
  end

  describe "POST /api/v1/contacts/abn/:contact_id/verify" do
    let(:contact_with_abn) { create(:contact, :company, :with_abn) }
    let(:contact_without_abn) { create(:contact, :company) }

    it "returns error for contact without ABN" do
      post "/api/v1/contacts/abn/#{contact_without_abn.id}/verify"
      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(false)
      expect(json["error"]).to include("no ABN")
    end

    it "verifies contact ABN via ABR API", skip: "Requires ABR API credentials" do
      # This would make an external API call
      post "/api/v1/contacts/abn/#{contact_with_abn.id}/verify"
      expect(response).to have_http_status(:success)
    end
  end

  describe "POST /api/v1/contacts/abn/find_missing" do
    context "when ABR_GUID is not set" do
      before do
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with("ABR_GUID").and_return(nil)
        allow(ENV).to receive(:fetch).and_call_original
      end

      it "returns service unavailable" do
        post "/api/v1/contacts/abn/find_missing"
        expect(response).to have_http_status(:service_unavailable)
        json = JSON.parse(response.body)
        expect(json["success"]).to eq(false)
        expect(json["error"]).to include("ABR_GUID")
      end
    end

    context "when ABR_GUID is set" do
      before do
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with("ABR_GUID").and_return("test-guid")
        allow(ENV).to receive(:fetch).and_call_original
        # Mock the job to not actually run
        allow(FindMissingAbnsJob).to receive(:perform_later)
      end

      it "starts background job" do
        post "/api/v1/contacts/abn/find_missing"
        expect(response).to have_http_status(:success)
        json = JSON.parse(response.body)
        expect(json["success"]).to eq(true)
        expect(json["message"]).to include("background")
      end
    end
  end
end
