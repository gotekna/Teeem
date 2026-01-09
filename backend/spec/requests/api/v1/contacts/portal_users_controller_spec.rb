# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Contacts::PortalUsers", type: :request do
  let(:user) { create(:user) }
  let(:contact) { create(:contact, email: "test@example.com") }

  before do
    allow_any_instance_of(ApplicationController).to receive(:authorize_request).and_return(true)
    allow_any_instance_of(ApplicationController).to receive(:current_user).and_return(user)
  end

  describe "POST /api/v1/contacts/portal_users/:contact_id" do
    it "requires email and password" do
      post "/api/v1/contacts/portal_users/#{contact.id}"
      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(false)
      expect(json["error"]).to include("Email and password are required")
    end

    it "requires email" do
      post "/api/v1/contacts/portal_users/#{contact.id}",
           params: { password: "password123" }
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "requires password" do
      post "/api/v1/contacts/portal_users/#{contact.id}",
           params: { email: "portal@example.com" }
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 404 for non-existent contact" do
      post "/api/v1/contacts/portal_users/999999",
           params: { email: "test@example.com", password: "password123" }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/contacts/portal_users/:contact_id" do
    it "returns 404 when no portal user exists" do
      patch "/api/v1/contacts/portal_users/#{contact.id}",
            params: { email: "new@example.com" }
      expect(response).to have_http_status(:not_found)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(false)
      expect(json["error"]).to include("No portal user exists")
    end

    it "returns 404 for non-existent contact" do
      patch "/api/v1/contacts/portal_users/999999",
            params: { email: "new@example.com" }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/contacts/portal_users/:contact_id" do
    it "returns 404 when no portal user exists" do
      delete "/api/v1/contacts/portal_users/#{contact.id}"
      expect(response).to have_http_status(:not_found)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(false)
      expect(json["error"]).to include("No portal user exists")
    end

    it "returns 404 for non-existent contact" do
      delete "/api/v1/contacts/portal_users/999999"
      expect(response).to have_http_status(:not_found)
    end
  end
end
