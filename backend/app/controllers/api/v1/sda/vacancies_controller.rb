# frozen_string_literal: true

module Api
  module V1
    module Sda
      class VacanciesController < ApplicationController
        before_action :set_vacancy, only: [:show, :update, :destroy, :notify_ndia, :matches, :add_match, :update_match]

        # GET /api/v1/sda/vacancies
        # GET /api/v1/sda/properties/:property_id/vacancies
        def index
          vacancies = base_scope.includes(:property, :tenancy, :sda_participant_matches)
          vacancies = vacancies.where(property_id: params[:property_id]) if params[:property_id].present?
          vacancies = apply_status_filter(vacancies)
          vacancies = vacancies.order(vacancy_start_date: :desc)

          render_success(vacancies.as_json(include: {
            property: { only: [:id, :property_code, :street_address, :suburb, :sda_category] },
            tenancy: { only: [:id] }
          }).map { |v| v.merge(days_vacant: vacancy_days_vacant(vacancies, v)) })
        end

        # GET /api/v1/sda/vacancies/:id
        def show
          render_success(@vacancy.as_json(include: {
            property: { only: [:id, :property_code, :street_address, :suburb, :state, :sda_category, :sda_dwelling_id] },
            tenancy: { only: [:id] },
            sda_participant_matches: {
              include: {
                contact: { only: [:id, :display_name, :email, :phone, :ndis_number, :sda_approved_category] },
                matched_by_user: { only: [:id, :name, :email] }
              }
            }
          }).merge(
            days_vacant: @vacancy.days_vacant,
            calculated_lost_income: @vacancy.calculate_lost_income,
            overdue_notification: @vacancy.overdue_notification?
          ))
        end

        # POST /api/v1/sda/vacancies
        def create
          vacancy = SdaVacancy.new(vacancy_params)

          if vacancy.save
            render_success(vacancy.as_json(include: {
              property: { only: [:id, :property_code, :street_address, :suburb] }
            }), status: :created)
          else
            render_validation_errors(vacancy)
          end
        end

        # PATCH /api/v1/sda/vacancies/:id
        def update
          if @vacancy.update(vacancy_params)
            render_success(@vacancy.as_json(include: {
              property: { only: [:id, :property_code, :street_address, :suburb] }
            }))
          else
            render_validation_errors(@vacancy)
          end
        end

        # DELETE /api/v1/sda/vacancies/:id
        def destroy
          @vacancy.destroy
          render_success
        end

        # POST /api/v1/sda/vacancies/:id/notify_ndia
        def notify_ndia
          @vacancy.notify_ndia!
          render_success(@vacancy.as_json.merge(
            days_vacant: @vacancy.days_vacant,
            calculated_lost_income: @vacancy.calculate_lost_income
          ))
        rescue ActiveRecord::RecordInvalid => e
          render_error(e.message, status: :unprocessable_entity)
        end

        # GET /api/v1/sda/vacancies/:id/matches
        def matches
          matches = @vacancy.sda_participant_matches
                            .includes(:contact, :matched_by_user)
                            .order(created_at: :desc)

          render_success(matches.as_json(include: {
            contact: { only: [:id, :display_name, :email, :phone, :ndis_number,
                              :sda_approved_category, :sda_funding_status] },
            matched_by_user: { only: [:id, :name, :email] }
          }))
        end

        # POST /api/v1/sda/vacancies/:id/add_match
        def add_match
          match = @vacancy.sda_participant_matches.new(match_params)
          match.matched_by_user = current_user if current_user

          if match.save
            render_success(match.as_json(include: {
              contact: { only: [:id, :display_name, :email, :phone, :ndis_number, :sda_approved_category] },
              matched_by_user: { only: [:id, :name, :email] }
            }), status: :created)
          else
            render_validation_errors(match)
          end
        end

        # PATCH /api/v1/sda/vacancies/:id/matches/:match_id
        def update_match
          match = @vacancy.sda_participant_matches.find(params[:match_id])

          if match.update(update_match_params)
            render_success(match.as_json(include: {
              contact: { only: [:id, :display_name, :email, :phone, :ndis_number, :sda_approved_category] },
              matched_by_user: { only: [:id, :name, :email] }
            }))
          else
            render_validation_errors(match)
          end
        rescue ActiveRecord::RecordNotFound
          render_error("Match not found", status: :not_found)
        end

        private

        def set_vacancy
          @vacancy = base_scope.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render_error("Vacancy not found", status: :not_found)
        end

        def base_scope
          SdaVacancy.includes(:property)
        end

        def apply_status_filter(scope)
          if params[:status].present?
            statuses = Array(params[:status])
            valid_statuses = statuses.select { |s| SdaVacancy::STATUSES.include?(s) }
            scope = scope.where(status: valid_statuses) if valid_statuses.any?
          end
          scope
        end

        def vacancy_params
          params.require(:sda_vacancy).permit(
            :property_id,
            :tenancy_id,
            :status,
            :vacancy_start_date,
            :vacancy_end_date,
            :vacancy_reason,
            :daily_lost_income,
            :notes
          )
        end

        def match_params
          params.permit(:contact_id, :status, :match_reason, :notes)
        end

        def update_match_params
          params.permit(:status, :notes)
        end

        # Computes days_vacant for a single vacancy record from an already-loaded
        # relation so we avoid N+1 calls on the index action.
        def vacancy_days_vacant(relation, vacancy_json)
          record = relation.find { |v| v.id == vacancy_json["id"] }
          record&.days_vacant || 0
        end
      end
    end
  end
end
