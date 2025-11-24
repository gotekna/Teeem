# frozen_string_literal: true

module Api
  module V1
    class SmFieldController < ApplicationController
      before_action :set_task, only: [:upload_photo, :task_photos, :record_voice_note, :task_voice_notes]

      # ==========================================
      # PHOTOS
      # ==========================================

      # POST /api/v1/sm_field/photos
      def upload_photo
        photo = @task.task_photos.new(photo_params)
        photo.uploaded_by = current_user

        # Handle base64 image data
        if params[:image_data].present?
          result = upload_to_cloudinary(params[:image_data])
          photo.photo_url = result[:url] if result[:success]
        end

        if photo.save
          render json: {
            success: true,
            photo: photo_json(photo)
          }, status: :created
        else
          render json: { success: false, errors: photo.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/sm_field/tasks/:task_id/photos
      def task_photos
        photos = @task.task_photos.recent.includes(:uploaded_by, :resource)

        render json: {
          success: true,
          task_id: @task.id,
          photos: photos.map { |p| photo_json(p) }
        }
      end

      # DELETE /api/v1/sm_field/photos/:id
      def delete_photo
        photo = SmTaskPhoto.find(params[:id])

        # Only allow deletion by uploader or admin
        unless photo.uploaded_by_id == current_user&.id || current_user&.admin?
          return render json: { success: false, error: 'Not authorized' }, status: :forbidden
        end

        photo.destroy
        render json: { success: true }
      end

      # ==========================================
      # GPS CHECK-INS
      # ==========================================

      # POST /api/v1/sm_field/checkin
      def checkin
        construction = Construction.find(params[:construction_id])
        resource = SmResource.find(params[:resource_id])

        checkin = SmSiteCheckin.create!(
          construction: construction,
          resource: resource,
          user: current_user,
          latitude: params[:latitude],
          longitude: params[:longitude],
          checkin_type: params[:checkin_type] || 'arrival',
          device_info: request.user_agent,
          sm_task_id: params[:task_id]
        )

        render json: {
          success: true,
          checkin: checkin_json(checkin),
          on_site: checkin.on_site?,
          distance_from_site: checkin.distance_from_site
        }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # GET /api/v1/sm_field/checkins
      def checkins
        checkins = SmSiteCheckin.includes(:resource, :construction, :task)

        # Filters
        checkins = checkins.where(construction_id: params[:construction_id]) if params[:construction_id]
        checkins = checkins.where(resource_id: params[:resource_id]) if params[:resource_id]
        checkins = checkins.for_date(Date.parse(params[:date])) if params[:date]
        checkins = checkins.today if params[:today] == 'true'

        checkins = checkins.recent.limit(params[:limit] || 50)

        render json: {
          success: true,
          checkins: checkins.map { |c| checkin_json(c) }
        }
      end

      # GET /api/v1/sm_field/site_status/:construction_id
      def site_status
        construction = Construction.find(params[:construction_id])
        today_checkins = SmSiteCheckin.where(construction: construction).today.includes(:resource)

        # Find who's currently on site (arrived but not departed)
        on_site = []
        today_checkins.group_by(&:resource_id).each do |resource_id, resource_checkins|
          arrivals = resource_checkins.select { |c| c.checkin_type == 'arrival' }
          departures = resource_checkins.select { |c| c.checkin_type == 'departure' }

          # If more arrivals than departures, they're still on site
          if arrivals.count > departures.count
            last_arrival = arrivals.max_by(&:checked_in_at)
            on_site << {
              resource_id: resource_id,
              resource_name: last_arrival.resource.name,
              arrived_at: last_arrival.checked_in_at,
              on_site_hours: ((Time.current - last_arrival.checked_in_at) / 1.hour).round(1)
            }
          end
        end

        render json: {
          success: true,
          construction_id: construction.id,
          date: Date.current,
          on_site_count: on_site.count,
          on_site: on_site,
          total_checkins_today: today_checkins.count
        }
      end

      # ==========================================
      # VOICE NOTES
      # ==========================================

      # POST /api/v1/sm_field/voice_notes
      def record_voice_note
        voice_note = @task.voice_notes.new(voice_note_params)
        voice_note.recorded_by = current_user

        # Handle base64 audio data
        if params[:audio_data].present?
          result = upload_audio_to_cloudinary(params[:audio_data])
          voice_note.audio_url = result[:url] if result[:success]
        end

        if voice_note.save
          render json: {
            success: true,
            voice_note: voice_note_json(voice_note)
          }, status: :created
        else
          render json: { success: false, errors: voice_note.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/sm_field/tasks/:task_id/voice_notes
      def task_voice_notes
        voice_notes = @task.voice_notes.recent.includes(:recorded_by, :resource)

        render json: {
          success: true,
          task_id: @task.id,
          voice_notes: voice_notes.map { |v| voice_note_json(v) }
        }
      end

      # POST /api/v1/sm_field/voice_notes/:id/transcribe
      def transcribe_voice_note
        voice_note = SmVoiceNote.find(params[:id])
        voice_note.transcribe!

        render json: {
          success: true,
          voice_note: voice_note_json(voice_note)
        }
      end

      # ==========================================
      # OFFLINE SYNC
      # ==========================================

      # POST /api/v1/sm_field/sync
      # Batch sync offline data
      def sync
        results = {
          photos: { synced: 0, failed: 0, errors: [] },
          checkins: { synced: 0, failed: 0, errors: [] },
          voice_notes: { synced: 0, failed: 0, errors: [] }
        }

        # Sync photos
        (params[:photos] || []).each do |photo_data|
          task = SmTask.find_by(id: photo_data[:task_id])
          next unless task

          photo = task.task_photos.new(
            photo_url: photo_data[:photo_url],
            photo_type: photo_data[:photo_type],
            caption: photo_data[:caption],
            taken_at: photo_data[:taken_at],
            uploaded_by: current_user
          )

          if photo.save
            results[:photos][:synced] += 1
          else
            results[:photos][:failed] += 1
            results[:photos][:errors] << photo.errors.full_messages
          end
        end

        # Sync checkins
        (params[:checkins] || []).each do |checkin_data|
          checkin = SmSiteCheckin.new(
            construction_id: checkin_data[:construction_id],
            resource_id: checkin_data[:resource_id],
            latitude: checkin_data[:latitude],
            longitude: checkin_data[:longitude],
            checkin_type: checkin_data[:checkin_type],
            checked_in_at: checkin_data[:checked_in_at],
            user: current_user
          )

          if checkin.save
            results[:checkins][:synced] += 1
          else
            results[:checkins][:failed] += 1
            results[:checkins][:errors] << checkin.errors.full_messages
          end
        end

        # Sync voice notes
        (params[:voice_notes] || []).each do |note_data|
          task = SmTask.find_by(id: note_data[:task_id])
          next unless task

          note = task.voice_notes.new(
            audio_url: note_data[:audio_url],
            duration_seconds: note_data[:duration_seconds],
            recorded_at: note_data[:recorded_at],
            recorded_by: current_user
          )

          if note.save
            results[:voice_notes][:synced] += 1
          else
            results[:voice_notes][:failed] += 1
            results[:voice_notes][:errors] << note.errors.full_messages
          end
        end

        render json: {
          success: true,
          results: results
        }
      end

      private

      def set_task
        @task = SmTask.find(params[:task_id])
      end

      def photo_params
        params.permit(:photo_url, :photo_type, :caption, :latitude, :longitude, :resource_id)
      end

      def voice_note_params
        params.permit(:audio_url, :duration_seconds, :resource_id)
      end

      def photo_json(photo)
        {
          id: photo.id,
          task_id: photo.sm_task_id,
          photo_url: photo.photo_url,
          thumbnail_url: photo.thumbnail_url,
          photo_type: photo.photo_type,
          caption: photo.caption,
          latitude: photo.latitude,
          longitude: photo.longitude,
          taken_at: photo.taken_at,
          uploaded_by: photo.uploaded_by&.slice(:id, :first_name, :last_name),
          created_at: photo.created_at
        }
      end

      def checkin_json(checkin)
        {
          id: checkin.id,
          construction_id: checkin.construction_id,
          construction_name: checkin.construction&.name,
          resource_id: checkin.resource_id,
          resource_name: checkin.resource&.name,
          task_id: checkin.sm_task_id,
          checkin_type: checkin.checkin_type,
          latitude: checkin.latitude,
          longitude: checkin.longitude,
          distance_from_site: checkin.distance_from_site,
          on_site: checkin.on_site?,
          checked_in_at: checkin.checked_in_at,
          device_info: checkin.device_info
        }
      end

      def voice_note_json(voice_note)
        {
          id: voice_note.id,
          task_id: voice_note.sm_task_id,
          audio_url: voice_note.audio_url,
          duration_seconds: voice_note.duration_seconds,
          formatted_duration: voice_note.formatted_duration,
          transcription: voice_note.transcription,
          transcription_confidence: voice_note.transcription_confidence,
          recorded_at: voice_note.recorded_at,
          recorded_by: voice_note.recorded_by&.slice(:id, :first_name, :last_name),
          created_at: voice_note.created_at
        }
      end

      def upload_to_cloudinary(base64_data)
        # Decode and upload to Cloudinary
        CloudinaryService.upload_base64(base64_data, folder: 'sm_task_photos')
      rescue StandardError => e
        { success: false, error: e.message }
      end

      def upload_audio_to_cloudinary(base64_data)
        CloudinaryService.upload_base64(base64_data, folder: 'sm_voice_notes', resource_type: 'video')
      rescue StandardError => e
        { success: false, error: e.message }
      end
    end
  end
end
