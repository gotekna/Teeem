"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calculator,
  Heart,
  Users,
  Building2,
  TrendingDown,
  ExternalLink,
  Gift,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Pricing calculation - TIERED BRACKETS (like tax brackets)
// First $1M: 2.2%
// Each $100k after: rate drops by 0.05% (2.15%, 2.10%, 2.05%... floor 0.2%)
const calculateAnnualCost = (turnover: number): {
  cost: number;
  effectiveRate: number;
  tiers: Array<{ from: number; to: number; rate: number; amount: number }>;
} => {
  const BASE_RATE = 2.2;
  const FIRST_MILLION = 1000000;
  const BRACKET_SIZE = 100000;
  const RATE_DROP = 0.05;
  const FLOOR_RATE = 0.2;

  const tiers: Array<{ from: number; to: number; rate: number; amount: number }> = [];

  // First $1M at base rate
  const firstMillionAmount = Math.min(turnover, FIRST_MILLION);
  const firstMillionCost = firstMillionAmount * (BASE_RATE / 100);
  tiers.push({ from: 0, to: firstMillionAmount, rate: BASE_RATE, amount: firstMillionCost });

  if (turnover <= FIRST_MILLION) {
    return { cost: firstMillionCost, effectiveRate: BASE_RATE, tiers };
  }

  // Calculate each $100k bracket after $1M
  let totalCost = firstMillionCost;
  let remaining = turnover - FIRST_MILLION;
  let currentThreshold = FIRST_MILLION;
  let bracketNumber = 1;

  while (remaining > 0) {
    const bracketAmount = Math.min(remaining, BRACKET_SIZE);
    const bracketRate = Math.max(FLOOR_RATE, BASE_RATE - bracketNumber * RATE_DROP);
    const bracketCost = bracketAmount * (bracketRate / 100);

    tiers.push({
      from: currentThreshold,
      to: currentThreshold + bracketAmount,
      rate: bracketRate,
      amount: bracketCost,
    });

    totalCost += bracketCost;
    remaining -= bracketAmount;
    currentThreshold += bracketAmount;
    bracketNumber++;
  }

  const effectiveRate = (totalCost / turnover) * 100;

  return { cost: totalCost, effectiveRate, tiers };
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

export function CostTab() {
  const [turnover, setTurnover] = React.useState<number>(1200000);
  const [inputValue, setInputValue] = React.useState<string>("1,200,000");

  // Calculate all values using tiered brackets
  const { cost: annualCost, effectiveRate, tiers } = calculateAnnualCost(turnover);
  const monthlyCost = annualCost / 12;

  // Revenue distribution
  const charityAmount = annualCost * 0.1;
  const supportLineAmount = annualCost * 0.2;
  const teeemAmount = annualCost * 0.7;

  // Rate breakdown
  const baseRate = 2.2;
  const rateProgress = ((baseRate - effectiveRate) / (baseRate - 0.2)) * 100;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    const numericValue = parseInt(rawValue) || 0;

    // Format with commas for display
    const formatted = numericValue.toLocaleString("en-AU");
    setInputValue(formatted);
    setTurnover(numericValue);
  };

  const handleInputBlur = () => {
    // Ensure minimum turnover of $10,000
    if (turnover < 10000) {
      setTurnover(10000);
      setInputValue("10,000");
    }
  };

  return (
    <div className="space-y-8 p-1">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pricing Calculator</h2>
        <p className="text-muted-foreground">
          See what TEEEM costs and where your money goes
        </p>
      </div>

      {/* Calculator Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Your Annual Turnover
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Turnover Input */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold">$</span>
            <Input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              className="text-2xl font-semibold h-14 max-w-xs"
              placeholder="500,000"
            />
            <span className="text-muted-foreground">per year</span>
          </div>

          {/* Quick Select Buttons */}
          <div className="flex flex-wrap gap-2">
            {[100000, 250000, 500000, 1000000, 2000000, 5000000, 10000000, 25000000, 50000000, 100000000].map((value) => (
              <button
                key={value}
                onClick={() => {
                  setTurnover(value);
                  setInputValue(value.toLocaleString("en-AU"));
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  turnover === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                {formatCurrency(value)}
              </button>
            ))}
          </div>

          {/* Results Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-4 text-center">
              <div className="text-sm text-muted-foreground mb-1">Effective Rate</div>
              <div className="text-3xl font-bold text-primary">
                {formatPercentage(effectiveRate)}
              </div>
            </div>
            <div className="bg-muted rounded-lg p-4 text-center">
              <div className="text-sm text-muted-foreground mb-1">Annual Cost</div>
              <div className="text-3xl font-bold">{formatCurrency(annualCost)}</div>
            </div>
            <div className="bg-muted rounded-lg p-4 text-center">
              <div className="text-sm text-muted-foreground mb-1">Monthly</div>
              <div className="text-3xl font-bold">{formatCurrency(monthlyCost)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Breakdown - Tiered */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Rate Breakdown (Tiered)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tier breakdown table */}
          <div className="space-y-1">
            {tiers.map((tier, index) => (
              <div
                key={index}
                className={cn(
                  "flex justify-between text-sm py-1.5 px-2 rounded",
                  index === 0 ? "bg-muted" : index % 2 === 0 ? "bg-muted/50" : ""
                )}
              >
                <span className="text-muted-foreground">
                  {index === 0
                    ? `First ${formatCurrency(tier.to)}`
                    : `${formatCurrency(tier.from)} - ${formatCurrency(tier.to)}`}
                  <span className="ml-2 text-xs">@ {formatPercentage(tier.rate)}</span>
                </span>
                <span className="font-medium">{formatCurrency(tier.amount)}</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2 flex justify-between font-semibold text-lg">
              <span>Total Annual Cost</span>
              <span className="text-primary">{formatCurrency(annualCost)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Effective rate</span>
              <span>{formatPercentage(effectiveRate)}</span>
            </div>
          </div>

          {/* Rate Scale */}
          <div className="pt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>2.20% (base)</span>
              <span>0.20% (minimum)</span>
            </div>
            <Progress value={Math.max(0, rateProgress)} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              First $1M at 2.20%. Each $100k after drops by 0.05% (2.15%, 2.10%, 2.05%... floor: 0.20%)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Where Your Money Goes */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Where Your Money Goes</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Charity Card */}
          <Card className="border-pink-200 dark:border-pink-800 bg-gradient-to-br from-pink-50 to-white dark:from-pink-950/20 dark:to-background">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Heart className="h-8 w-8 text-pink-500" />
                <Badge variant="secondary" className="bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300">
                  10%
                </Badge>
              </div>
              <CardTitle className="text-lg">Making a Difference</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold">{formatCurrency(charityAmount)}/yr</div>
              <Badge className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700">
                <Sparkles className="h-3 w-3 mr-1" />
                First 12 months: 100% to Joii
              </Badge>
              <p className="text-sm text-muted-foreground">
                After 12 months: 5% TEEEM picks, 5% Kudos winner chooses
              </p>
            </CardContent>
          </Card>

          {/* Support Line Card */}
          <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Users className="h-8 w-8 text-blue-500" />
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                  20%
                </Badge>
              </div>
              <CardTitle className="text-lg">Your Support Line</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold">{formatCurrency(supportLineAmount)}/yr</div>
              <p className="text-sm text-muted-foreground">
                Goes to the person who introduced you to TEEEM. Word of mouth is rewarded.
              </p>
            </CardContent>
          </Card>

          {/* TEEEM Card */}
          <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Building2 className="h-8 w-8 text-slate-500" />
                <Badge variant="secondary">70%</Badge>
              </div>
              <CardTitle className="text-lg">Platform & Development</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold">{formatCurrency(teeemAmount)}/yr</div>
              <p className="text-sm text-muted-foreground">
                Keeps the lights on, servers running, and new features coming.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Joii Section */}
      <Card className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="shrink-0">
              <div className="w-20 h-20 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-3xl font-bold text-emerald-600">
                Joii
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">First 12 Months: 100% to Joii</h3>
                <a
                  href="https://joii.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Joii is an Australian not-for-profit creating opportunities through self-sustaining
                social enterprises. They run trade services—carpentry, roofing, landscaping,
                bricklaying—staffed by people who deserve a second chance: the long-term unemployed,
                prison leavers, and youth at risk.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">900+</div>
                  <div className="text-xs text-muted-foreground">Jobs Created</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">200+</div>
                  <div className="text-xs text-muted-foreground">Second Chances</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">100%</div>
                  <div className="text-xs text-muted-foreground">Profits to Community</div>
                </div>
              </div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 pt-2">
                When you use TEEEM, you're not just running your business better—you're helping
                tradies who need a hand up get back on their feet.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral Program */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Referral Program
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg font-medium">
            Earn 20% of every referral's fees — forever.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold">How it works</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Eligibility: Generate $10k in total fees (yours + referrals)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Referral bonuses count towards the $10k threshold</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>No cap on earnings — the more you refer, the more you earn</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>We believe the best way to grow is word of mouth</span>
                </li>
              </ul>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-semibold mb-3">Example</h4>
              <div className="space-y-2 text-sm">
                <p>Refer 5 businesses @ $500k turnover each:</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Their annual fees (2.2% each):</span>
                  <span className="font-medium">5 x $11,000 = $55,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your 20% share:</span>
                  <span className="font-bold text-primary">$11,000/year</span>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Passive income, every year, just for sharing something that works.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
