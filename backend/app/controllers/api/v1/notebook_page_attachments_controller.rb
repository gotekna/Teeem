# frozen_string_literal: true

class Api::V1::NotebookPageAttachmentsController < ApplicationController
  before_action :set_page, only: [:index, :create]
  before_action :set_attachment, only: [:show, :destroy, :download]
  before_action :authorize_view!, only: [:index, :show, :download]
  before_action :authorize_edit!, only: [:create, :destroy]

  # GET /api/v1/notebook_pages/:notebook_page_id/attachments
  def index
    @attachments = @page.attachments.order(created_at: :desc)
    render json: { success: true, attachments: @attachments.map { |a| attachment_json(a) } }
  end

  # GET /api/v1/notebook_page_attachments/:id
  def show
    render json: { success: true, attachment: attachment_json(@attachment) }
  end

  # POST /api/v1/notebook_pages/:notebook_page_id/attachments
  def create
    unless params[:file].present?
      render json: { success: false, error: "File is required" }, status: :unprocessable_entity
      return
    end

    uploaded_file = params[:file]

    @attachment = @page.attachments.build(
      file_name: uploaded_file.original_filename,
      content_type: uploaded_file.content_type,
      file_size: uploaded_file.size,
      storage_key: SecureRandom.uuid,
      uploaded_by: current_user
    )

    # SSoT: Attach via StorageBlob (Jan 2026 - replaces ActiveStorage)
    @attachment.attach_file(
      uploaded_file.read,
      filename: uploaded_file.original_filename,
      content_type: uploaded_file.content_type
    )

    if @attachment.save
      render json: { success: true, attachment: attachment_json(@attachment) }, status: :created
    else
      render json: { success: false, errors: @attachment.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/notebook_page_attachments/:id
  def destroy
    # SSoT: StorageBlob handles reference counting on destroy (Jan 2026)
    @attachment.destroy!
    render json: { success: true }
  end

  # GET /api/v1/notebook_page_attachments/:id/download
  def download
    unless @attachment.has_file?
      render json: { success: false, error: "File not found" }, status: :not_found
      return
    end

    # SSoT: Use StorageBlob presigned URL (Jan 2026)
    url = @attachment.file_url

    render json: { success: true, url: url, file_name: @attachment.file_name }
  end

  private

  def set_page
    @page = NotebookPage.find(params[:notebook_page_id])
  end

  def set_attachment
    @attachment = NotebookPageAttachment.find(params[:id])
  end

  def authorize_view!
    notebook = @page&.notebook || @attachment&.notebook
    return if notebook.nil?

    unless notebook.accessible_by?(current_user)
      render json: { success: false, error: "Not authorized" }, status: :forbidden
    end
  end

  def authorize_edit!
    notebook = @page&.notebook || @attachment&.notebook
    return if notebook.nil?

    unless notebook.editable_by?(current_user)
      render json: { success: false, error: "Not authorized to edit" }, status: :forbidden
    end
  end

  def attachment_json(attachment)
    {
      id: attachment.id,
      file_name: attachment.file_name,
      content_type: attachment.content_type,
      file_size: attachment.file_size,
      human_size: attachment.human_size,
      is_image: attachment.image?,
      extension: attachment.extension,
      uploaded_by: attachment.uploaded_by&.slice(:id, :name),
      created_at: attachment.created_at,
      url: attachment.file_url  # SSoT: StorageBlob presigned URL (Jan 2026)
    }
  end
end
