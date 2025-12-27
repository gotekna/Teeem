# frozen_string_literal: true

class Api::V1::UserEntityTabPreferencesController < ApplicationController
  # GET /api/v1/user_entity_tab_preferences/:scope
  # Get user's tab preferences for a scope
  def show
    scope_name = params[:scope]

    unless UserEntityTabPreference::SCOPES.include?(scope_name)
      return render json: { success: false, error: "Invalid scope: #{scope_name}" }, status: :unprocessable_entity
    end

    preference = UserEntityTabPreference.find_by(user: current_user, scope: scope_name)

    render json: {
      success: true,
      data: {
        scope: scope_name,
        hidden_tabs: preference&.hidden_tabs || [],
        default_tab: preference&.default_tab,
        tab_order: preference&.tab_order || []
      }
    }
  end

  # PATCH /api/v1/user_entity_tab_preferences/:scope
  # Update user's tab preferences for a scope
  def update
    scope_name = params[:scope]

    unless UserEntityTabPreference::SCOPES.include?(scope_name)
      return render json: { success: false, error: "Invalid scope: #{scope_name}" }, status: :unprocessable_entity
    end

    preference = UserEntityTabPreference.for_user_scope(current_user, scope_name)

    if preference.update(preference_params)
      render json: {
        success: true,
        data: {
          scope: scope_name,
          hidden_tabs: preference.hidden_tabs || [],
          default_tab: preference.default_tab,
          tab_order: preference.tab_order || []
        }
      }
    else
      render json: { success: false, error: preference.errors.full_messages.join(', ') }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/user_entity_tab_preferences/:scope/toggle_tab
  # Toggle visibility of a single tab
  def toggle_tab
    scope_name = params[:scope]
    tab_key = params[:tab_key]

    unless UserEntityTabPreference::SCOPES.include?(scope_name)
      return render json: { success: false, error: "Invalid scope: #{scope_name}" }, status: :unprocessable_entity
    end

    unless tab_key.present?
      return render json: { success: false, error: "tab_key is required" }, status: :unprocessable_entity
    end

    preference = UserEntityTabPreference.for_user_scope(current_user, scope_name)
    preference.toggle_tab!(tab_key)

    render json: {
      success: true,
      data: {
        scope: scope_name,
        tab_key: tab_key,
        is_hidden: preference.tab_hidden?(tab_key),
        hidden_tabs: preference.hidden_tabs || []
      }
    }
  end

  # POST /api/v1/user_entity_tab_preferences/:scope/set_default
  # Set the default tab for a scope
  def set_default
    scope_name = params[:scope]
    tab_key = params[:tab_key]

    unless UserEntityTabPreference::SCOPES.include?(scope_name)
      return render json: { success: false, error: "Invalid scope: #{scope_name}" }, status: :unprocessable_entity
    end

    preference = UserEntityTabPreference.for_user_scope(current_user, scope_name)

    if tab_key.present?
      preference.set_default_tab!(tab_key)
    else
      preference.clear_default_tab!
    end

    render json: {
      success: true,
      data: {
        scope: scope_name,
        default_tab: preference.default_tab
      }
    }
  end

  # POST /api/v1/user_entity_tab_preferences/:scope/reorder
  # Set custom tab order
  def reorder
    scope_name = params[:scope]
    tab_order = params[:tab_order]

    unless UserEntityTabPreference::SCOPES.include?(scope_name)
      return render json: { success: false, error: "Invalid scope: #{scope_name}" }, status: :unprocessable_entity
    end

    preference = UserEntityTabPreference.for_user_scope(current_user, scope_name)
    preference.set_tab_order!(tab_order)

    render json: {
      success: true,
      data: {
        scope: scope_name,
        tab_order: preference.tab_order || []
      }
    }
  end

  # DELETE /api/v1/user_entity_tab_preferences/:scope
  # Reset preferences to system defaults
  def destroy
    scope_name = params[:scope]

    preference = UserEntityTabPreference.find_by(user: current_user, scope: scope_name)
    preference&.destroy

    render json: {
      success: true,
      data: { message: "Preferences reset to defaults" }
    }
  end

  private

  def preference_params
    params.permit(:default_tab, hidden_tabs: [], tab_order: [])
  end
end
