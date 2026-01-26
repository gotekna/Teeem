# frozen_string_literal: true

class Api::V1::UserDictionaryController < ApplicationController
  # GET /api/v1/user_dictionary
  # List all words in the current user's dictionary
  def index
    words = UserDictionaryWord.words_for_user(current_user)
    render json: { success: true, data: { words: words } }
  end

  # POST /api/v1/user_dictionary
  # Add a word to the current user's dictionary
  #
  # Parameters:
  #   word: String - The word to add
  def create
    word = params[:word].to_s.strip

    if word.blank?
      return render json: { success: false, error: "Word is required" }, status: :unprocessable_entity
    end

    dictionary_word = UserDictionaryWord.new(user: current_user, word: word)

    if dictionary_word.save
      render json: { success: true, data: { word: dictionary_word.word } }
    else
      # If duplicate, still return success (idempotent)
      if dictionary_word.errors[:word].include?("has already been taken")
        render json: { success: true, data: { word: word.downcase } }
      else
        render json: { success: false, error: dictionary_word.errors.full_messages.join(", ") }, status: :unprocessable_entity
      end
    end
  end

  # DELETE /api/v1/user_dictionary/:word
  # Remove a word from the current user's dictionary
  def destroy
    word = params[:id].to_s.strip.downcase

    dictionary_word = UserDictionaryWord.find_by(user: current_user, word: word)

    if dictionary_word
      dictionary_word.destroy
      render json: { success: true, data: { word: word } }
    else
      # Word not found is OK - idempotent
      render json: { success: true, data: { word: word } }
    end
  end
end
