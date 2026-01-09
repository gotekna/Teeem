/**
 * RenderCoordinator - Manages rendering state and frame scheduling
 *
 * Responsibilities:
 * - Dirty flag management
 * - Render request batching
 * - Frame scheduling via requestAnimationFrame
 * - Render suppression during batch operations
 *
 * @example
 * ```typescript
 * const coordinator = new RenderCoordinator(renderer);
 *
 * // Mark canvas as needing redraw
 * coordinator.markDirty();
 *
 * // Batch multiple updates without intermediate renders
 * coordinator.suppress(() => {
 *   updateTask1();
 *   updateTask2();
 *   updateTask3();
 * }); // Single render after all updates
 * ```
 */

import type { Renderer as GanttRenderer } from '../Renderer';

// ============================================================================
// Types
// ============================================================================

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RenderPriority = 'immediate' | 'normal' | 'low';

export interface RenderRequest {
  region?: Rect;
  priority: RenderPriority;
  timestamp: number;
}

export interface RenderStats {
  frameCount: number;
  lastFrameTime: number;
  averageFrameTime: number;
  skippedFrames: number;
}

type RenderCallback = () => void;

// ============================================================================
// RenderCoordinator Class
// ============================================================================

export class RenderCoordinator {
  // State
  private isDirty: boolean = false;
  private isSuppressed: boolean = false;
  private suppressionDepth: number = 0;

  // Frame scheduling
  private animationFrameId: number | null = null;
  private pendingRequests: RenderRequest[] = [];

  // Dirty regions (for partial rendering optimization)
  private dirtyRegions: Rect[] = [];
  private fullRedrawNeeded: boolean = false;

  // Performance tracking
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private frameTimes: number[] = [];
  private skippedFrames: number = 0;
  private readonly maxFrameTimeHistory = 60;

  // Callbacks
  private renderCallback: RenderCallback | null = null;

  // Reference to renderer (injected)
  private renderer: GanttRenderer | null = null;

  // ============================================================================
  // Constructor
  // ============================================================================

  constructor(renderer?: GanttRenderer) {
    this.renderer = renderer || null;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Set the renderer instance
   */
  setRenderer(renderer: GanttRenderer): void {
    this.renderer = renderer;
  }

  /**
   * Set the render callback (called on each frame)
   */
  onRender(callback: RenderCallback): void {
    this.renderCallback = callback;
  }

  /**
   * Mark the canvas as needing a redraw
   * @param region Optional region to mark dirty (for partial redraws)
   */
  markDirty(region?: Rect): void {
    this.isDirty = true;

    if (region) {
      this.dirtyRegions.push(region);
    } else {
      this.fullRedrawNeeded = true;
    }

    if (!this.isSuppressed) {
      this.scheduleRender('normal');
    }
  }

  /**
   * Request a render with specific priority
   * @param priority Render priority ('immediate', 'normal', 'low')
   */
  requestRender(priority: RenderPriority = 'normal'): void {
    if (this.isSuppressed && priority !== 'immediate') {
      return;
    }

    this.scheduleRender(priority);
  }

  /**
   * Suppress rendering during a batch operation
   * Renders will be deferred until the callback completes
   *
   * @param callback Function to execute with rendering suppressed
   */
  suppress(callback: () => void): void {
    this.suppressionDepth++;
    this.isSuppressed = true;

    try {
      callback();
    } finally {
      this.suppressionDepth--;
      if (this.suppressionDepth === 0) {
        this.isSuppressed = false;
        if (this.isDirty) {
          this.scheduleRender('normal');
        }
      }
    }
  }

  /**
   * Async version of suppress for async operations
   */
  async suppressAsync(callback: () => Promise<void>): Promise<void> {
    this.suppressionDepth++;
    this.isSuppressed = true;

    try {
      await callback();
    } finally {
      this.suppressionDepth--;
      if (this.suppressionDepth === 0) {
        this.isSuppressed = false;
        if (this.isDirty) {
          this.scheduleRender('normal');
        }
      }
    }
  }

  /**
   * Force an immediate render, bypassing scheduling
   */
  flush(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.executeRender();
  }

  /**
   * Check if render is currently suppressed
   */
  isSuppressedNow(): boolean {
    return this.isSuppressed;
  }

  /**
   * Check if canvas is dirty (needs redraw)
   */
  needsRender(): boolean {
    return this.isDirty;
  }

  /**
   * Get dirty regions for partial rendering
   */
  getDirtyRegions(): Rect[] {
    return this.fullRedrawNeeded ? [] : [...this.dirtyRegions];
  }

  /**
   * Check if full redraw is needed
   */
  needsFullRedraw(): boolean {
    return this.fullRedrawNeeded;
  }

  /**
   * Get render performance statistics
   */
  getStats(): RenderStats {
    const averageFrameTime =
      this.frameTimes.length > 0
        ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        : 0;

    return {
      frameCount: this.frameCount,
      lastFrameTime: this.lastFrameTime,
      averageFrameTime,
      skippedFrames: this.skippedFrames,
    };
  }

  /**
   * Reset performance statistics
   */
  resetStats(): void {
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.frameTimes = [];
    this.skippedFrames = 0;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.pendingRequests = [];
    this.dirtyRegions = [];
    this.renderCallback = null;
    this.renderer = null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Schedule a render for the next animation frame
   */
  private scheduleRender(priority: RenderPriority): void {
    const request: RenderRequest = {
      priority,
      timestamp: performance.now(),
    };

    this.pendingRequests.push(request);

    if (priority === 'immediate') {
      this.flush();
      return;
    }

    if (this.animationFrameId === null) {
      this.animationFrameId = requestAnimationFrame(() => this.onAnimationFrame());
    }
  }

  /**
   * Animation frame callback
   */
  private onAnimationFrame(): void {
    this.animationFrameId = null;
    this.executeRender();
  }

  /**
   * Execute the actual render
   */
  private executeRender(): void {
    if (!this.isDirty && this.pendingRequests.length === 0) {
      return;
    }

    const startTime = performance.now();

    // Clear pending requests
    this.pendingRequests = [];

    // Execute render callback
    if (this.renderCallback) {
      try {
        this.renderCallback();
      } catch (error) {
        console.error('[RenderCoordinator] Render error:', error);
      }
    }

    // Clear dirty state
    this.isDirty = false;
    this.dirtyRegions = [];
    this.fullRedrawNeeded = false;

    // Track frame time
    const endTime = performance.now();
    this.lastFrameTime = endTime - startTime;
    this.frameTimes.push(this.lastFrameTime);

    if (this.frameTimes.length > this.maxFrameTimeHistory) {
      this.frameTimes.shift();
    }

    this.frameCount++;

    // Check for slow frames (> 16ms = 60fps threshold)
    if (this.lastFrameTime > 16) {
      this.skippedFrames++;
    }
  }
}

export default RenderCoordinator;
