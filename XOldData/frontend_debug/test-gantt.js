#!/usr/bin/env node
/**
 * Automated Gantt Drag Test
 *
 * This script uses Playwright to test the Gantt drag behavior automatically.
 * Bug-hunter agent can run this with: node frontend/test-gantt.js
 *
 * Exit codes:
 * - 0: Test passed (no flicker, cascade works)
 * - 1: Test failed (flicker detected, infinite loop, or cascade broken)
 */

const { chromium } = require('playwright');

async function testGanttDrag() {
  console.log('🧪 AUTOMATED GANTT DRAG TEST\n');
  console.log('='.repeat(60));

  let browser;
  let exitCode = 1;

  try {
    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await chromium.launch({ headless: false }); // Set to true for CI
    const context = await browser.newContext();
    const page = await context.newPage();

    // Track API calls
    const apiCalls = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/v1/schedule_templates') && url.includes('/rows/')) {
        const match = url.match(/\/rows\/(\d+)/);
        const taskId = match ? match[1] : 'unknown';
        apiCalls.push({
          method: request.method(),
          taskId: taskId,
          timestamp: Date.now()
        });
        console.log(`🌐 API ${request.method()} task ${taskId}`);
      }
    });

    // Track console logs
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);

      // Look for key indicators
      if (text.includes('Backend cascaded to')) {
        console.log('✅ Backend cascade detected:', text);
      }
      if (text.includes('Applied batch update')) {
        console.log('✅ Batch update applied:', text);
      }
      if (text.includes('Starting Gantt reload')) {
        console.log('🔄 Gantt reload detected');
      }
    });

    // Navigate to app (adjust URL as needed)
    console.log('📍 Navigating to app...');
    await page.goto('http://localhost:5173'); // Adjust to your frontend URL

    // Login if needed (adjust selectors)
    console.log('🔐 Logging in...');
    await page.fill('input[type="email"]', 'admin@trapid.com'); // Adjust
    await page.fill('input[type="password"]', 'password'); // Adjust
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Navigate to Schedule Master
    console.log('📋 Opening Schedule Master...');
    await page.click('text=Schedule Master'); // Adjust selector
    await page.waitForTimeout(1000);

    // Open Gantt view
    console.log('📊 Opening Gantt View...');
    await page.click('text=Gantt View'); // Adjust selector
    await page.waitForTimeout(2000);

    // Find Task 1 and drag it
    console.log('🎯 Dragging Task 1...');
    const task1 = await page.locator('.gantt_task_line').first(); // Adjust selector
    const taskBox = await task1.boundingBox();

    if (taskBox) {
      // Drag task 5 days forward (assuming 1 day = ~50px, adjust as needed)
      await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(taskBox.x + taskBox.width / 2 + 250, taskBox.y + taskBox.height / 2, { steps: 10 });
      await page.mouse.up();

      console.log('✅ Task dragged');
    } else {
      throw new Error('Could not find Task 1 to drag');
    }

    // Wait for API calls to complete
    console.log('⏳ Waiting for cascade updates...');
    await page.waitForTimeout(3000);

    // Analyze results
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS\n');

    // Count API calls per task
    const callsByTask = {};
    apiCalls.forEach(call => {
      if (!callsByTask[call.taskId]) {
        callsByTask[call.taskId] = 0;
      }
      callsByTask[call.taskId]++;
    });

    console.log(`🌐 API Calls: ${apiCalls.length} total`);
    Object.keys(callsByTask).forEach(taskId => {
      const count = callsByTask[taskId];
      console.log(`   Task ${taskId}: ${count} call${count > 1 ? 's' : ''}`);
    });

    // Check for backend cascade message
    const hasCascadeMessage = consoleLogs.some(log => log.includes('Backend cascaded to'));
    const hasBatchUpdate = consoleLogs.some(log => log.includes('Applied batch update'));
    const reloadCount = consoleLogs.filter(log => log.includes('Starting Gantt reload')).length;

    console.log(`\n📦 Backend Cascade: ${hasCascadeMessage ? '✅ Yes' : '❌ No'}`);
    console.log(`📦 Batch Update: ${hasBatchUpdate ? '✅ Yes' : '❌ No'}`);
    console.log(`🔄 Gantt Reloads: ${reloadCount}`);

    // Check for duplicate API calls (infinite loop indicator)
    const hasDuplicates = Object.values(callsByTask).some(count => count > 1);

    console.log('\n' + '='.repeat(60));

    if (!hasDuplicates && reloadCount <= 1 && hasCascadeMessage) {
      console.log('✅ TEST PASSED: No infinite loop, backend cascade working!');
      exitCode = 0;
    } else {
      console.log('❌ TEST FAILED:');
      if (hasDuplicates) {
        console.log('   ❌ Duplicate API calls detected (infinite loop)');
      }
      if (reloadCount > 1) {
        console.log(`   ❌ Multiple Gantt reloads (${reloadCount})`);
      }
      if (!hasCascadeMessage) {
        console.log('   ❌ Backend cascade not detected');
      }
      exitCode = 1;
    }

    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Test error:', error.message);
    exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  process.exit(exitCode);
}

// Run if called directly
if (require.main === module) {
  testGanttDrag();
}

module.exports = { testGanttDrag };
