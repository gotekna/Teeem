require 'rails_helper'

RSpec.describe "Api::V1::ContactRoles", type: :request do
  describe "GET /index" do
    it "returns http success" do
      get "/api/v1/contact_roles/index"
      expect(response).to have_http_status(:success)
    end
  end

  describe "GET /create" do
    it "returns http success" do
      get "/api/v1/contact_roles/create"
      expect(response).to have_http_status(:success)
    end
  end

  describe "GET /update" do
    it "returns http success" do
      get "/api/v1/contact_roles/update"
      expect(response).to have_http_status(:success)
    end
  end

  describe "GET /destroy" do
    it "returns http success" do
      get "/api/v1/contact_roles/destroy"
      expect(response).to have_http_status(:success)
    end
  end
end
