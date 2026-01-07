#!/usr/bin/env node
/**
 * Simple LCP measurement script using Puppeteer
 * Usage: node scripts/measure-lcp.mjs <url>
 */

import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://localhost:3000';

async function measureLCP(targetUrl) {
  console.log(`\n📊 Measuring LCP for: ${targetUrl}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Set up performance observer
  await page.evaluateOnNewDocument(() => {
    window.__lcpValue = 0;
    window.__clsValue = 0;

    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      window.__lcpValue = lastEntry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          window.__clsValue += entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  const startTime = Date.now();
  await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  const loadTime = Date.now() - startTime;

  // Wait a bit for LCP to settle
  await page.waitForTimeout(1000);

  // Get metrics
  const metrics = await page.evaluate(() => ({
    lcp: window.__lcpValue,
    cls: window.__clsValue,
  }));

  // Get navigation timing
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      ttfb: nav.responseStart - nav.requestStart,
      domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
      load: nav.loadEventEnd - nav.startTime,
    };
  });

  await browser.close();

  const lcpMs = Math.round(metrics.lcp);
  const status = lcpMs <= 500 ? '✅ PASS' : lcpMs <= 1000 ? '⚠️ CLOSE' : '❌ FAIL';

  console.log(`\n${'='.repeat(50)}`);
  console.log(`LCP: ${lcpMs}ms ${status} (target: ≤500ms)`);
  console.log(`CLS: ${metrics.cls.toFixed(3)} ${metrics.cls <= 0.1 ? '✅' : '❌'}`);
  console.log(`TTFB: ${Math.round(timing.ttfb)}ms`);
  console.log(`DOM Loaded: ${Math.round(timing.domContentLoaded)}ms`);
  console.log(`Full Load: ${loadTime}ms`);
  console.log(`${'='.repeat(50)}\n`);

  return { lcp: lcpMs, cls: metrics.cls };
}

// Run
measureLCP(url).catch(console.error);
