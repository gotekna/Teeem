module Api
  module V1
    class SystemController < ApplicationController
      # GET /api/v1/system/health
      def health
        render json: {
          status: 'healthy',
          timestamp: Time.current,
          database: check_database,
          redis: check_redis,
          storage: check_storage,
          memory: check_memory,
          claude: check_claude
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
            constructions: Construction.count,
            contacts: Contact.count,
            purchase_orders: PurchaseOrder.count,
            estimates: Estimate.count
          }
        }
      end

      private

      def check_database
        ActiveRecord::Base.connection.active?
        { status: 'connected' }
      rescue StandardError => e
        { status: 'error', message: e.message }
      end

      def check_redis
        # Add Redis check if you're using it
        { status: 'not_configured' }
      rescue StandardError => e
        { status: 'error', message: e.message }
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
        api_key = ENV['ANTHROPIC_API_KEY']
        if api_key.blank?
          return { status: 'not_configured', message: 'ANTHROPIC_API_KEY not set' }
        end

        # Quick connectivity test
        begin
          require 'anthropic'
          client = Anthropic::Client.new(access_token: api_key)
          # Make a minimal test call
          response = client.messages(
            parameters: {
              model: 'claude-3-haiku-20240307',
              max_tokens: 5,
              messages: [{ role: 'user', content: 'Hi' }]
            }
          )
          { status: 'connected', key_present: true, test_successful: true }
        rescue Anthropic::Error => e
          { status: 'error', key_present: true, message: e.message }
        rescue => e
          { status: 'error', key_present: true, message: e.class.to_s + ': ' + e.message }
        end
      end

      def get_memory_usage
        # Get memory usage in MB
        if RUBY_PLATFORM =~ /darwin/
          `ps -o rss= -p #{Process.pid}`.to_i / 1024
        else
          `ps -o rss= -p #{Process.pid}`.to_i / 1024
        end
      rescue
        0
      end

      def get_rss_memory
        # Resident Set Size memory
        GC.stat[:heap_allocated_pages] * 16 / 1024 # Convert to MB
      rescue
        0
      end

      def count_tmp_files
        Dir.glob(Rails.root.join('tmp', '**', '*')).select { |f| File.file?(f) }.count
      rescue
        0
      end

      def get_log_size
        log_files = Dir.glob(Rails.root.join('log', '*.log'))
        total_size = log_files.sum { |f| File.size(f) rescue 0 }
        (total_size / 1024.0 / 1024.0).round(2) # Convert to MB
      rescue
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

      def get_pending_jobs_count
        # If using SolidQueue
        SolidQueue::Job.pending.count
      rescue
        0
      end

      def get_failed_jobs_count
        # If using SolidQueue
        SolidQueue::Job.failed.count
      rescue
        0
      end
    end
  end
end
