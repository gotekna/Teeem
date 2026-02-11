module Api
  module V1
    class SystemController < ApplicationController
      # GET /api/v1/system/health
      # Comprehensive system health including infrastructure and data quality
      def health
        # Get data health from new service architecture
        data_health = HealthChecks::Registry.system_health

        # Calculate overall status
        infrastructure = {
          database: check_database,
          redis: check_redis,
          storage: check_storage,
          memory: check_memory,
          claude: check_claude
        }

        infra_healthy = infrastructure.values.all? { |v| v[:status] != "error" }
        data_healthy = data_health[:status] != "critical"

        overall_status = if infra_healthy && data_healthy
                          "healthy"
        elsif infra_healthy
                          "degraded"
        else
                          "unhealthy"
        end

        render json: {
          success: true,
          status: overall_status,
          timestamp: Time.current,
          overall_health: data_health[:overall_health],

          # Infrastructure health
          infrastructure: infrastructure,

          # Data quality health (from HealthChecks::Registry)
          data_health: {
            overall_health: data_health[:overall_health],
            status: data_health[:status],
            summary: data_health[:summary],
            checks: data_health[:checks]
          },

          # Quick stats
          stats: {
            jobs_count: Job.count,
            contacts_count: Contact.count,
            pricebook_items_count: PricebookItem.count,
            companies_count: Corporate.count,
            pending_jobs: get_pending_jobs_count,
            failed_jobs: get_failed_jobs_count
          }
        }
      end

      # GET /api/v1/system/performance
      def performance
        render json: {
          timestamp: Time.current,
          server: {
            ruby_version: RUBY_VERSION,
            rails_version: Rails.version,
            environment: Rails.env,
            uptime_seconds: Process.clock_gettime(Process::CLOCK_MONOTONIC),
            threads: Thread.list.count
          },
          database: {
            connected: ActiveRecord::Base.connected?,
            pool_size: ActiveRecord::Base.connection_pool.size,
            active_connections: ActiveRecord::Base.connection_pool.connections.count
          },
          memory: {
            used_mb: get_memory_usage,
            rss_mb: get_rss_memory
          },
          cache: {
            tmp_files: count_tmp_files,
            log_size_mb: get_log_size
          }
        }
      end

      # GET /api/v1/system/scheduled_jobs
      # Returns all recurring scheduled jobs with their status and run history
      def scheduled_jobs
        # Load recurring tasks from database (synced from config/recurring.yml)
        tasks = SolidQueue::RecurringTask.order(:key)

        # Get last execution times
        last_executions = SolidQueue::RecurringExecution
          .select("task_key, MAX(run_at) as last_run_at")
          .group(:task_key)
          .index_by(&:task_key)

        # Get queue depth stats
        queue_stats = SolidQueue::ReadyExecution
          .joins(:job)
          .select("solid_queue_jobs.queue_name, COUNT(*) as count")
          .group("solid_queue_jobs.queue_name")
          .map { |r| [r.queue_name, r.count] }
          .to_h

        # Build task list with execution info
        scheduled_jobs = tasks.map do |task|
          last_exec = last_executions[task.key]
          next_run = calculate_next_run(task.schedule, last_exec&.last_run_at)

          {
            id: task.id,
            key: task.key,
            class_name: task.class_name.presence || "(command)",
            command: task.command,
            schedule: task.schedule,
            schedule_human: humanize_schedule(task.schedule),
            queue_name: task.queue_name || "default",
            arguments: task.arguments,
            description: task.description,
            last_run_at: last_exec&.last_run_at,
            next_run_at: next_run,
            status: determine_status(last_exec&.last_run_at, next_run)
          }
        end

        render json: {
          success: true,
          data: {
            scheduled_jobs: scheduled_jobs,
            queue_stats: queue_stats,
            worker_info: {
              threads: worker_thread_count,
              processes: worker_process_count
            },
            config_source: "config/recurring.yml"
          }
        }
      end

      # GET /api/v1/system/queue_status
      # Throughput-aware endpoint for header bar worker queue health indicator
      def queue_status
        alive_cutoff = 5.minutes.ago

        # 1. Process breakdown by kind (Worker/Dispatcher/Scheduler)
        processes_raw = SolidQueue::Process
          .where("last_heartbeat_at > ?", alive_cutoff)
          .pluck(:kind, :last_heartbeat_at, :hostname)

        processes = processes_raw
          .group_by { |kind, _, _| kind }
          .transform_values { |rows| { count: rows.size, latestHeartbeat: rows.map { |_, hb, _| hb }.max&.iso8601 } }

        worker_count = processes.dig("Worker", :count) || 0

        # 2. Execution counts (all indexed COUNTs on small tables)
        pending = SolidQueue::ReadyExecution.count
        running = SolidQueue::ClaimedExecution.count
        failed = SolidQueue::FailedExecution.count
        scheduled = SolidQueue::ScheduledExecution.count
        blocked = SolidQueue::BlockedExecution.count

        # 3. Throughput (last 5 min)
        recent_completed = SolidQueue::Job.where("finished_at > ?", 5.minutes.ago).count
        completed_per_min = (recent_completed / 5.0).round(1)

        trend = if running == 0 && pending == 0
                  "idle"
                elsif running > 0 && (pending < 50 || completed_per_min > 0)
                  pending > 100 ? "draining" : "idle"
                elsif pending > 50 && running == 0
                  "stuck"
                else
                  "stable"
                end

        # 4. Smart status
        status_result = compute_queue_status(
          worker_count: worker_count, pending: pending, running: running,
          failed: failed, trend: trend
        )

        # 5. Queue depth by queue
        queue_depth = SolidQueue::ReadyExecution
          .joins(:job)
          .group("solid_queue_jobs.queue_name")
          .count
          .map { |queue, count| { queue: queue, count: count } }
          .sort_by { |q| -q[:count] }

        # 6. Paused queues
        paused_queues = SolidQueue::Pause.pluck(:queue_name)

        # 7. Top failed (only if failed > 0)
        top_failed = if failed > 0
          SolidQueue::FailedExecution
            .joins(:job)
            .select("solid_queue_jobs.class_name, COUNT(*) as count")
            .group("solid_queue_jobs.class_name")
            .order("count DESC")
            .limit(5)
            .map { |r| { className: r.class_name.delete_suffix("Job"), count: r.count } }
        else
          []
        end

        render json: {
          success: true,
          data: {
            status: status_result[:level],
            statusMessage: status_result[:message],
            processes: processes,
            pending: pending,
            running: running,
            failed: failed,
            scheduled: scheduled,
            blocked: blocked,
            completedPerMin: completed_per_min,
            trend: trend,
            queueDepth: queue_depth,
            pausedQueues: paused_queues,
            topFailed: top_failed,
            watchdog: WorkerWatchdog.last_status.slice(:status, :last_heartbeat, :staleness_seconds)
          }
        }
      rescue StandardError => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # DELETE /api/v1/system/clear_failed_jobs
      # Clears all failed job executions (resets the counter)
      def clear_failed_jobs
        count = SolidQueue::FailedExecution.count
        SolidQueue::FailedExecution.delete_all

        render json: {
          success: true,
          data: { cleared: count }
        }
      rescue StandardError => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # GET /api/v1/system/metrics
      def metrics
        render json: {
          timestamp: Time.current,
          requests: {
            total: get_request_count,
            recent: get_recent_requests
          },
          jobs: {
            pending: get_pending_jobs_count,
            failed: get_failed_jobs_count
          },
          records: {
            constructions: Job.count,
            contacts: Contact.count,
            purchase_orders: PurchaseOrder.count,
            estimates: Estimate.count
          }
        }
      end

      private

      def check_database
        ActiveRecord::Base.connection.active?
        { status: "connected" }
      rescue StandardError => e
        { status: "error", message: e.message }
      end

      def check_redis
        # Add Redis check if you're using it
        { status: "not_configured" }
      rescue StandardError => e
        { status: "error", message: e.message }
      end

      def check_storage
        {
          tmp_files: count_tmp_files,
          log_size_mb: get_log_size
        }
      end

      def check_memory
        {
          used_mb: get_memory_usage,
          rss_mb: get_rss_memory
        }
      end

      def check_claude
        api_key = ENV["ANTHROPIC_API_KEY"]
        if api_key.blank?
          return { status: "not_configured", message: "ANTHROPIC_API_KEY not set" }
        end

        # Quick connectivity test
        begin
          require "anthropic"
          client = Anthropic::Client.new(access_token: api_key)
          # Make a minimal test call
          response = client.messages(
            parameters: {
              model: "claude-3-haiku-20240307",
              max_tokens: 5,
              messages: [ { role: "user", content: "Hi" } ]
            }
          )
          { status: "connected", key_present: true, test_successful: true }
        rescue Anthropic::Error => e
          { status: "error", key_present: true, message: e.message }
        rescue => e
          { status: "error", key_present: true, message: e.class.to_s + ": " + e.message }
        end
      end

      def get_memory_usage
        # Get memory usage in MB
        if RUBY_PLATFORM =~ /darwin/
          `ps -o rss= -p #{Process.pid}`.to_i / 1024
        else
          `ps -o rss= -p #{Process.pid}`.to_i / 1024
        end
      rescue StandardError => e
        Rails.logger.warn "[SystemController] get_process_memory failed: #{e.message}"
        0
      end

      def get_rss_memory
        # Resident Set Size memory
        GC.stat[:heap_allocated_pages] * 16 / 1024 # Convert to MB
      rescue StandardError => e
        Rails.logger.warn "[SystemController] get_rss_memory failed: #{e.message}"
        0
      end

      def count_tmp_files
        Dir.glob(Rails.root.join("tmp", "**", "*")).select { |f| File.file?(f) }.count
      rescue StandardError => e
        Rails.logger.warn "[SystemController] count_tmp_files failed: #{e.message}"
        0
      end

      def get_log_size
        log_files = Dir.glob(Rails.root.join("log", "*.log"))
        total_size = log_files.sum { |f| File.size(f) rescue 0 }
        (total_size / 1024.0 / 1024.0).round(2) # Convert to MB
      rescue StandardError => e
        Rails.logger.warn "[SystemController] get_log_size failed: #{e.message}"
        0
      end

      def get_request_count
        # This would need to be tracked via middleware or logging
        # For now, return a placeholder
        0
      end

      def get_recent_requests
        # Recent requests tracking would need middleware
        []
      end

      def compute_queue_status(worker_count:, pending:, running:, failed:, trend:)
        # Error: no workers at all
        if worker_count == 0
          return { level: "error", message: "No workers running" }
        end

        # Error: stuck - lots pending but nothing running
        if trend == "stuck"
          return { level: "error", message: "Queue stuck - #{pending} pending, none running" }
        end

        # Degraded: high failure count
        if failed > 50
          return { level: "degraded", message: "#{failed} failed jobs need attention" }
        end

        # Busy: actively processing a backlog
        if pending > 50 && running > 0
          return { level: "busy", message: "Processing - #{running} running, #{pending} queued" }
        end

        # Minor failures worth noting
        if failed > 10
          return { level: "busy", message: "#{failed} failed jobs" }
        end

        # Healthy
        msg = running > 0 ? "#{worker_count} workers, #{running} running" : "#{worker_count} workers, idle"
        { level: "healthy", message: msg }
      end

      def get_pending_jobs_count
        SolidQueue::ReadyExecution.count
      rescue StandardError => e
        Rails.logger.debug "[SystemController] get_pending_jobs_count unavailable: #{e.message}"
        0
      end

      def get_failed_jobs_count
        SolidQueue::FailedExecution.count
      rescue StandardError => e
        Rails.logger.debug "[SystemController] get_failed_jobs_count unavailable: #{e.message}"
        0
      end

      # Scheduled jobs helpers

      def calculate_next_run(schedule, last_run_at)
        return nil unless schedule.present?

        # Parse common schedule patterns
        base_time = last_run_at || Time.current

        case schedule
        when /every (\d+) minutes?/i
          minutes = $1.to_i
          next_time = base_time + minutes.minutes
          next_time = Time.current + minutes.minutes if next_time < Time.current
          next_time
        when /every (\d+) hours?( at minute (\d+))?/i
          hours = $1.to_i
          minute = $3&.to_i || 0
          next_time = base_time.beginning_of_hour + hours.hours + minute.minutes
          next_time = Time.current.beginning_of_hour + minute.minutes if next_time < Time.current
          next_time += hours.hours if next_time < Time.current
          next_time
        when /every hour at minute (\d+)/i
          minute = $1.to_i
          next_time = Time.current.beginning_of_hour + minute.minutes
          next_time += 1.hour if next_time < Time.current
          next_time
        when /at (\d+)am every day/i
          hour = $1.to_i
          # SSoT: Use TenantSetting for timezone
          next_time = TenantSetting.now.beginning_of_day + hour.hours
          next_time += 1.day if next_time < Time.current
          next_time
        else
          nil
        end
      rescue StandardError => e
        Rails.logger.warn "[SystemController] calculate_next_run failed for '#{schedule}': #{e.message}"
        nil
      end

      def humanize_schedule(schedule)
        return "Unknown" unless schedule.present?

        # Convert schedule patterns to human-readable
        case schedule
        when /every 15 minutes/i
          "Every 15 min"
        when /every 30 minutes/i
          "Every 30 min"
        when /every (\d+) minutes?/i
          "Every #{$1} min"
        when /every hour at minute (\d+)/i
          "Hourly at :#{$1.rjust(2, '0')}"
        when /every (\d+) hours? at minute (\d+)/i
          "Every #{$1}h at :#{$2.rjust(2, '0')}"
        when /every (\d+) hours?/i
          "Every #{$1}h"
        when /at (\d+)am every day/i
          "Daily at #{$1}am"
        when /at (\d+)pm every day/i
          "Daily at #{$1}pm"
        else
          schedule
        end
      end

      def determine_status(last_run_at, next_run_at)
        return "pending" unless last_run_at

        if next_run_at && next_run_at < Time.current - 5.minutes
          "overdue"
        else
          "ok"
        end
      end

      def worker_thread_count
        # Read from queue.yml config
        queue_config = Rails.application.config_for(:queue) rescue {}
        workers = queue_config[:workers] || []
        workers.sum { |w| w[:threads] || 0 }
      rescue StandardError => e
        Rails.logger.debug "[SystemController] worker_thread_count unavailable: #{e.message}"
        3 # Default
      end

      def worker_process_count
        queue_config = Rails.application.config_for(:queue) rescue {}
        workers = queue_config[:workers] || []
        workers.sum { |w| w[:processes] || 1 }
      rescue StandardError => e
        Rails.logger.debug "[SystemController] worker_process_count unavailable: #{e.message}"
        1
      end
    end
  end
end
