# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Contacts::Health", type: :request do
  let(:user) { create(:user) }

  before do
    allow_any_instance_of(ApplicationController).to receive(:authorize_request).and_return(true)
    allow_any_instance_of(ApplicationController).to receive(:current_user).and_return(user)
  end

  describe "GET /api/v1/contacts/health" do
    it "returns health score" do
      get "/api/v1/contacts/health"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
      expect(json).to have_key("health_score")
      expect(json).to have_key("total_issues")
      expect(json).to have_key("checked_at")
    end
  end

  describe "GET /api/v1/contacts/health/invalid_entity_types" do
    it "returns contacts with invalid entity types" do
      get "/api/v1/contacts/health/invalid_entity_types"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
      expect(json).to have_key("total_count")
      expect(json).to have_key("items")
    end
  end

  describe "GET /api/v1/contacts/health/price_only_with_xero" do
    it "returns price_only contacts synced to Xero" do
      get "/api/v1/contacts/health/price_only_with_xero"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
      expect(json).to have_key("total_count")
      expect(json).to have_key("items")
    end
  end

  describe "GET /api/v1/contacts/health/company_with_first_name" do
    it "returns companies with first_name set" do
      get "/api/v1/contacts/health/company_with_first_name"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
      expect(json).to have_key("total_count")
      expect(json).to have_key("items")
    end
  end

  describe "GET /api/v1/contacts/health/person_without_name" do
    it "returns persons without first_name" do
      get "/api/v1/contacts/health/person_without_name"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
      expect(json).to have_key("total_count")
      expect(json).to have_key("items")
    end
  end

  describe "GET /api/v1/contacts/health/missing_contact_info" do
    it "returns contacts without mobile or email" do
      get "/api/v1/contacts/health/missing_contact_info"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
      expect(json).to have_key("total_count")
      expect(json).to have_key("items")
    end
  end

  describe "GET /api/v1/contacts/health/connected_mailboxes" do
    it "returns list of connected mailboxes" do
      get "/api/v1/contacts/health/connected_mailboxes"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
      expect(json).to have_key("mailboxes")
      expect(json["mailboxes"]).to be_an(Array)
    end
  end
end
