require 'rails_helper'

RSpec.describe "Api::V1::BugHunterTests", type: :request do
  describe "GET /index" do
    it "returns http success" do
      get "/api/v1/bug_hunter_tests/index"
      expect(response).to have_http_status(:success)
    end
  end

  describe "GET /history" do
    it "returns http success" do
      get "/api/v1/bug_hunter_tests/history"
      expect(response).to have_http_status(:success)
    end
  end

  describe "GET /run" do
    it "returns http success" do
      get "/api/v1/bug_hunter_tests/run"
      expect(response).to have_http_status(:success)
    end
  end
end
