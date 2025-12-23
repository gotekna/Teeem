/**
 * PerformanceMonitor - Tracks and reports Gantt engine performance metrics
 *
 * Used to monitor frame times, hit test performance, and render statistics.
 * Helps identify bottlenecks and track improvements.
 *
 * @example
 * ```typescript
 * const monitor = new PerformanceMonitor();
 *
 * // Track a render
 * monitor.startFrame();
 * // ... render code ...
 * monitor.endFrame();
 *
 * // Get stats
 * console.log(monitor.getStats());
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface PerformanceStats {
  /** Average frame time in ms */
  avgFrameTime: number;
  /** Max frame time in ms */
  maxFrameTime: number;
  /** Min frame time in ms */
  minFrameTime: number;
  /** Frames per second estimate */
  fps: number;
  /** Total frames tracked */
  frameCount: number;
  /** Frames that exceeded 16ms (60fps threshold) */
  slowFrames: number;
  /** Hit tests performed */
  hitTestCount: number;
  /** Average hit test time in ms */
  avgHitTestTime: number;
}

interface FrameData {
  startTime: number;
  endTime: number;
  duration: number;
}

// ============================================================================
// PerformanceMonitor Class
// ============================================================================

export class PerformanceMonitor {
  // Frame tracking
  private frames: FrameData[] = [];
  private maxFrameHistory: number = 100;
  private currentFrameStart: number = 0;

  // Hit test tracking
  private hitTests: number[] = [];
  private maxHitTestHistory: number = 100;
  private currentHitTestStart: number = 0;

  // Thresholds
  private readonly SLOW_FRAME_THRESHOLD = 16; // 60fps
  private readonly WARNING_FRAME_THRESHOLD = 33; // 30fps

  // ============================================================================
  // Constructor
  // ============================================================================

  constructor(options?: { maxFrameHistory?: number; maxHitTestHistory?: number }) {
    if (options?.maxFrameHistory) this.maxFrameHistory = options.maxFrameHistory;
    if (options?.maxHitTestHistory) this.maxHitTestHistory = options.maxHitTestHistory;
  }

  // ============================================================================
  // Frame Tracking
  // ============================================================================

  /**
   * Start timing a frame
   */
  startFrame(): void {
    this.currentFrameStart = performance.now();
  }

  /**
   * End timing a frame
   */
  endFrame(): void {
    if (this.currentFrameStart === 0) return;

    const endTime = performance.now();
    const duration = endTime - this.currentFrameStart;

    this.frames.push({
      startTime: this.currentFrameStart,
      endTime,
      duration,
    });

    // Trim history
    if (this.frames.length > this.maxFrameHistory) {
      this.frames.shift();
    }

    // Log warning for very slow frames
    if (duration > this.WARNING_FRAME_THRESHOLD) {
      console.warn(`[PerformanceMonitor] Slow frame: ${duration.toFixed(2)}ms`);
    }

    this.currentFrameStart = 0;
  }

  /**
   * Time a function execution as a frame
   */
  timeFrame<T>(fn: () => T): T {
    this.startFrame();
    const result = fn();
    this.endFrame();
    return result;
  }

  // ============================================================================
  // Hit Test Tracking
  // ============================================================================

  /**
   * Start timing a hit test
   */
  startHitTest(): void {
    this.currentHitTestStart = performance.now();
  }

  /**
   * End timing a hit test
   */
  endHitTest(): void {
    if (this.currentHitTestStart === 0) return;

    const duration = performance.now() - this.currentHitTestStart;
    this.hitTests.push(duration);

    // Trim history
    if (this.hitTests.length > this.maxHitTestHistory) {
      this.hitTests.shift();
    }

    this.currentHitTestStart = 0;
  }

  /**
   * Time a hit test function
   */
  timeHitTest<T>(fn: () => T): T {
    this.startHitTest();
    const result = fn();
    this.endHitTest();
    return result;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get performance statistics
   */
  getStats(): PerformanceStats {
    const frameDurations = this.frames.map(f => f.duration);
    const avgFrameTime = this.average(frameDurations);
    const maxFrameTime = frameDurations.length > 0 ? Math.max(...frameDurations) : 0;
    const minFrameTime = frameDurations.length > 0 ? Math.min(...frameDurations) : 0;
    const slowFrames = frameDurations.filter(d => d > this.SLOW_FRAME_THRESHOLD).length;

    return {
      avgFrameTime,
      maxFrameTime,
      minFrameTime,
      fps: avgFrameTime > 0 ? 1000 / avgFrameTime : 0,
      frameCount: this.frames.length,
      slowFrames,
      hitTestCount: this.hitTests.length,
      avgHitTestTime: this.average(this.hitTests),
    };
  }

  /**
   * Get a formatted performance report
   */
  getReport(): string {
    const stats = this.getStats();
    const lines = [
      '=== Gantt Performance Report ===',
      `Frames tracked: ${stats.frameCount}`,
      `Avg frame time: ${stats.avgFrameTime.toFixed(2)}ms`,
      `Max frame time: ${stats.maxFrameTime.toFixed(2)}ms`,
      `Min frame time: ${stats.minFrameTime.toFixed(2)}ms`,
      `Est. FPS: ${stats.fps.toFixed(1)}`,
      `Slow frames (>16ms): ${stats.slowFrames} (${((stats.slowFrames / stats.frameCount) * 100).toFixed(1)}%)`,
      `Hit tests: ${stats.hitTestCount}`,
      `Avg hit test: ${stats.avgHitTestTime.toFixed(3)}ms`,
      '================================',
    ];
    return lines.join('\n');
  }

  /**
   * Check if performance is within targets
   */
  isPerformanceGood(): boolean {
    const stats = this.getStats();
    return stats.avgFrameTime < this.SLOW_FRAME_THRESHOLD;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Reset all statistics
   */
  reset(): void {
    this.frames = [];
    this.hitTests = [];
    this.currentFrameStart = 0;
    this.currentHitTestStart = 0;
  }

  /**
   * Clear history but keep tracking
   */
  clearHistory(): void {
    this.frames = [];
    this.hitTests = [];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

export default PerformanceMonitor;
