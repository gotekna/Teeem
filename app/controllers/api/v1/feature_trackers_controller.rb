class Api::V1::FeatureTrackersController < ApplicationController
  before_action :set_feature_tracker, only: [:update, :destroy]

  def index
    @feature_trackers = FeatureTracker.includes(:feature_chapter).ordered

    if params[:chapter].present?
      @feature_trackers = @feature_trackers.by_chapter(params[:chapter])
    end

    if params[:feature_chapter_id].present?
      @feature_trackers = @feature_trackers.by_feature_chapter(params[:feature_chapter_id])
    end

    # Include chapter lookup data for TrapidTableView
    feature_chapters = FeatureChapter.all.map do |fc|
      {
        id: fc.id,
        chapter_number: fc.chapter_number,
        name: fc.name,
        display_name: fc.display_name
      }
    end

    render json: {
      success: true,
      feature_trackers: @feature_trackers.as_json(
        methods: [:completion_percentage, :fully_complete?, :chapter_display],
        include: {
          feature_chapter: {
            only: [:id, :chapter_number, :name],
            methods: [:display_name]
          }
        }
      ),
      feature_chapters: feature_chapters,
      chapters: FeatureTracker.chapters,
      stats: {
        total: FeatureTracker.count,
        system_complete: FeatureTracker.system_complete.count,
        dev_checked: FeatureTracker.dev_checked.count,
        tester_checked: FeatureTracker.tester_checked.count,
        ui_checked: FeatureTracker.ui_checked.count,
        user_checked: FeatureTracker.user_checked.count,
        fully_complete: FeatureTracker.where(
          system_complete: true,
          dev_checked: true,
          tester_checked: true,
          ui_checked: true,
          user_checked: true
        ).count
      }
    }
  end

  def create
    @feature_tracker = FeatureTracker.new(feature_tracker_params)

    if @feature_tracker.save
      render json: {
        success: true,
        feature_tracker: @feature_tracker.as_json(methods: [:completion_percentage, :fully_complete?]),
        message: 'Feature tracker created successfully'
      }, status: :created
    else
      render json: {
        success: false,
        errors: @feature_tracker.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  def update
    if @feature_tracker.update(feature_tracker_params)
      render json: {
        success: true,
        feature_tracker: @feature_tracker.as_json(methods: [:completion_percentage, :fully_complete?]),
        message: 'Feature tracker updated successfully'
      }
    else
      render json: {
        success: false,
        errors: @feature_tracker.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  def destroy
    @feature_tracker.destroy
    render json: {
      success: true,
      message: 'Feature tracker deleted successfully'
    }
  end

  private

  def set_feature_tracker
    @feature_tracker = FeatureTracker.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: {
      success: false,
      error: 'Feature tracker not found'
    }, status: :not_found
  end

  def feature_tracker_params
    params.require(:feature_tracker).permit(
      :chapter,
      :feature_chapter_id,
      :feature_name,
      :detail_point_1,
      :detail_point_2,
      :detail_point_3,
      :system_complete,
      :dev_progress,
      :dev_checked,
      :tester_checked,
      :ui_checked,
      :user_checked,
      :sort_order,
      :trapid_has,
      :buildertrend_has,
      :buildexact_has,
      :jacks_has,
      :wunderbuilt_has,
      :databuild_has,
      :simpro_has,
      :smarterbuild_has,
      :clickhome_has,
      :clickup_has
    )
  end
end
