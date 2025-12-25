# frozen_string_literal: true

module Api
  module V1
    module Gl
      class AnomaliesController < ApplicationController
        # GET /api/v1/gl/anomalies
        # Get all detected anomalies
        def index
          detector = ::Gl::AnomalyDetector.new(current_company)

          anomalies = detector.scan_transactions(
            days: params[:days]&.to_i || 30,
            limit: params[:limit]&.to_i || 100
          )

          render json: {
            success: true,
            data: {
              anomalies: anomalies,
              count: anomalies.count,
              high_severity: anomalies.count { |a| a[:anomaly_level] == "high" },
              medium_severity: anomalies.count { |a| a[:anomaly_level] == "medium" }
            }
          }
        end

        # GET /api/v1/gl/anomalies/summary
        # Get summary statistics
        def summary
          detector = ::Gl::AnomalyDetector.new(current_company)
          stats = detector.summary_stats

          render json: {
            success: true,
            data: stats
          }
        end

        # GET /api/v1/gl/anomalies/trend
        # Get anomaly trend over time
        def trend
          detector = ::Gl::AnomalyDetector.new(current_company)
          trend_data = detector.trend(weeks: params[:weeks]&.to_i || 8)

          render json: {
            success: true,
            data: {
              trend: trend_data
            }
          }
        end

        # GET /api/v1/gl/anomalies/high_risk
        # Get only high-severity anomalies
        def high_risk
          detector = ::Gl::AnomalyDetector.new(current_company)

          anomalies = detector.scan_transactions(
            days: params[:days]&.to_i || 30,
            limit: params[:limit]&.to_i || 100
          ).select { |a| a[:anomaly_level] == "high" }

          render json: {
            success: true,
            data: {
              anomalies: anomalies,
              count: anomalies.count,
              total_amount: anomalies.sum { |a| a[:transaction][:amount].to_f.abs }
            }
          }
        end

        # POST /api/v1/gl/anomalies/analyze
        # Analyze specific transaction IDs
        def analyze
          transaction_ids = params[:transaction_ids] || []
          detector = ::Gl::AnomalyDetector.new(current_company)

          # Find transactions (could be journal entry lines)
          results = transaction_ids.filter_map do |id|
            line = ::Gl::JournalEntryLine.find_by(id: id)
            next unless line

            detector.analyze_transaction(line)
          end

          render json: {
            success: true,
            data: {
              results: results,
              count: results.count,
              anomalies_found: results.count { |r| r[:is_anomaly] }
            }
          }
        end

        # POST /api/v1/gl/anomalies/mark_reviewed
        # Mark an anomaly as reviewed (for tracking)
        def mark_reviewed
          # Create or update anomaly review record
          review = ::Gl::AnomalyReview.find_or_initialize_by(
            corporate_company: current_company,
            transaction_type: params[:transaction_type],
            transaction_id: params[:transaction_id]
          )

          review.update!(
            reviewed_by: current_user,
            reviewed_at: Time.current,
            status: params[:status] || "acknowledged",
            notes: params[:notes],
            anomaly_score: params[:anomaly_score]
          )

          render json: {
            success: true,
            data: review_json(review),
            message: "Anomaly marked as reviewed"
          }
        end

        # GET /api/v1/gl/anomalies/reviews
        # List all anomaly reviews
        def reviews
          reviews = ::Gl::AnomalyReview
            .where(corporate_company: current_company)
            .includes(:reviewed_by)
            .order(created_at: :desc)
            .limit(params[:limit] || 100)

          render json: {
            success: true,
            data: {
              reviews: reviews.map { |r| review_json(r) },
              count: reviews.count
            }
          }
        end

        private

        def review_json(review)
          {
            id: review.id,
            transaction_type: review.transaction_type,
            transaction_id: review.transaction_id,
            status: review.status,
            notes: review.notes,
            anomaly_score: review.anomaly_score,
            reviewed_by: review.reviewed_by&.name,
            reviewed_at: review.reviewed_at,
            created_at: review.created_at
          }
        end

        def current_company
          @current_company ||= CorporateCompany.find(
            params[:corporate_company_id] || current_user.corporate_company_id
          )
        end
      end
    end
  end
end
