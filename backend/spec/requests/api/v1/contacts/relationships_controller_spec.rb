# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Contacts::Relationships", type: :request do
  let(:user) { create(:user) }

  before do
    allow_any_instance_of(ApplicationController).to receive(:authorize_request).and_return(true)
    allow_any_instance_of(ApplicationController).to receive(:current_user).and_return(user)
  end

  describe "GET /api/v1/contacts/relationships/:contact_id/cases" do
    let(:contact) { create(:contact) }

    it "returns case relationships" do
      get "/api/v1/contacts/relationships/#{contact.id}/cases"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
      expect(json).to have_key("data")
      expect(json).to have_key("total_count")
    end

    it "returns 404 for non-existent contact" do
      get "/api/v1/contacts/relationships/999999/cases"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/contacts/relationships/:contact_id/coworkers" do
    let(:company) { create(:contact, entity_type: "company", company_name_or_trust: "Test Company") }
    let(:person) { create(:contact, entity_type: "person") }

    it "returns coworkers for a company contact" do
      get "/api/v1/contacts/relationships/#{company.id}/coworkers"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
      expect(json).to have_key("data")
      expect(json).to have_key("total_count")
    end

    it "returns coworkers for a person contact" do
      get "/api/v1/contacts/relationships/#{person.id}/coworkers"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
    end
  end

  describe "POST /api/v1/contacts/relationships/:contact_id/reorder_employees" do
    let(:company) { create(:contact, entity_type: "company", company_name_or_trust: "Test Company") }
    let(:person) { create(:contact, entity_type: "person") }

    it "reorders employees for a company contact" do
      post "/api/v1/contacts/relationships/#{company.id}/reorder_employees",
           params: { employee_ids: [] }
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
    end

    it "rejects reorder for non-company contacts" do
      post "/api/v1/contacts/relationships/#{person.id}/reorder_employees",
           params: { employee_ids: [] }
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "requires employee_ids to be an array" do
      post "/api/v1/contacts/relationships/#{company.id}/reorder_employees",
           params: { employee_ids: "not_an_array" }
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "POST /api/v1/contacts/relationships/:contact_id/reorder_companies" do
    let(:person) { create(:contact, entity_type: "person") }
    let(:company) { create(:contact, entity_type: "company", company_name_or_trust: "Test Company") }

    it "reorders companies for a person contact" do
      post "/api/v1/contacts/relationships/#{person.id}/reorder_companies",
           params: { company_ids: [] }
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
    end

    it "rejects reorder for non-person contacts" do
      post "/api/v1/contacts/relationships/#{company.id}/reorder_companies",
           params: { company_ids: [] }
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
