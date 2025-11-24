/**
 * DRAG SHAKE DIAGNOSTICS
 *
 * Paste this into browser console BEFORE dragging a Gantt task.
 * After you drag and see the shake, copy all the console output
 * and share it with Claude Code.
 */

console.clear();
console.log('🔍 DRAG DIAGNOSTICS ENABLED - Start dragging now...\n');

const startTime = performance.now();
const log = (emoji, msg) => {
  const elapsed = (performance.now() - startTime).toFixed(2);
  console.log(`${emoji} [${elapsed}ms] ${msg}`);
};

// Monitor ALL DOM mutations
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.target.style) {
      log('🎨', `Style changed on ${mutation.target.className || mutation.target.tagName}`);
    }
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      log('➕', `DOM node added: ${mutation.addedNodes[0].className || mutation.addedNodes[0].tagName}`);
    }
  });
});

observer.observe(document.body, {
  attributes: true,
  childList: true,
  subtree: true,
  attributeFilter: ['style', 'class']
});

// Note: React state monitoring removed - not compatible with modern React hooks

// Monitor RAF calls
const originalRAF = window.requestAnimationFrame;
window.requestAnimationFrame = function(callback) {
  log('🎞️', 'requestAnimationFrame scheduled');
  return originalRAF.call(window, (...args) => {
    log('🎞️', 'requestAnimationFrame EXECUTING');
    const result = callback(...args);
    log('🎞️', 'requestAnimationFrame COMPLETE');
    return result;
  });
};

// Monitor setTimeout
const originalSetTimeout = window.setTimeout;
window.setTimeout = function(callback, delay) {
  log('⏱️', `setTimeout scheduled (${delay}ms)`);
  return originalSetTimeout.call(window, (...args) => {
    log('⏱️', `setTimeout EXECUTING (was ${delay}ms)`);
    const result = callback(...args);
    log('⏱️', `setTimeout COMPLETE`);
    return result;
  }, delay);
};

// Monitor fetch/API calls
const originalFetch = window.fetch;
window.fetch = function(...args) {
  log('🌐', `API call: ${args[0]}`);
  return originalFetch.apply(window, args).then((response) => {
    log('🌐', `API response: ${args[0]}`);
    return response;
  });
};

// Monitor scroll events
window.addEventListener('scroll', () => {
  log('📜', 'Scroll event');
}, true);

// Monitor resize events
window.addEventListener('resize', () => {
  log('📐', 'Resize event');
}, true);

// Monitor repaints (if supported)
if (window.PerformanceObserver) {
  const perfObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'paint') {
        log('🖼️', `Paint: ${entry.name} at ${entry.startTime.toFixed(2)}ms`);
      }
    }
  });

  try {
    perfObserver.observe({ entryTypes: ['paint', 'layout-shift'] });
  } catch (_error) {
    console.log('Layout shift observation not supported');
  }
}

console.log('\n✅ Diagnostics active. Drag a task now, then copy ALL console output above.\n');

// Stop after 10 seconds
setTimeout(() => {
  observer.disconnect();
  console.log('\n🛑 Diagnostics stopped. Copy the log above and share with Claude Code.\n');
}, 10000);
