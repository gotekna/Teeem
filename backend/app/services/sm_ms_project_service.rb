# frozen_string_literal: true

require 'nokogiri'

# SmMsProjectService - Import/Export MS Project XML files
#
# Supports MS Project XML format for interoperability
#
class SmMsProjectService
  attr_reader :construction

  def initialize(construction)
    @construction = construction
  end

  # Import tasks from MS Project XML
  def import(xml_content)
    doc = Nokogiri::XML(xml_content)
    doc.remove_namespaces!

    tasks_created = []
    task_uid_map = {} # Map MS Project UID to SmTask ID

    # Parse tasks
    doc.xpath('//Task').each do |task_node|
      uid = task_node.at_xpath('UID')&.text
      name = task_node.at_xpath('Name')&.text
      next if name.blank? || name == construction.name # Skip project summary

      # Parse dates
      start_date = parse_date(task_node.at_xpath('Start')&.text)
      finish_date = parse_date(task_node.at_xpath('Finish')&.text)
      duration = parse_duration(task_node.at_xpath('Duration')&.text)

      # Parse other fields
      notes = task_node.at_xpath('Notes')&.text
      percent_complete = task_node.at_xpath('PercentComplete')&.text&.to_i || 0
      outline_level = task_node.at_xpath('OutlineLevel')&.text&.to_i || 1
      wbs = task_node.at_xpath('WBS')&.text

      # Determine status
      status = if percent_complete >= 100
                 'completed'
               elsif percent_complete > 0
                 'started'
               else
                 'not_started'
               end

      # Create task
      sm_task = construction.sm_tasks.create!(
        name: name,
        start_date: start_date || Date.current,
        end_date: finish_date || (start_date || Date.current) + (duration || 1).days,
        duration_days: duration || 1,
        status: status,
        percent_complete: percent_complete,
        notes: notes,
        wbs_code: wbs,
        outline_level: outline_level,
        task_number: construction.sm_tasks.count + 1,
        external_uid: uid
      )

      task_uid_map[uid] = sm_task.id
      tasks_created << sm_task
    end

    # Parse dependencies (predecessor links)
    doc.xpath('//Task').each do |task_node|
      uid = task_node.at_xpath('UID')&.text
      sm_task_id = task_uid_map[uid]
      next unless sm_task_id

      task_node.xpath('PredecessorLink').each do |pred_link|
        pred_uid = pred_link.at_xpath('PredecessorUID')&.text
        pred_task_id = task_uid_map[pred_uid]
        next unless pred_task_id

        link_type = pred_link.at_xpath('Type')&.text&.to_i || 1
        lag = parse_duration(pred_link.at_xpath('LinkLag')&.text) || 0

        SmDependency.create!(
          predecessor_task_id: pred_task_id,
          successor_task_id: sm_task_id,
          dependency_type: map_link_type(link_type),
          lag_days: lag
        )
      end
    end

    {
      success: true,
      tasks_imported: tasks_created.count,
      tasks: tasks_created.map { |t| { id: t.id, name: t.name } }
    }
  rescue StandardError => e
    { success: false, error: e.message }
  end

  # Export tasks to MS Project XML
  def export
    builder = Nokogiri::XML::Builder.new(encoding: 'UTF-8') do |xml|
      xml.Project(xmlns: 'http://schemas.microsoft.com/project') do
        xml.Name construction.name
        xml.StartDate construction.sm_tasks.minimum(:start_date)&.iso8601
        xml.FinishDate construction.sm_tasks.maximum(:end_date)&.iso8601
        xml.CalendarUID 1

        # Calendars
        xml.Calendars do
          xml.Calendar do
            xml.UID 1
            xml.Name 'Standard'
            xml.IsBaseCalendar 1
            xml.WeekDays do
              (1..7).each do |day|
                xml.WeekDay do
                  xml.DayType day
                  xml.DayWorking(day.between?(2, 6) ? 1 : 0) # Mon-Fri working
                end
              end
            end
          end
        end

        # Tasks
        xml.Tasks do
          # Project summary task
          xml.Task do
            xml.UID 0
            xml.ID 0
            xml.Name construction.name
            xml.Type 1
            xml.IsNull 0
            xml.OutlineLevel 0
            xml.Summary 1
          end

          construction.sm_tasks.order(:task_number).each_with_index do |task, index|
            xml.Task do
              xml.UID task.id
              xml.ID index + 1
              xml.Name task.name
              xml.Type 0
              xml.IsNull 0
              xml.Start task.start_date&.iso8601
              xml.Finish task.end_date&.iso8601
              xml.Duration format_duration(task.duration_days)
              xml.DurationFormat 7 # Days
              xml.PercentComplete task.percent_complete || status_to_percent(task.status)
              xml.Notes task.notes if task.notes.present?
              xml.OutlineLevel task.outline_level || 1
              xml.WBS task.wbs_code if task.wbs_code.present?

              # Predecessor links
              task.predecessor_dependencies.each do |dep|
                xml.PredecessorLink do
                  xml.PredecessorUID dep.predecessor_task_id
                  xml.Type reverse_map_link_type(dep.dependency_type)
                  xml.LinkLag format_duration(dep.lag_days || 0)
                  xml.LagFormat 7
                end
              end
            end
          end
        end

        # Resources
        xml.Resources do
          SmResource.joins(:allocations)
                    .where(sm_resource_allocations: { sm_task_id: construction.sm_tasks.pluck(:id) })
                    .distinct
                    .each_with_index do |resource, index|
            xml.Resource do
              xml.UID resource.id
              xml.ID index + 1
              xml.Name resource.name
              xml.Type resource.resource_type == 'labor' ? 1 : 0
              xml.MaxUnits 1
              xml.StandardRate resource.hourly_rate || 0
              xml.StandardRateFormat 2 # Per hour
            end
          end
        end

        # Assignments
        xml.Assignments do
          assignment_uid = 0
          construction.sm_tasks.includes(:resource_allocations).each do |task|
            task.resource_allocations.each do |allocation|
              xml.Assignment do
                xml.UID(assignment_uid += 1)
                xml.TaskUID task.id
                xml.ResourceUID allocation.resource_id
                xml.Units 1
                xml.Work format_duration(allocation.allocated_hours.to_i / 8)
              end
            end
          end
        end
      end
    end

    builder.to_xml
  end

  private

  def parse_date(date_str)
    return nil if date_str.blank?

    Date.parse(date_str)
  rescue ArgumentError
    nil
  end

  def parse_duration(duration_str)
    return nil if duration_str.blank?

    # MS Project duration format: PT8H0M0S (8 hours) or P5D (5 days)
    if duration_str.start_with?('PT')
      # Hours format
      hours = duration_str.scan(/(\d+)H/).flatten.first&.to_i || 0
      (hours / 8.0).ceil
    elsif duration_str.start_with?('P')
      # Days format
      duration_str.scan(/(\d+)D/).flatten.first&.to_i || 1
    else
      1
    end
  end

  def format_duration(days)
    "PT#{(days || 1) * 8}H0M0S"
  end

  def map_link_type(ms_type)
    # MS Project: 0=FF, 1=FS, 2=SF, 3=SS
    case ms_type
    when 0 then 'finish_to_finish'
    when 1 then 'finish_to_start'
    when 2 then 'start_to_finish'
    when 3 then 'start_to_start'
    else 'finish_to_start'
    end
  end

  def reverse_map_link_type(dep_type)
    case dep_type
    when 'finish_to_finish' then 0
    when 'finish_to_start' then 1
    when 'start_to_finish' then 2
    when 'start_to_start' then 3
    else 1
    end
  end

  def status_to_percent(status)
    case status
    when 'completed' then 100
    when 'started' then 50
    else 0
    end
  end

  class << self
    def import(construction, xml_content)
      new(construction).import(xml_content)
    end

    def export(construction)
      new(construction).export
    end
  end
end
