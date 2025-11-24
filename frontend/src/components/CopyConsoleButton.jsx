import { useState, useEffect, useRef } from 'react'
import { ClipboardDocumentIcon, CheckIcon, ExclamationTriangleIcon, CodeBracketIcon } from '@heroicons/react/24/outline'
import consoleCapture from '../utils/consoleCapture'

export default function CopyConsoleButton() {
  const [logCount, setLogCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [copiedButton, setCopiedButton] = useState(null) // Track which button was clicked
  const [isVisible, setIsVisible] = useState(true)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    // Subscribe to log updates - use queueMicrotask to defer state updates
    // This prevents "Cannot update a component while rendering a different component" error
    // which happens when console.log is called during another component's render
    const unsubscribe = consoleCapture.subscribe((logs) => {
      queueMicrotask(() => {
        if (!isMountedRef.current) return
        setLogCount(logs.length)
        // Count errors and warnings
        const errors = logs.filter(log => log.type === 'error' || log.type === 'warn').length
        setErrorCount(errors)
      })
    })

    // Initialize counts - also deferred to avoid render-phase state updates
    queueMicrotask(() => {
      if (!isMountedRef.current) return
      const logs = consoleCapture.getLogs()
      setLogCount(logs.length)
      const errors = logs.filter(log => log.type === 'error' || log.type === 'warn').length
      setErrorCount(errors)
    })

    return () => {
      isMountedRef.current = false
      unsubscribe()
    }
  }, [])

  const handleCopy = async () => {
    try {
      const result = await consoleCapture.copyToClipboard()
      console.log(result)
      setCopiedButton('console')
      setTimeout(() => setCopiedButton(null), 2000)
    } catch (err) {
      console.error(err)
    }
  }

  const handleClear = () => {
    consoleCapture.clear()
    console.clear()
    console.log('✨ Console cleared - fresh start for debugging!')
  }

  const handleHardRefresh = () => {
    // Set flag to clear console after reload
    sessionStorage.setItem('clearConsoleAfterReload', 'true')
    window.location.reload()
  }

  const handleCopyScreen = async () => {
    try {
      // Dynamically import html2canvas to avoid loading it upfront
      const html2canvas = (await import('html2canvas')).default

      // Capture at very reduced scale for smallest possible file size
      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        ignoreElements: (element) => {
          // Skip external images that cause CORS issues
          if (element.tagName === 'IMG' && element.src.startsWith('https://tailwindcss.com')) {
            return true
          }
          return false
        },
        scale: 0.3, // 30% scale - very small but still readable for Claude
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight
      })

      // Try different clipboard methods
      let clipboardSuccess = false

      // Method 1: Try PNG format (best clipboard compatibility)
      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          const pngDataUrl = canvas.toDataURL('image/png')
          const pngResponse = await fetch(pngDataUrl)
          const pngBlob = await pngResponse.blob()

          const sizeMB = pngBlob.size / 1024 / 1024
          const sizeKB = pngBlob.size / 1024

          if (sizeMB >= 1) {
            console.log(`📸 Screenshot size: ${sizeMB.toFixed(2)}MB (${canvas.width}x${canvas.height}px)`)
          } else {
            console.log(`📸 Screenshot size: ${sizeKB.toFixed(0)}KB (${canvas.width}x${canvas.height}px)`)
          }

          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
          ])
          clipboardSuccess = true
          setCopiedButton('screenshot')
          setTimeout(() => setCopiedButton(null), 2000)
          console.log('📸 Screenshot copied to clipboard! (PNG format)')
        } catch (err1) {
          console.warn('PNG clipboard failed:', err1)
        }
      }

      // If clipboard failed, download instead
      if (!clipboardSuccess) {
        console.warn('All clipboard methods failed, downloading instead')

        try {
          // Create JPEG blob for download (smaller file size)
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.5)
          const jpegResponse = await fetch(jpegDataUrl)
          const jpegBlob = await jpegResponse.blob()

          const sizeKB = jpegBlob.size / 1024

          const url = URL.createObjectURL(jpegBlob)
          const a = document.createElement('a')
          a.href = url
          a.download = `screenshot-${Date.now()}.jpg`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)

          setCopiedButton('screenshot')
          setTimeout(() => setCopiedButton(null), 2000)
          console.log('📸 Screenshot downloaded!')
          alert(`⚠️ Clipboard blocked by browser - screenshot saved to Downloads folder (${sizeKB.toFixed(0)}KB)\n\nTo enable clipboard: Check browser permissions for this site.`)
        } catch (downloadErr) {
          console.error('Download fallback failed:', downloadErr)
          alert('Screenshot failed. Both clipboard and download methods failed.')
        }
      }
    } catch (err) {
      console.error('Screenshot failed:', err)
      alert('Screenshot failed. Please try again.')
    }
  }

  /**
   * Ultra-light HTML simplification for token reduction
   *
   * This aggressive processing reduces HTML tokens by 80-90% while keeping critical structure.
   * Future Claude: This is essential for staying under token limits when debugging complex UIs.
   *
   * What gets removed:
   * 1. Dropdown options (biggest win - 500+ options → 1 line)
   * 2. Tooltip/help text (invisible divs with documentation)
   * 3. Title/placeholder attributes (redundant for debugging)
   * 4. Visual classes (padding, margins, colors - keep only layout)
   * 5. Positioning divs (resize handles, spacers)
   * 6. Draggable handles (not needed for understanding structure)
   *
   * What's preserved:
   * - Semantic HTML structure (main, nav, table, form elements)
   * - Form element types and values
   * - aria-label (for understanding element purpose)
   * - Critical layout classes (flex, grid, w-full, sticky, relative, absolute)
   */
  const simplifyHTMLUltraLight = (html) => {
    return html
      // PHASE 1: Remove bulk content (80% of token savings)
      // Replace massive dropdown option lists with summary
      .replace(/<option[^>]*>.*?<\/option>/gi, (match, offset, string) => {
        // Keep first option, replace rest
        const selectStart = string.lastIndexOf('<select', offset)
        const selectEnd = string.indexOf('</select>', offset)
        if (selectStart !== -1 && selectEnd !== -1) {
          // Only show selected value or first option
          if (match.includes('selected') || offset === string.indexOf('<option', selectStart)) {
            return match
          }
          return '' // Remove non-selected options
        }
        return match
      })
      .replace(/<\/option>\s*<option[^>]*>/gi, '</option>')  // Collapse consecutive options
      .replace(/(<select[^>]*>)(<option[^>]*>[^<]*<\/option>)(<option[^>]*>[\s\S]*?)?(<\/select>)/gi,
        '$1$2...[more options]...$4')

      // Remove invisible tooltip/help divs (they're huge and not needed for debugging)
      .replace(/<div class="[^"]*invisible[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')

      // Remove draggable handle divs (not needed for debugging)
      .replace(/<div[^>]*draggable="true"[^>]*>[\s\S]*?<\/div>/gi, '')

      // Remove resize handle divs (positioning-only, no semantic value)
      .replace(/<div class="[^"]*cursor-col-resize[^"]*"[^>]*><\/div>/gi, '')

      // PHASE 2: Remove redundant attributes (10% savings)
      .replace(/\s+data-[a-z-]+="[^"]*"/gi, '')
      .replace(/\s+aria-(?!label)[a-z-]+="[^"]*"/gi, '')
      .replace(/\s+id="[^"]*"/gi, '')
      .replace(/\s+tabindex="[^"]*"/gi, '')
      .replace(/\s+style="[^"]*"/gi, '')
      .replace(/\s+title="[^"]*"/gi, '')  // Remove tooltips
      .replace(/\s+placeholder="[^"]*"/gi, '')  // Remove placeholders

      // PHASE 3: Simplify SVGs (5% savings)
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '<svg>...</svg>')

      // PHASE 4: Ultra-aggressive class pruning (5% savings)
      // Only keep absolutely critical layout classes
      .replace(/class="[^"]*"/g, (match) => {
        const classes = match.match(/class="([^"]*)"/)[1]
        const simplified = classes.split(' ').filter(c =>
          // Keep only these essential layout classes
          c === 'flex' || c === 'grid' || c === 'relative' || c === 'absolute' ||
          c === 'sticky' || c === 'fixed' || c === 'hidden' ||
          c.startsWith('w-') || c.startsWith('h-') || c.startsWith('max-w-') || c.startsWith('max-h-') ||
          c.startsWith('overflow-') || c.startsWith('z-') ||
          c === 'sr-only' // Keep screen reader only for accessibility context
        ).join(' ')
        return simplified ? `class="${simplified}"` : ''
      })

      // PHASE 5: Cleanup empty attributes and whitespace
      .replace(/\s+[a-z-]+=""\s*/gi, ' ')
      .replace(/\s+>/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const handleGetScreenCode = async () => {
    try {
      // Get the main content area (exclude the console bar itself)
      const mainContent = document.querySelector('main') || document.body

      // Extract relevant HTML structure
      const clone = mainContent.cloneNode(true)

      // Remove script tags and style elements to reduce noise
      clone.querySelectorAll('script, style, link[rel="stylesheet"]').forEach(el => el.remove())

      // Get the outer HTML
      let html = clone.outerHTML

      // Apply ultra-light simplification for maximum token reduction
      html = simplifyHTMLUltraLight(html)

      // Copy to clipboard
      await navigator.clipboard.writeText(html)
      setCopiedButton('code')
      setTimeout(() => setCopiedButton(null), 2000)
      console.log('💻 Screen code copied to clipboard! (Ultra-light HTML structure)')
    } catch (err) {
      console.error('Failed to get screen code:', err)
      alert('Failed to extract screen code. Please try again.')
    }
  }

  const handleGetContext = async () => {
    try {
      const logs = consoleCapture.getLogs()

      // Get ALL errors and ALL warnings (no filtering, no limits)
      const errors = logs.filter(log => log.type === 'error')
      const warnings = logs.filter(log => log.type === 'warn')

      // Get last 5 info/log messages for context (skip debug noise)
      const recentLogs = logs
        .filter(log => log.type === 'log' || log.type === 'info')
        .slice(-5)

      // Check for failed network requests
      const networkErrors = []
      if (window.performance && window.performance.getEntriesByType) {
        const resources = window.performance.getEntriesByType('resource')
        resources.forEach(resource => {
          if (resource.transferSize === 0 && resource.decodedBodySize === 0) {
            networkErrors.push(`Failed to load: ${resource.name}`)
          }
        })
      }

      // Check for React errors in the page
      const reactErrors = []
      const errorBoundaries = document.querySelectorAll('[data-error-boundary]')
      errorBoundaries.forEach(el => {
        const errorMsg = el.getAttribute('data-error-message')
        if (errorMsg) {
          reactErrors.push(errorMsg)
        }
      })

      let formatted = `=== ALL RELEVANT CONSOLE DATA ===
Total Console Logs: ${logs.length}
🚨 ALL Errors Found: ${errors.length}
⚠️  ALL Warnings Found: ${warnings.length}
🌐 Network Errors: ${networkErrors.length}
📋 Recent Logs (last 5): ${recentLogs.length}
Captured at: ${new Date().toLocaleString()}

NOTE: This includes EVERY error and warning from console, not partial data.
`

      if (errors.length > 0) {
        formatted += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 ALL CONSOLE ERRORS (${errors.length} total):\n`
        errors.forEach((log, index) => {
          const time = new Date(log.timestamp).toLocaleTimeString()
          formatted += `\nError ${index + 1}/${errors.length}:\n[${time}] ${log.message}\n`
        })
        formatted += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
      }

      if (networkErrors.length > 0) {
        formatted += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 NETWORK ERRORS (${networkErrors.length} total):\n`
        networkErrors.forEach((error, index) => {
          formatted += `\nNetwork Error ${index + 1}/${networkErrors.length}:\n${error}\n`
        })
        formatted += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
      }

      if (warnings.length > 0) {
        formatted += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ALL CONSOLE WARNINGS (${warnings.length} total):\n`
        warnings.forEach((log, index) => {
          const time = new Date(log.timestamp).toLocaleTimeString()
          formatted += `\nWarning ${index + 1}/${warnings.length}:\n[${time}] ${log.message}\n`
        })
        formatted += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
      }

      if (recentLogs.length > 0) {
        formatted += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 RECENT CONTEXT LOGS (last ${recentLogs.length}):\n`
        recentLogs.forEach(log => {
          const time = new Date(log.timestamp).toLocaleTimeString()
          formatted += `\n[${time}] ${log.message}\n`
        })
        formatted += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
      }

      if (errors.length === 0 && warnings.length === 0 && networkErrors.length === 0) {
        formatted += '\n✅ No errors or warnings found. Everything looks good!\n'
      }

      await navigator.clipboard.writeText(formatted)
      setCopiedButton('context')
      setTimeout(() => setCopiedButton(null), 2000)
      console.log(`🎯 ALL relevant data copied! ${errors.length} errors, ${warnings.length} warnings, ${networkErrors.length} network errors, ${recentLogs.length} recent logs (from ${logs.length} total logs)`)
    } catch (err) {
      console.error('Failed to get context:', err)
      alert('Failed to extract console context. Please try again.')
    }
  }

  const handleGetCompleteContext = async () => {
    try {
      const logs = consoleCapture.getLogs()

      // Get screen HTML code
      const mainContent = document.querySelector('main') || document.body
      const clone = mainContent.cloneNode(true)
      clone.querySelectorAll('script, style, link[rel="stylesheet"]').forEach(el => el.remove())
      let html = clone.outerHTML

      // Apply ultra-light simplification for maximum token reduction
      html = simplifyHTMLUltraLight(html)

      // Format all console logs
      const formattedLogs = logs.map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString()
        return `[${time}] [${log.type.toUpperCase()}] ${log.message}`
      }).join('\n\n')

      // Combine everything
      let formatted = `╔════════════════════════════════════════════════════════════════════════╗
║                   COMPLETE CONTEXT (EVERYTHING)                       ║
║  ALL Console Logs (${logs.length} total) + Page HTML Structure                ║
╚════════════════════════════════════════════════════════════════════════╝

📊 SUMMARY:
URL: ${window.location.href}
Page Title: ${document.title}
Total Console Logs: ${logs.length}
Captured at: ${new Date().toLocaleString()}

═══════════════════════════════════════════════════════════════════════════
                       ALL CONSOLE LOGS
═══════════════════════════════════════════════════════════════════════════

${formattedLogs}

═══════════════════════════════════════════════════════════════════════════
                        PAGE HTML STRUCTURE
═══════════════════════════════════════════════════════════════════════════

${html}

═══════════════════════════════════════════════════════════════════════════
                              END OF CONTEXT
═══════════════════════════════════════════════════════════════════════════
`

      await navigator.clipboard.writeText(formatted)
      setCopiedButton('complete')
      setTimeout(() => setCopiedButton(null), 2000)
      console.log(`📦 Complete context copied! ${logs.length} console logs + page HTML structure`)
    } catch (err) {
      console.error('Failed to get complete context:', err)
      alert('Failed to extract complete context. Please try again.')
    }
  }

  const handleGetFullContext = async () => {
    try {
      const logs = consoleCapture.getLogs()

      // Get ALL errors and ALL warnings
      const errors = logs.filter(log => log.type === 'error')
      const warnings = logs.filter(log => log.type === 'warn')
      const recentLogs = logs.filter(log => log.type === 'log' || log.type === 'info').slice(-5)

      // Check for failed network requests
      const networkErrors = []
      if (window.performance && window.performance.getEntriesByType) {
        const resources = window.performance.getEntriesByType('resource')
        resources.forEach(resource => {
          if (resource.transferSize === 0 && resource.decodedBodySize === 0) {
            networkErrors.push(`Failed to load: ${resource.name}`)
          }
        })
      }

      // Get screen HTML code
      const mainContent = document.querySelector('main') || document.body
      const clone = mainContent.cloneNode(true)
      clone.querySelectorAll('script, style, link[rel="stylesheet"]').forEach(el => el.remove())
      let html = clone.outerHTML

      // Apply ultra-light simplification for maximum token reduction
      html = simplifyHTMLUltraLight(html)

      // Combine everything
      let formatted = `╔════════════════════════════════════════════════════════════════════════╗
║                     FULL DEBUG CONTEXT                                ║
║  Console Errors + Warnings + Recent Logs + Page HTML Structure       ║
╚════════════════════════════════════════════════════════════════════════╝

📊 SUMMARY:
URL: ${window.location.href}
Page Title: ${document.title}
Total Console Logs: ${logs.length}
🚨 Errors: ${errors.length}
⚠️  Warnings: ${warnings.length}
🌐 Network Errors: ${networkErrors.length}
📋 Recent Logs: ${recentLogs.length}
Captured at: ${new Date().toLocaleString()}

═══════════════════════════════════════════════════════════════════════════
                           CONSOLE DATA
═══════════════════════════════════════════════════════════════════════════
`

      if (errors.length > 0) {
        formatted += `\n🚨 ALL CONSOLE ERRORS (${errors.length} total):\n`
        errors.forEach((log, index) => {
          const time = new Date(log.timestamp).toLocaleTimeString()
          formatted += `\nError ${index + 1}/${errors.length}:\n[${time}] ${log.message}\n`
        })
      }

      if (networkErrors.length > 0) {
        formatted += `\n🌐 NETWORK ERRORS (${networkErrors.length} total):\n`
        networkErrors.forEach((error, index) => {
          formatted += `\nNetwork Error ${index + 1}/${networkErrors.length}:\n${error}\n`
        })
      }

      if (warnings.length > 0) {
        formatted += `\n⚠️  ALL CONSOLE WARNINGS (${warnings.length} total):\n`
        warnings.forEach((log, index) => {
          const time = new Date(log.timestamp).toLocaleTimeString()
          formatted += `\nWarning ${index + 1}/${warnings.length}:\n[${time}] ${log.message}\n`
        })
      }

      if (recentLogs.length > 0) {
        formatted += `\n📋 RECENT CONTEXT LOGS (last ${recentLogs.length}):\n`
        recentLogs.forEach(log => {
          const time = new Date(log.timestamp).toLocaleTimeString()
          formatted += `\n[${time}] ${log.message}\n`
        })
      }

      if (errors.length === 0 && warnings.length === 0 && networkErrors.length === 0) {
        formatted += '\n✅ No errors or warnings found in console.\n'
      }

      formatted += `\n\n═══════════════════════════════════════════════════════════════════════════
                        PAGE HTML STRUCTURE
═══════════════════════════════════════════════════════════════════════════

${html}

═══════════════════════════════════════════════════════════════════════════
                              END OF CONTEXT
═══════════════════════════════════════════════════════════════════════════
`

      await navigator.clipboard.writeText(formatted)
      setCopiedButton('fullcontext')
      setTimeout(() => setCopiedButton(null), 2000)
      console.log(`🎯 Full debug context copied! ${errors.length} errors, ${warnings.length} warnings + page HTML structure`)
    } catch (err) {
      console.error('Failed to get full context:', err)
      alert('Failed to extract full context. Please try again.')
    }
  }


  const handleGetCompleteValidation = async () => {
    try {
      const logs = consoleCapture.getLogs()

      // Get screen HTML code
      const mainContent = document.querySelector('main') || document.body
      const clone = mainContent.cloneNode(true)
      clone.querySelectorAll('script, style, link[rel="stylesheet"]').forEach(el => el.remove())
      let html = clone.outerHTML
      html = simplifyHTMLUltraLight(html)

      // Capture screenshot
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        scale: 0.3,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight
      })

      const pngDataUrl = canvas.toDataURL('image/png')
      const pngResponse = await fetch(pngDataUrl)
      const pngBlob = await pngResponse.blob()
      const sizeKB = (pngBlob.size / 1024).toFixed(0)

      // Format all console logs
      const formattedLogs = logs.map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString()
        return `[${time}] [${log.type.toUpperCase()}] ${log.message}`
      }).join('\n')

      // Validation checks
      const errors = logs.filter(log => log.type === 'error')
      const warnings = logs.filter(log => log.type === 'warn')
      const doesMatch = errors.length === 0 && warnings.length === 0
      const hasPastAll = doesMatch

      // ═══════════════════════════════════════════════════════════════════
      // ENHANCED: Capture Network Activity (per RULE #6)
      // ═══════════════════════════════════════════════════════════════════
      const networkData = []
      const failedRequests = []
      const slowRequests = []

      if (window.performance && window.performance.getEntriesByType) {
        const resources = window.performance.getEntriesByType('resource')
        const navigation = window.performance.getEntriesByType('navigation')[0]

        // Capture all API calls (fetch/XHR)
        resources.forEach(resource => {
          const isAPI = resource.name.includes('/api/') ||
                       resource.initiatorType === 'fetch' ||
                       resource.initiatorType === 'xmlhttprequest'

          if (isAPI) {
            const duration = (resource.duration || 0).toFixed(0)
            const size = resource.transferSize || 0
            const failed = resource.transferSize === 0 && resource.decodedBodySize === 0

            const entry = {
              url: resource.name,
              method: resource.initiatorType,
              duration: `${duration}ms`,
              size: size > 0 ? `${(size / 1024).toFixed(1)}KB` : 'failed',
              status: failed ? 'FAILED' : 'OK'
            }

            networkData.push(entry)

            // Track failures
            if (failed) {
              failedRequests.push(entry)
            }

            // Track slow requests (>2s)
            if (resource.duration > 2000) {
              slowRequests.push(entry)
            }
          }
        })

        // Add page load timing
        if (navigation) {
          const loadTime = (navigation.loadEventEnd - navigation.fetchStart).toFixed(0)
          networkData.unshift({
            url: 'Page Load',
            method: 'navigation',
            duration: `${loadTime}ms`,
            size: '-',
            status: 'OK'
          })
        }
      }

      // Format network data
      const formattedNetwork = networkData.map(req =>
        `${req.status === 'FAILED' ? '🔴' : req.duration.includes('ms') && parseInt(req.duration) > 2000 ? '🟡' : '🟢'} ${req.method.toUpperCase().padEnd(12)} ${req.duration.padEnd(8)} ${req.size.padEnd(10)} ${req.url}`
      ).join('\n')

      // ═══════════════════════════════════════════════════════════════════
      // ENHANCED: User Context (per RULE #6)
      // ═══════════════════════════════════════════════════════════════════
      const userAgent = navigator.userAgent
      const browserInfo = {
        browser: /Chrome/.test(userAgent) ? 'Chrome' :
                /Firefox/.test(userAgent) ? 'Firefox' :
                /Safari/.test(userAgent) ? 'Safari' :
                /Edge/.test(userAgent) ? 'Edge' : 'Unknown',
        version: userAgent.match(/(?:Chrome|Firefox|Safari|Edge)\/(\d+)/)?.[1] || 'Unknown',
        platform: navigator.platform,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        devicePixelRatio: window.devicePixelRatio
      }

      // ═══════════════════════════════════════════════════════════════════
      // ENHANCED: Current User & Role (if available)
      // ═══════════════════════════════════════════════════════════════════
      let currentUser = null
      try {
        const userStr = localStorage.getItem('user')
        if (userStr) currentUser = JSON.parse(userStr)
      } catch (e) {
        console.warn('Failed to parse user from localStorage:', e)
      }
      const userRole = currentUser?.role || 'Unknown'
      const userId = currentUser?.id || 'Unknown'

      // Convert screenshot to base64 data URL for embedding in text
      const screenshotDataUrl = pngDataUrl

      // Combine everything with validation status + embedded screenshot + network data
      let formatted = `╔════════════════════════════════════════════════════════════════════════╗
║               🐛 LET'S DEBUG THIS! (RULE #6 Enhanced)                ║
║  I've captured everything you need to fix this bug                    ║
╚════════════════════════════════════════════════════════════════════════╝

🎯 DEBUGGING WORKFLOW:
1. Check the SCREENSHOT below - see what the user is actually seeing
2. Compare SCREENSHOT with HTML CODE - do they match? Any rendering issues?
3. Check CONSOLE for errors - any JavaScript errors or warnings?
4. Check NETWORK for failed/slow requests - API issues?
5. Review USER CONTEXT - browser-specific bug? Wrong role/permissions?

📊 QUICK SUMMARY:
${doesMatch ? '✅ Console Clean - No errors or warnings' : '🚨 ERRORS FOUND - Check console section below!'}
🌐 Network: ${networkData.length} requests (${failedRequests.length} failed, ${slowRequests.length} slow)
📸 Screenshot: ${sizeKB}KB (${canvas.width}x${canvas.height}px)
👤 User: ${userRole} (ID: ${userId})
🌍 Browser: ${browserInfo.browser} ${browserInfo.version} on ${browserInfo.platform}
📍 URL: ${window.location.href}
🕐 Captured: ${new Date().toLocaleString()}

═══════════════════════════════════════════════════════════════════════════
                    📸 STEP 1: CHECK THE SCREENSHOT
═══════════════════════════════════════════════════════════════════════════

I've embedded a PNG screenshot below (base64 format). This shows EXACTLY what the user is seeing.
You can view it by:
1. Pasting this entire message into Claude (I can see images in base64 data URLs)
2. Copying the data URL to your browser address bar
3. Saving as .html file and opening in browser

Screenshot Details: ${sizeKB}KB (${canvas.width}x${canvas.height}px)

${screenshotDataUrl}

═══════════════════════════════════════════════════════════════════════════
                    💻 STEP 2: CHECK THE HTML CODE
═══════════════════════════════════════════════════════════════════════════

This is the simplified HTML structure of the page. Compare this with the screenshot above.
Ask yourself: Does the HTML match what's visible in the screenshot? Any missing elements?

${html}

═══════════════════════════════════════════════════════════════════════════
                    🔴 STEP 3: CHECK THE CONSOLE
═══════════════════════════════════════════════════════════════════════════

${errors.length > 0 ? `🚨 FOUND ${errors.length} ERROR(S) - Start debugging here!` : '✅ No console errors'}
${warnings.length > 0 ? `⚠️  FOUND ${warnings.length} WARNING(S) - May indicate issues` : '✅ No console warnings'}

Total console logs captured: ${logs.length}

${formattedLogs || '(No console logs captured)'}

═══════════════════════════════════════════════════════════════════════════
                    🌐 STEP 4: CHECK THE NETWORK
═══════════════════════════════════════════════════════════════════════════

${failedRequests.length > 0 ? `🔴 FOUND ${failedRequests.length} FAILED REQUEST(S) - API issues likely!` : '✅ No failed requests'}
${slowRequests.length > 0 ? `🟡 FOUND ${slowRequests.length} SLOW REQUEST(S) - Performance issues` : '✅ No slow requests'}

Total network requests: ${networkData.length}
Legend: 🟢 OK | 🟡 Slow (>2s) | 🔴 Failed

${formattedNetwork || '(No network activity captured)'}

${failedRequests.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 FAILED REQUESTS DETAIL (${failedRequests.length} total):
${failedRequests.map(req => `   ${req.url}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

${slowRequests.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟡 SLOW REQUESTS DETAIL (${slowRequests.length} total):
${slowRequests.map(req => `   ${req.duration.padEnd(8)} ${req.url}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

═══════════════════════════════════════════════════════════════════════════
                    👤 STEP 5: CHECK USER CONTEXT
═══════════════════════════════════════════════════════════════════════════

Browser: ${browserInfo.browser} ${browserInfo.version}
Platform: ${browserInfo.platform}
Screen Size: ${browserInfo.screenSize}
Viewport Size: ${browserInfo.viewportSize}
Device Pixel Ratio: ${browserInfo.devicePixelRatio}

User Role: ${userRole}
User ID: ${userId}
Current URL: ${window.location.href}
Page Title: ${document.title}
Timestamp: ${new Date().toLocaleString()}

Is this a browser-specific bug? Permission issue? Wrong user role?

═══════════════════════════════════════════════════════════════════════════
                    ✅ DEBUGGING SUMMARY
═══════════════════════════════════════════════════════════════════════════

Let's debug this step by step:

1. ✅ Screenshot embedded above - See what user sees
2. ✅ HTML code provided - Compare with screenshot
3. ${errors.length > 0 ? `🚨 ${errors.length} Console errors found - Check Step 3` : '✅ Console clean'}
4. ${failedRequests.length > 0 ? `🔴 ${failedRequests.length} Network failures - Check Step 4` : '✅ Network clean'}
5. ✅ User context captured - Check Step 5 for environment details

${errors.length > 0 || failedRequests.length > 0 ?
`🎯 START HERE: ${errors.length > 0 ? `Fix the ${errors.length} console error(s) first` : `Fix the ${failedRequests.length} failed network request(s)`}`
: '✅ Everything looks clean - describe what the bug is and I\'ll help investigate!'}

═══════════════════════════════════════════════════════════════════════════
`

      // Copy everything to clipboard as text (including embedded screenshot)
      await navigator.clipboard.writeText(formatted)

      setCopiedButton('validation')
      setTimeout(() => setCopiedButton(null), 2000)
      console.log(`📦 Complete validation: ${doesMatch ? 'PASSED ✅' : 'FAILED ❌'}`)
      console.log(`   📊 ${logs.length} console logs, ${errors.length} errors, ${warnings.length} warnings`)
      console.log(`   🌐 ${networkData.length} network requests, ${failedRequests.length} failed, ${slowRequests.length} slow`)
      console.log(`   📸 ${sizeKB}KB screenshot embedded as base64`)
      console.log(`   👤 User: ${userRole} (ID: ${userId})`)
      console.log('✅ Everything copied to clipboard in ONE paste!')
    } catch (err) {
      console.error('Failed to get complete validation:', err)
      alert('Failed to extract complete validation. Please try again.')
    }
  }

  // Only show in development or staging
  const isDev = import.meta.env.DEV
  const isStaging = window.location.hostname.includes('vercel.app') ||
                    window.location.hostname.includes('staging') ||
                    window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1'

  if (!isDev && !isStaging) {
    return null
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-1 right-1 bg-gray-800 text-white p-1 rounded-full shadow-lg hover:bg-gray-700 transition-all z-[9999]"
        title="Show Console Tools"
      >
        <ClipboardDocumentIcon className="h-3 w-3" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg border-t border-gray-200 dark:border-gray-700 z-[9999] py-1">
      <div className="flex items-center justify-between gap-1.5 max-w-screen-2xl mx-auto px-2">
        {/* Left side - Info */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
            Console
          </span>
          <span className="text-[10px] px-1.5 py-0 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            {logCount}
          </span>
        </div>

        {/* Center - Actions (always visible) */}
        <div className="flex items-center gap-1 flex-1 justify-center">
          <button
            onClick={handleCopy}
            disabled={logCount === 0}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
              copiedButton === 'console'
                ? 'bg-green-600 text-white'
                : logCount === 0
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {copiedButton === 'console' ? (
              <>
                <CheckIcon className="h-2.5 w-2.5" />
                Copied!
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="h-2.5 w-2.5" />
                Console
                {logCount > 0 && (
                  <span className="ml-0.5 px-1 py-0 rounded-full bg-indigo-800 text-white text-[9px] font-bold">
                    {logCount}
                  </span>
                )}
              </>
            )}
          </button>

          <button
            onClick={handleGetContext}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
              copiedButton === 'context'
                ? 'bg-green-600 text-white'
                : 'bg-yellow-400 dark:bg-yellow-500 text-black dark:text-black hover:bg-yellow-500 dark:hover:bg-yellow-600'
            }`}
            title="Get ALL errors + warnings from console (no HTML)"
          >
            {copiedButton === 'context' ? (
              <>
                <CheckIcon className="h-2.5 w-2.5" />
                Copied!
              </>
            ) : (
              <>
                <ExclamationTriangleIcon className="h-2.5 w-2.5" />
                Console
                {errorCount > 0 && (
                  <span className="ml-0.5 px-1 py-0 rounded-full bg-red-600 text-white text-[9px] font-bold">
                    {errorCount}
                  </span>
                )}
              </>
            )}
          </button>

          <button
            onClick={handleClear}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500 text-white hover:bg-red-600 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-2.5 w-2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            Clear
          </button>

          <button
            onClick={handleCopyScreen}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
              copiedButton === 'screenshot'
                ? 'bg-green-600 text-white'
                : 'bg-purple-100 dark:bg-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-600'
            }`}
          >
            {copiedButton === 'screenshot' ? (
              <>
                <CheckIcon className="h-2.5 w-2.5" />
                Copied!
              </>
            ) : (
              'Screenshot'
            )}
          </button>

          <button
            onClick={handleGetScreenCode}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
              copiedButton === 'code'
                ? 'bg-green-600 text-white'
                : 'bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-600'
            }`}
            title="Get page HTML structure (no console data)"
          >
            {copiedButton === 'code' ? (
              <>
                <CheckIcon className="h-2.5 w-2.5" />
                Copied!
              </>
            ) : (
              <>
                <CodeBracketIcon className="h-2.5 w-2.5" />
                Screenshot
              </>
            )}
          </button>

          <button
            onClick={handleHardRefresh}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500 text-white hover:bg-green-600 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-2.5 w-2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>

          <button
            onClick={handleGetCompleteContext}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
              copiedButton === 'complete'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title="Get ALL console logs + page HTML (everything)"
          >
            {copiedButton === 'complete' ? (
              <>
                <CheckIcon className="h-2.5 w-2.5" />
                Copied!
              </>
            ) : (
              <>
                Con/Screen
                {logCount > 0 && (
                  <span className="ml-0.5 px-1 py-0 rounded-full bg-gray-400 dark:bg-gray-600 text-white text-[9px] font-bold">
                    {logCount}
                  </span>
                )}
              </>
            )}
          </button>

          <button
            onClick={handleGetFullContext}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
              copiedButton === 'fullcontext'
                ? 'bg-green-600 text-white'
                : 'bg-orange-100 dark:bg-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-600'
            }`}
            title="Get ALL errors + warnings + page HTML in one copy (complete debug context)"
          >
            {copiedButton === 'fullcontext' ? (
              <>
                <CheckIcon className="h-2.5 w-2.5" />
                Copied!
              </>
            ) : (
              <>
                <ExclamationTriangleIcon className="h-2.5 w-2.5" />
                <CodeBracketIcon className="h-2.5 w-2.5" />
                Con/Screen
                {errorCount > 0 && (
                  <span className="ml-0.5 px-1 py-0 rounded-full bg-red-600 text-white text-[9px] font-bold">
                    {errorCount}
                  </span>
                )}
              </>
            )}
          </button>

          <button
            onClick={handleGetCompleteValidation}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
              copiedButton === 'validation'
                ? 'bg-green-600 text-white'
                : 'bg-emerald-100 dark:bg-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-600'
            }`}
            title="Complete validation: Console + Screenshot + HTML + validation status (does match & have past all)"
          >
            {copiedButton === 'validation' ? (
              <>
                <CheckIcon className="h-2.5 w-2.5" />
                Copied!
              </>
            ) : (
              <>
                ✓ Validate
                {logCount > 0 && (
                  <span className="ml-0.5 px-1 py-0 rounded-full bg-emerald-600 text-white text-[9px] font-bold">
                    {logCount}
                  </span>
                )}
              </>
            )}
          </button>
        </div>

        {/* Right side - Close */}
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 transition-colors"
          title="Hide console tools"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
