class SeedSmSettingTradesAndStages < ActiveRecord::Migration[8.0]
  def up
    settings = SmSetting.instance

    # Common construction trades (only add if empty to avoid duplicates)
    if settings.trades.empty?
      trades = ['PLUMBING', 'ELECTRICAL', 'CARPENTRY', 'CONCRETE', 'ROOFING',
                'PAINTING', 'TILING', 'LANDSCAPING', 'HVAC', 'GLAZING',
                'STEEL', 'PLASTERING', 'INSULATION', 'FLOORING', 'CABINETRY']
      settings.update!(schedule_master_trades: trades)
    end

    # Common construction stages (only add if empty to avoid duplicates)
    if settings.stages.empty?
      stages = ['SITE PREP', 'FOUNDATION', 'SLAB', 'FRAME', 'ROUGH-IN',
                'LOCK-UP', 'FIX-OUT', 'COMPLETION', 'HANDOVER', 'DEFECTS']
      settings.update!(schedule_master_stages: stages)
    end
  end

  def down
    # Don't clear data on rollback - users may have customized these
  end
end
