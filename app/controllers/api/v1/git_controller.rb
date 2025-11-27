module Api
  module V1
    class GitController < ApplicationController
      # GET /api/v1/git/branch_status
      def branch_status
        begin
          # Check if git is available
          unless git_available?
            return render json: {
              git_available: false,
              current_branch: 'unknown',
              branches: [],
              commit_stats: {
                total_branches: 0,
                local_branches: 0,
                remote_branches: 0
              },
              message: 'Git is not available in this environment'
            }
          end

          # Get current branch
          current_branch = `git branch --show-current`.strip

          # Get all local branches
          local_branches = `git branch`.split("\n").map do |line|
            line.strip.gsub(/^\* /, '')
          end

          # Get remote branches
          remote_branches = `git branch -r`.split("\n").map do |line|
            line.strip.gsub(/^origin\//, '').gsub(/^heroku\//, '')
          end.uniq.reject { |b| b.include?('HEAD') }

          # Focus on main and rob branches, plus any other local branches
          main_branches = ['main', 'rob', 'jake'].select { |b| local_branches.include?(b) || remote_branches.include?(b) }

          branches_data = main_branches.map do |branch_name|
            is_current = (branch_name == current_branch)

            # Get last commit info
            commit_hash = `git log #{branch_name} --oneline -1 2>/dev/null`.strip.split(' ').first rescue 'N/A'
            commit_message = `git log #{branch_name} --oneline -1 --pretty=format:"%s" 2>/dev/null`.strip rescue 'No commits'
            commit_author = `git log #{branch_name} --oneline -1 --pretty=format:"%an" 2>/dev/null`.strip rescue 'Unknown'
            commit_date = `git log #{branch_name} --oneline -1 --pretty=format:"%ar" 2>/dev/null`.strip rescue 'Unknown'

            # Check if branch exists on remotes
            has_origin = `git branch -r 2>/dev/null`.include?("origin/#{branch_name}")
            has_heroku = `git branch -r 2>/dev/null`.include?("heroku/#{branch_name}")
            deployed_to_heroku = (branch_name == 'rob' && has_heroku) # rob is deployed to heroku/main

            # Get commits ahead/behind main (only for non-main branches)
            commits_comparison = nil
            if branch_name != 'main'
              ahead = `git rev-list --count main..#{branch_name} 2>/dev/null`.strip.to_i rescue 0
              behind = `git rev-list --count #{branch_name}..main 2>/dev/null`.strip.to_i rescue 0
              commits_comparison = {
                ahead: ahead,
                behind: behind
              }
            end

            {
              name: branch_name,
              is_current: is_current,
              last_commit: {
                hash: commit_hash,
                message: commit_message,
                author: commit_author,
                date: commit_date
              },
              remote_info: {
                origin: has_origin,
                heroku: has_heroku
              },
              deployed_to_heroku: deployed_to_heroku,
              commits_comparison: commits_comparison
            }
          end

          # Sort: current first, then main, then rob, then others
          branches_data.sort_by! do |b|
            if b[:is_current]
              0
            elsif b[:name] == 'main'
              1
            elsif b[:name] == 'rob'
              2
            elsif b[:name] == 'jake'
              3
            else
              4
            end
          end

          render json: {
            current_branch: current_branch,
            branches: branches_data,
            commit_stats: {
              total_branches: local_branches.count + remote_branches.count,
              local_branches: local_branches.count,
              remote_branches: remote_branches.count
            }
          }
        rescue => e
          render json: { error: "Failed to fetch git branch status: #{e.message}" }, status: :internal_server_error
        end
      end

      private

      # Check if git command is available
      def git_available?
        return @git_available unless @git_available.nil?
        @git_available = begin
          # Use File.exist? to check if git is in PATH
          ENV['PATH'].split(':').any? do |dir|
            File.executable?(File.join(dir, 'git'))
          end
        rescue => e
          false
        end
      end
    end
  end
end
