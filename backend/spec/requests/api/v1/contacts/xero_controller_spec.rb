# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Contacts::Xero", type: :request do
  let(:user) { create(:user) }
  let(:contact) { create(:contact) }

  before do
    allow_any_instance_of(ApplicationController).to receive(:authorize_request).and_return(true)
    allow_any_instance_of(ApplicationController).to receive(:current_user).and_return(user)
  end

  describe "POST /api/v1/contacts/xero/:contact_id/link_tenant" do
    it "requires tenant_id and xero_contact_id" do
      post "/api/v1/contacts/xero/#{contact.id}/link_tenant"
      expect(response).to have_http_status(:bad_request)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(false)
      expect(json["error"]).to include("tenant_id")
    end

    it "returns 404 for non-existent contact" do
      post "/api/v1/contacts/xero/999999/link_tenant",
           params: { tenant_id: "test-tenant", xero_contact_id: "test-id" }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/contacts/xero/:contact_id/link_contact" do
    it "requires xero_id" do
      post "/api/v1/contacts/xero/#{contact.id}/link_contact"
      expect(response).to have_http_status(:bad_request)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(false)
      expect(json["error"]).to include("xero_id")
    end

    it "returns 404 for non-existent contact" do
      post "/api/v1/contacts/xero/999999/link_contact",
           params: { xero_id: "test-id" }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/contacts/xero/:contact_id/sync_from" do
    it "returns error when contact is not linked to Xero" do
      post "/api/v1/contacts/xero/#{contact.id}/sync_from"
      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(false)
      expect(json["error"]).to include("not linked")
    end

    it "returns 404 for non-existent contact" do
      post "/api/v1/contacts/xero/999999/sync_from"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/contacts/xero/:contact_id/sync_to" do
    it "returns error when contact is not linked to Xero" do
      post "/api/v1/contacts/xero/#{contact.id}/sync_to"
      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(false)
      expect(json["error"]).to include("not linked")
    end

    it "returns 404 for non-existent contact" do
      post "/api/v1/contacts/xero/999999/sync_to"
      expect(response).to have_http_status(:not_found)
    end
  end
end
