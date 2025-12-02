// Console Capture Utility - Intercepts and stores all console output

class ConsoleCapture {
  constructor() {
    this.logs = []
    this.maxLogs = 1000 // Keep last 1000 log entries
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    }
    this.listeners = []
  }

  initialize() {
    // Intercept console.log
    console.log = (...args) => {
      this.capture('log', args)
      this.originalConsole.log.apply(console, args)
    }

    // Intercept console.error
    console.error = (...args) => {
      this.capture('error', args)
      this.originalConsole.error.apply(console, args)
    }

    // Intercept console.warn
    console.warn = (...args) => {
      this.capture('warn', args)
      this.originalConsole.warn.apply(console, args)
    }

    // Intercept console.info
    console.info = (...args) => {
      this.capture('info', args)
      this.originalConsole.info.apply(console, args)
    }

    // Intercept console.debug
    console.debug = (...args) => {
      this.capture('debug', args)
      this.originalConsole.debug.apply(console, args)
    }

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.capture('error', [`Unhandled Error: ${event.message}`, event.filename, `Line: ${event.lineno}:${event.colno}`])
    })

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.capture('error', [`Unhandled Promise Rejection: ${event.reason}`])
    })
  }

  capture(type, args) {
    const timestamp = new Date().toISOString()
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          // Handle circular references and improve object serialization
          return JSON.stringify(arg, (key, value) => {
            // Handle circular references
            if (typeof value === 'object' && value !== null) {
              if (value instanceof Error) {
                return `${value.name}: ${value.message}\n${value.stack}`
              }
            }
            return value
          }, 2)
        } catch (e) {
          // If JSON.stringify fails, try to extract useful info
          if (arg instanceof Error) {
            return `${arg.name}: ${arg.message}\n${arg.stack}`
          }
          return String(arg)
        }
      }
      return String(arg)
    }).join(' ')

    this.logs.push({
      timestamp,
      type,
      message,
      raw: args // Store raw args for debugging
    })

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // Notify listeners
    this.notifyListeners()
  }

  getLogs() {
    return this.logs
  }

  getFormattedLogs() {
    return this.logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString()
      return `[${time}] [${log.type.toUpperCase()}] ${log.message}`
    }).join('\n\n')
  }

  copyToClipboard() {
    const formatted = this.getFormattedLogs()

    if (formatted.length === 0) {
      return Promise.resolve('No console logs captured yet')
    }

    const header = `=== Console Logs Captured ===\nTotal Entries: ${this.logs.length}\nCaptured at: ${new Date().toLocaleString()}\n\n`
    const fullText = header + formatted

    // Use modern clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(fullText)
        .then(() => `Copied ${this.logs.length} console entries to clipboard!`)
        .catch(err => `Failed to copy: ${err.message}`)
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = fullText
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()

      try {
        document.execCommand('copy')
        document.body.removeChild(textarea)
        return Promise.resolve(`Copied ${this.logs.length} console entries to clipboard!`)
      } catch (err) {
        document.body.removeChild(textarea)
        return Promise.reject(new Error(`Failed to copy: ${err.message}`))
      }
    }
  }

  clear() {
    this.logs = []
    this.notifyListeners()
  }

  subscribe(listener) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.logs))
  }

  // Debug helper to check if capture is working
  test() {
    const beforeCount = this.logs.length
    console.log('🧪 Testing console capture...')
    console.error('🧪 Test error')
    console.warn('🧪 Test warning')
    const afterCount = this.logs.length
    const captured = afterCount - beforeCount

    console.log(`✅ Capture is ${captured === 3 ? 'WORKING' : 'NOT WORKING'}`)
    console.log(`   Before: ${beforeCount} logs`)
    console.log(`   After: ${afterCount} logs`)
    console.log(`   Captured: ${captured}/3 test messages`)

    return {
      working: captured === 3,
      captured,
      expected: 3,
      totalLogs: afterCount
    }
  }
}

// Create singleton instance
const consoleCapture = new ConsoleCapture()

// Expose to window for debugging
if (typeof window !== 'undefined') {
  window.consoleCapture = consoleCapture
}

// Auto-initialize in browser environment - only on localhost or staging
if (typeof window !== 'undefined') {
  const isDev = import.meta.env.DEV
  const isStaging = window.location.hostname.includes('vercel.app') ||
                    window.location.hostname.includes('staging') ||
                    window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1'

  if (isDev || isStaging) {
    // Check if we should clear console BEFORE initializing to avoid capturing anything
    const shouldClear = sessionStorage.getItem('clearConsoleAfterReload') === 'true'
    if (shouldClear) {
      sessionStorage.removeItem('clearConsoleAfterReload')
    }

    consoleCapture.initialize()

    // Clear immediately after initialization if flag was set
    if (shouldClear) {
      consoleCapture.clear()
      console.clear()
      console.log('✨ Console cleared after refresh')
    }
  }
}

export default consoleCapture
