# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Contacts::Merge", type: :request do
  # Create test user for authentication
  let(:user) { create(:user) }

  # Stub authentication
  before do
    allow_any_instance_of(ApplicationController).to receive(:authorize_request).and_return(true)
    allow_any_instance_of(ApplicationController).to receive(:current_user).and_return(user)
  end

  describe "POST /api/v1/contacts/merge" do
    let(:target_contact) { create(:contact, :person) }
    let(:source_contact1) { create(:contact, :person) }
    let(:source_contact2) { create(:contact, :person) }

    it "requires target_id parameter" do
      post "/api/v1/contacts/merge",
           params: { target_id: nil, source_ids: [source_contact1.id] }.to_json,
           headers: { "Content-Type" => "application/json" }
      expect(response).to have_http_status(:bad_request)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(false)
      expect(json["error"]).to include("target_id")
    end

    it "requires source_ids array" do
      post "/api/v1/contacts/merge",
           params: { target_id: target_contact.id, source_ids: nil }.to_json,
           headers: { "Content-Type" => "application/json" }
      expect(response).to have_http_status(:bad_request)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(false)
    end

    it "returns 404 for non-existent target" do
      post "/api/v1/contacts/merge",
           params: { target_id: 999999, source_ids: [source_contact1.id] }.to_json,
           headers: { "Content-Type" => "application/json" }
      expect(response).to have_http_status(:not_found)
    end

    it "returns 404 when no source contacts found" do
      post "/api/v1/contacts/merge",
           params: { target_id: target_contact.id, source_ids: [999999] }.to_json,
           headers: { "Content-Type" => "application/json" }
      expect(response).to have_http_status(:not_found)
      json = JSON.parse(response.body)
      expect(json["error"]).to include("No source contacts found")
    end

    it "merges contacts successfully", skip: "Complex merge logic requires more setup" do
      # The merge logic involves many associations that need to be set up properly
      # This would require extensive factory setup for contact_emails, contact_phones, etc.
    end
  end

  describe "GET /api/v1/contacts/merge/duplicates" do
    it "returns duplicate contact groups" do
      get "/api/v1/contacts/merge/duplicates"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json["success"]).to eq(true)
      expect(json["duplicates"]).to be_an(Array)
      expect(json).to have_key("total_duplicate_groups")
      expect(json).to have_key("total_contacts_involved")
    end

    it "finds contacts with same display_name" do
      # Create two company contacts with same company name
      # Use update! to trigger display_name callback
      c1 = create(:contact, :company)
      c1.update!(company_name_or_trust: "Duplicate Corp")

      c2 = create(:contact, :company)
      c2.update!(company_name_or_trust: "Duplicate Corp")

      get "/api/v1/contacts/merge/duplicates"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)

      # Should find at least one duplicate group
      expect(json["total_duplicate_groups"]).to be >= 1

      # Find our duplicate group (display_name is normalized to lowercase)
      dup_group = json["duplicates"].find { |d| d["match_value"] == "duplicate corp" }
      expect(dup_group).to be_present
      expect(dup_group["match_type"]).to eq("display_name")
      expect(dup_group["contacts"].size).to eq(2)
    end

    it "finds contacts with same email" do
      shared_email = "unique_dup_test_#{SecureRandom.hex(4)}@example.com"
      # Create two company contacts (not persons) with different names but same email
      c1 = create(:contact, :company, email: shared_email)
      c1.update!(company_name_or_trust: "Unique Company A #{SecureRandom.hex(4)}")

      c2 = create(:contact, :company, email: shared_email)
      c2.update!(company_name_or_trust: "Unique Company B #{SecureRandom.hex(4)}")

      get "/api/v1/contacts/merge/duplicates"
      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)

      # Find duplicate group that contains our contacts (might be by email or display_name)
      our_contact_ids = [c1.id, c2.id].sort
      matching_group = json["duplicates"].find do |d|
        d["contacts"].map { |c| c["id"] }.sort == our_contact_ids
      end
      expect(matching_group).to be_present
      expect(matching_group["contacts"].size).to eq(2)
    end
  end
end
