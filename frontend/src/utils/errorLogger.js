/**
 * ErrorLogger - Token-efficient error logging for frontend
 *
 * Provides structured error logging with automatic Sentry integration.
 * Works with existing console capture system.
 *
 * Usage:
 *   import { logError, logWarning, logInfo } from '@/utils/errorLogger'
 *
 *   logError('API call failed', {
 *     endpoint: '/api/v1/constructions',
 *     status: 500,
 *     userId: user.id
 *   })
 */

import * as Sentry from '@sentry/react'

/**
 * Log levels
 */
export const LogLevel = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  DEBUG: 'debug'
}

/**
 * Error categories for better organization
 */
export const ErrorCategory = {
  API: 'api_error',
  VALIDATION: 'validation_error',
  NETWORK: 'network_error',
  COMPONENT: 'component_error',
  AUTH: 'auth_error',
  STORAGE: 'storage_error',
  UNKNOWN: 'unknown_error'
}

/**
 * Main logging function
 *
 * @param {string} level - Log level (error, warning, info, debug)
 * @param {string} message - Error message
 * @param {Object} context - Additional context
 */
function log(level, message, context = {}) {
  const logEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitizeContext(context)
  }

  // Log to console (will be captured by consoleCapture.js)
  switch (level) {
    case LogLevel.ERROR:
      console.error(message, logEntry)
      break
    case LogLevel.WARNING:
      console.warn(message, logEntry)
      break
    case LogLevel.INFO:
      console.info(message, logEntry)
      break
    default:
      console.log(message, logEntry)
  }

  // Send to Sentry if initialized and level is error/warning
  if (import.meta.env.VITE_SENTRY_DSN && shouldSendToSentry(level, context)) {
    sendToSentry(level, message, logEntry)
  }

  return logEntry
}

/**
 * Log an error
 *
 * @param {string|Error} messageOrError - Error message or Error object
 * @param {Object} context - Additional context
 */
export function logError(messageOrError, context = {}) {
  if (messageOrError instanceof Error) {
    return log(LogLevel.ERROR, messageOrError.message, {
      ...context,
      error: messageOrError.name,
      stack: filterStackTrace(messageOrError.stack)
    })
  }
  return log(LogLevel.ERROR, messageOrError, context)
}

/**
 * Log a warning
 */
export function logWarning(message, context = {}) {
  return log(LogLevel.WARNING, message, context)
}

/**
 * Log info
 */
export function logInfo(message, context = {}) {
  return log(LogLevel.INFO, message, context)
}

/**
 * Log debug (development only)
 */
export function logDebug(message, context = {}) {
  if (import.meta.env.DEV) {
    return log(LogLevel.DEBUG, message, context)
  }
}

/**
 * Log API error with automatic context extraction
 *
 * @param {Error} error - Error object from API call
 * @param {string} endpoint - API endpoint
 * @param {Object} additionalContext - Extra context
 */
export function logApiError(error, endpoint, additionalContext = {}) {
  return logError(error, {
    category: ErrorCategory.API,
    endpoint,
    status: error.status || error.response?.status,
    method: error.config?.method?.toUpperCase(),
    ...additionalContext
  })
}

/**
 * Log validation error
 */
export function logValidationError(message, fields, additionalContext = {}) {
  return logWarning(message, {
    category: ErrorCategory.VALIDATION,
    fields,
    ...additionalContext
  })
}

/**
 * Filter stack trace to first 5 lines (token efficiency)
 */
function filterStackTrace(stack) {
  if (!stack) return null

  const lines = stack.split('\n')
  // Take first 5 lines (error message + 4 stack frames)
  return lines.slice(0, 5).join('\n')
}

/**
 * Remove sensitive data from context
 */
function sanitizeContext(context) {
  const sensitive = ['password', 'token', 'apiKey', 'secret', 'authorization']
  const sanitized = { ...context }

  sensitive.forEach(key => {
    if (key in sanitized) {
      delete sanitized[key]
    }
  })

  // Also check nested objects
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeContext(sanitized[key])
    }
  })

  return sanitized
}

/**
 * Determine if log should be sent to Sentry
 */
function shouldSendToSentry(level, context) {
  // Only send errors and warnings
  if (level !== LogLevel.ERROR && level !== LogLevel.WARNING) {
    return false
  }

  // Don't send validation errors (expected)
  if (context.category === ErrorCategory.VALIDATION) {
    return false
  }

  // Don't send 404s (expected)
  if (context.status === 404) {
    return false
  }

  return true
}

/**
 * Send to Sentry with proper context
 */
function sendToSentry(level, message, logEntry) {
  try {
    if (level === LogLevel.ERROR && logEntry.error) {
      // If we have an Error object, send the exception
      Sentry.captureException(new Error(message), {
        level: 'error',
        contexts: {
          log_entry: logEntry
        },
        tags: {
          category: logEntry.category || ErrorCategory.UNKNOWN
        }
      })
    } else {
      // Otherwise send as a message
      Sentry.captureMessage(message, {
        level: level === LogLevel.ERROR ? 'error' : 'warning',
        contexts: {
          log_entry: logEntry
        },
        tags: {
          category: logEntry.category || ErrorCategory.UNKNOWN
        }
      })
    }
  } catch (err) {
    // Don't let Sentry errors break the app
    console.error('Failed to send to Sentry:', err)
  }
}

/**
 * Export error logger instance for use in error boundaries
 */
export default {
  logError,
  logWarning,
  logInfo,
  logDebug,
  logApiError,
  logValidationError,
  LogLevel,
  ErrorCategory
}
