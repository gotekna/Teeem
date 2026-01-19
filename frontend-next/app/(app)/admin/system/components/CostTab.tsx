"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyWhole, formatPercentageWithFallback } from "@/utils/formatters";

// Pricing calculation - TIERED BRACKETS (like tax brackets)
// First $1M: 2.2%
// Each $200k after: rate drops by 0.05% (2.15%, 2.10%, 2.05%... floor 0.2%)
const calculateAnnualCost = (turnover: number): {
  cost: number;
  effectiveRate: number;
  tiers: Array<{ from: number; to: number; rate: number; amount: number }>;
} => {
  const BASE_RATE = 2.2;
  const FIRST_MILLION = 1000000;
  const BRACKET_SIZE = 200000;
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

export function CostTab() {
  const [turnover, setTurnover] = React.useState<number>(1200000);
  const [inputValue, setInputValue] = React.useState<string>("1,200,000");

  // Calculate all values using tiered brackets
  const { cost: annualCost, effectiveRate, tiers } = calculateAnnualCost(turnover);
  const monthlyCost = annualCost / 12;

  // Revenue distribution (10 + 20 + 10 + 60 = 100%)
  const charityAmount = annualCost * 0.1;
  const supportLineAmount = annualCost * 0.2;  // Your Support gets 20%
  const uplineSupportAmount = annualCost * 0.1;
  const teeemAmount = annualCost * 0.6;

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
                {formatCurrencyWhole(value)}
              </button>
            ))}
          </div>

          {/* Results Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-4 text-center">
              <div className="text-sm text-muted-foreground mb-1">Effective Rate</div>
              <div className="text-3xl font-bold text-primary">
                {formatPercentageWithFallback(effectiveRate, "0%", 2)}
              </div>
            </div>
            <div className="bg-muted rounded-lg p-4 text-center">
              <div className="text-sm text-muted-foreground mb-1">Annual Cost</div>
              <div className="text-3xl font-bold">{formatCurrencyWhole(annualCost)}</div>
            </div>
            <div className="bg-muted rounded-lg p-4 text-center">
              <div className="text-sm text-muted-foreground mb-1">Monthly</div>
              <div className="text-3xl font-bold">{formatCurrencyWhole(monthlyCost)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Breakdown - Tiered (Collapsible) */}
      <Card>
        <CardContent className="pt-6">
          <Accordion type="single" collapsible>
            <AccordionItem value="tiers" className="border-none">
              <AccordionTrigger className="hover:no-underline py-0">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  <span className="font-semibold">Rate Breakdown (Tiered)</span>
                  <Badge variant="secondary" className="ml-2">
                    {tiers.length} tiers
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
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
                          ? `First ${formatCurrencyWhole(tier.to)}`
                          : `${formatCurrencyWhole(tier.from)} - ${formatCurrencyWhole(tier.to)}`}
                        <span className="ml-2 text-xs">@ {formatPercentageWithFallback(tier.rate, "0%", 2)}</span>
                      </span>
                      <span className="font-medium">{formatCurrencyWhole(tier.amount)}</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Summary always visible */}
          <div className="mt-4 pt-4 border-t space-y-2">
            <div className="flex justify-between font-semibold text-lg">
              <span>Total Annual Cost</span>
              <span className="text-primary">{formatCurrencyWhole(annualCost)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Effective rate</span>
              <span>{formatPercentageWithFallback(effectiveRate, "0%", 2)}</span>
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
              First $1M at 2.20%. Each $200k after drops by 0.05% (2.15%, 2.10%, 2.05%... floor: 0.20%)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Where Your Money Goes */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Where Your Money Goes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Charity Card */}
          <Card className="border-pink-200 dark:border-pink-800 bg-gradient-to-br from-pink-50 to-white dark:from-pink-950/20 dark:to-background">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Heart className="h-8 w-8 text-pink-500" />
                <Badge variant="secondary" className="bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300">
                  10%
                </Badge>
              </div>
              <CardTitle className="text-lg">Charity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold">{formatCurrencyWhole(charityAmount)}/yr</div>
              <Badge className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700 text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                First 12mo: Joii
              </Badge>
            </CardContent>
          </Card>

          {/* Your Support Line Card */}
          <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Users className="h-8 w-8 text-blue-500" />
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                  20%
                </Badge>
              </div>
              <CardTitle className="text-lg">Your Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold">{formatCurrencyWhole(supportLineAmount)}/yr</div>
              <p className="text-sm text-muted-foreground">
                They support you
              </p>
            </CardContent>
          </Card>

          {/* Their Support Line Card */}
          <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Users className="h-8 w-8 text-purple-500" />
                <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                  10%
                </Badge>
              </div>
              <CardTitle className="text-lg">Their Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold">{formatCurrencyWhole(uplineSupportAmount)}/yr</div>
              <p className="text-sm text-muted-foreground">
                Your support has a support too
              </p>
            </CardContent>
          </Card>

          {/* TEEEM Card */}
          <Card className="border-border dark:border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Building2 className="h-8 w-8 text-muted-foreground" />
                <Badge variant="secondary">60%</Badge>
              </div>
              <CardTitle className="text-lg">TEEEM</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-bold">{formatCurrencyWhole(teeemAmount)}/yr</div>
              <p className="text-sm text-muted-foreground">
                Platform & development
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
            Support Network
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg font-medium">
            Earn 20% from everyone you support + 10% from everyone they support.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold">Level 1: Your Support (20%)</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>Eligibility: $10k in total fees (yours + network)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>Must actively support your referrals for life</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>Potential bonuses count towards $10k threshold</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold">Level 2: Their Support (10%)</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 font-bold">•</span>
                    <span>Eligibility: $50k in total fees (yours + network)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 font-bold">•</span>
                    <span>Same rules apply — support your network</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 font-bold">•</span>
                    <span>Potential bonuses count towards $50k threshold</span>
                  </li>
                </ul>
              </div>

              <p className="text-sm text-muted-foreground italic">
                Word of mouth is the best way to grow — and it's rewarded.
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-semibold mb-3">Example</h4>
              <div className="space-y-2 text-sm">
                <p>Support 5 businesses @ $500k turnover each:</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Their annual fees (2.2% each):</span>
                  <span className="font-medium">5 x $11,000 = $55,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your 20% share:</span>
                  <span className="font-bold text-primary">$11,000/year</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">If each supports 3 more:</span>
                  <span className="font-medium">15 x $11,000 = $165,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your 10% from level 2:</span>
                  <span className="font-bold text-primary">$16,500/year</span>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Total: $27,500/year passive income from your support network.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
