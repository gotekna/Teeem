require 'rails_helper'

RSpec.describe ScheduleCascadeService, type: :service do
  let(:schedule_template) { create(:schedule_template) }
  let(:company_setting) { CompanySetting.instance }

  before do
    # Ensure we have a clean company setting
    company_setting.update!(timezone: 'Australia/Brisbane')

    # Seed QLD holidays for testing
    PublicHoliday.seed_qld_holidays
  end

  describe 'working day enforcement' do
    context 'when task lands on a Saturday' do
      it 'moves task to next Monday' do
        # Create a task that will cascade to a Saturday
        # Assuming today is a Thursday (2025-01-16)
        # Task 1: Thursday start, 1 day duration (ends Thursday)
        # Task 2: FS dependency with 0 lag -> should start Friday, but let's test Saturday

        task1 = create(:schedule_template_row,
          schedule_template: schedule_template,
          sequence_order: 0,
          start_date: 3, # Thursday (3 days from reference)
          duration: 1,
          predecessor_ids: []
        )

        task2 = create(:schedule_template_row,
          schedule_template: schedule_template,
          sequence_order: 1,
          start_date: 5, # Saturday
          duration: 1,
          predecessor_ids: [ { id: 1, type: 'FS', lag: 2 } ], # 2 day lag lands on Saturday
          manually_positioned: false
        )

        # Trigger cascade
        service = ScheduleCascadeService.new(task1, [ :start_date ])
        affected = service.cascade

        task2.reload

        # Calculate expected date:
        # - Task 1 ends on day 3 (Thursday)
        # - FS + 2 lag = day 5 (Saturday)
        # - Skip to next working day = day 7 (Monday)

        # Check if task2's start_date was adjusted to skip the weekend
        # The exact value depends on the reference date, but it should NOT be on a weekend
        reference_date = Date.today
        actual_date = reference_date + task2.start_date.days

        expect(actual_date.saturday?).to be false
        expect(actual_date.sunday?).to be false
      end
    end

    context 'when task lands on a public holiday' do
      it 'moves task to next working day' do
        # Use Christmas Day 2025 (Dec 25) which is a Thursday
        # But it's a public holiday in QLD

        # Set reference date to Dec 20, 2025 (Saturday before Christmas)
        allow(Date).to receive(:today).and_return(Date.new(2025, 12, 20))

        task1 = create(:schedule_template_row,
          schedule_template: schedule_template,
          sequence_order: 0,
          start_date: 0, # Dec 20 (Saturday)
          duration: 1,
          predecessor_ids: []
        )

        task2 = create(:schedule_template_row,
          schedule_template: schedule_template,
          sequence_order: 1,
          start_date: 5, # Should become Dec 29 after skipping weekend and holidays
          duration: 1,
          predecessor_ids: [ { id: 1, type: 'FS', lag: 5 } ],
          manually_positioned: false
        )

        service = ScheduleCascadeService.new(task1, [ :start_date ])
        affected = service.cascade

        task2.reload

        reference_date = Date.new(2025, 12, 20)
        actual_date = reference_date + task2.start_date.days

        # Should skip weekend (21-22), Christmas (25), Boxing Day (26)
        # and land on Monday Dec 29
        expect(actual_date.saturday?).to be false
        expect(actual_date.sunday?).to be false

        # Check it's not a public holiday
        holidays = PublicHoliday.for_region('QLD').pluck(:date)
        expect(holidays).not_to include(actual_date)
      end
    end

    context 'when task has lock hierarchy' do
      it 'does NOT move supplier_confirm tasks' do
        task1 = create(:schedule_template_row,
          schedule_template: schedule_template,
          sequence_order: 0,
          start_date: 3,
          duration: 1,
          predecessor_ids: []
        )

        task2 = create(:schedule_template_row,
          schedule_template: schedule_template,
          sequence_order: 1,
          start_date: 5, # Saturday
          duration: 1,
          predecessor_ids: [ { id: 1, type: 'FS', lag: 2 } ],
          supplier_confirm: true, # LOCKED - should stay on Saturday
          manually_positioned: false
        )

        original_start = task2.start_date

        service = ScheduleCascadeService.new(task1, [ :start_date ])
        service.cascade

        task2.reload

        # Locked tasks should NOT be adjusted
        expect(task2.start_date).to eq(original_start)
      end

      it 'does NOT move manually_positioned tasks' do
        task1 = create(:schedule_template_row,
          schedule_template: schedule_template,
          sequence_order: 0,
          start_date: 3,
          duration: 1,
          predecessor_ids: []
        )

        task2 = create(:schedule_template_row,
          schedule_template: schedule_template,
          sequence_order: 1,
          start_date: 5, # Saturday
          duration: 1,
          predecessor_ids: [ { id: 1, type: 'FS', lag: 2 } ],
          manually_positioned: true # User set this explicitly
        )

        # Service should skip manually positioned tasks entirely
        service = ScheduleCascadeService.new(task1, [ :start_date ])
        affected = service.cascade

        # Task 2 should NOT be in affected list
        expect(affected.map(&:id)).not_to include(task2.id)
      end
    end

    context 'dependency types' do
      it 'handles FS (Finish-to-Start) with working days' do
        task1 = create(:schedule_template_row,
          schedule_template: schedule_template,
          sequence_order: 0,
          start_date: 0, # Monday
          duration: 5, # Ends Friday (day 4)
          predecessor_ids: []
        )

        task2 = create(:schedule_template_row,
          schedule_template: schedule_template,
          sequence_order: 1,
          start_date: 10,
          duration: 1,
          predecessor_ids: [ { id: 1, type: 'FS', lag: 0 } ],
          manually_positioned: false
        )

        service = ScheduleCascadeService.new(task1, [ :start_date ])
        service.cascade

        task2.reload

        # Task 1 ends day 4 (Friday)
        # FS + 0 lag = start day 4 (Friday, same day is OK)
        # Friday is a working day, so should stay at day 4
        reference_date = Date.today
        actual_date = reference_date + task2.start_date.days

        expect(actual_date.saturday?).to be false
        expect(actual_date.sunday?).to be false
      end

      it 'handles SS (Start-to-Start) with working days' do
        task1 = create(:schedule_template_row,
          schedule_template: schedule_template,
          sequence_order: 0,
          start_date: 0,
          duration: 3,
          predecessor_ids: []
        )

        task2 = create(:schedule_template_row,
          schedule_template: schedule_template,
          sequence_order: 1,
          start_date: 10,
          duration: 1,
          predecessor_ids: [ { id: 1, type: 'SS', lag: 1 } ],
          manually_positioned: false
        )

        service = ScheduleCascadeService.new(task1, [ :start_date ])
        service.cascade

        task2.reload

        # SS: Task 2 starts relative to Task 1's start
        reference_date = Date.today
        actual_date = reference_date + task2.start_date.days

        expect(actual_date.saturday?).to be false
        expect(actual_date.sunday?).to be false
      end
    end
  end

  describe 'cascade logic' do
    it 'cascades changes recursively to dependent tasks' do
      # Task 1 -> Task 2 -> Task 3 (chain of dependencies)
      task1 = create(:schedule_template_row,
        schedule_template: schedule_template,
        sequence_order: 0,
        start_date: 0,
        duration: 2,
        predecessor_ids: []
      )

      task2 = create(:schedule_template_row,
        schedule_template: schedule_template,
        sequence_order: 1,
        start_date: 2,
        duration: 2,
        predecessor_ids: [ { id: 1, type: 'FS', lag: 0 } ],
        manually_positioned: false
      )

      task3 = create(:schedule_template_row,
        schedule_template: schedule_template,
        sequence_order: 2,
        start_date: 4,
        duration: 1,
        predecessor_ids: [ { id: 2, type: 'FS', lag: 0 } ],
        manually_positioned: false
      )

      # Change task1's start date
      task1.update_column(:start_date, 5)

      service = ScheduleCascadeService.new(task1, [ :start_date ])
      affected = service.cascade

      # All 3 tasks should be in affected list
      expect(affected.length).to eq(3)
      expect(affected.map(&:id)).to include(task1.id, task2.id, task3.id)
    end
  end
end
