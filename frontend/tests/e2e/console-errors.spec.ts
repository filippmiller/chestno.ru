import { test, expect, Page, ConsoleMessage } from '@playwright/test'

// Credentials from user
const TEST_EMAIL = 'filippmiller@gmail.com'
const TEST_PASSWORD = 'Airbus380+'

// All dashboard/admin routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/dashboard/organization/profile',
  '/dashboard/organization/posts',
  '/dashboard/organization/reviews',
  '/dashboard/organization/products',
  '/dashboard/organization/plan',
  '/dashboard/organization/invites',
  '/dashboard/organization/onboarding',
  '/dashboard/organization/analytics',
  '/dashboard/organization/qr',
  '/dashboard/organization/marketing',
  '/dashboard/notifications',
  '/dashboard/settings/notifications',
  '/settings/linked-accounts',
  '/dashboard/moderation/organizations',
  '/admin',
  '/admin/db',
  '/admin/imports',
]

// Store console errors per page
interface PageErrors {
  route: string
  errors: string[]
  warnings: string[]
}

test.describe('Console Error Check - All Pages', () => {
  // Increase test timeout to 5 minutes
  test.setTimeout(300000)

  let allPageErrors: PageErrors[] = []

  test('Login and check all protected pages for console errors', async ({
    page,
  }) => {
    // Collect console messages
    const consoleErrors: string[] = []
    const consoleWarnings: string[] = []

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[ERROR] ${msg.text()}`)
      }
      if (msg.type() === 'warning') {
        consoleWarnings.push(`[WARN] ${msg.text()}`)
      }
    })

    // Also capture page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      consoleErrors.push(`[PAGE ERROR] ${error.message}`)
    })

    // Step 1: Login
    console.log('Navigating to login page...')
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')

    // Fill login form
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)

    // Click login button
    await page.click('button[type="submit"]')

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 30000 })
    console.log('Login successful, now on dashboard')

    // Clear any login-related console messages
    consoleErrors.length = 0
    consoleWarnings.length = 0

    // Step 2: Visit each protected route and collect errors
    for (const route of PROTECTED_ROUTES) {
      console.log(`\nChecking route: ${route}`)

      // Clear previous page errors
      const pageErrors: string[] = []
      const pageWarnings: string[] = []

      // Copy current errors before navigation
      const errorsBefore = consoleErrors.length

      try {
        await page.goto(route, { timeout: 30000 })
        await page.waitForLoadState('networkidle', { timeout: 30000 })

        // Give the page a moment to render and trigger any lazy errors
        await page.waitForTimeout(3000)

        // Collect new errors since navigation
        const newErrors = consoleErrors.slice(errorsBefore)
        const newWarnings = consoleWarnings.slice(
          consoleWarnings.length - pageWarnings.length,
        )

        if (newErrors.length > 0 || newWarnings.length > 0) {
          allPageErrors.push({
            route,
            errors: [...newErrors],
            warnings: [...newWarnings],
          })
        }

        console.log(
          `  - Errors: ${newErrors.length}, Warnings: ${newWarnings.length}`,
        )
      } catch (error) {
        console.log(`  - Navigation error: ${error}`)
        allPageErrors.push({
          route,
          errors: [`Navigation failed: ${error}`],
          warnings: [],
        })
      }
    }

    // Step 3: Print summary
    console.log('\n' + '='.repeat(60))
    console.log('CONSOLE ERROR SUMMARY')
    console.log('='.repeat(60))

    if (allPageErrors.length === 0) {
      console.log('No errors found on any page!')
    } else {
      for (const pageError of allPageErrors) {
        console.log(`\nRoute: ${pageError.route}`)
        if (pageError.errors.length > 0) {
          console.log('  Errors:')
          pageError.errors.forEach((e) => console.log(`    - ${e}`))
        }
        if (pageError.warnings.length > 0) {
          console.log('  Warnings:')
          pageError.warnings.forEach((w) => console.log(`    - ${w}`))
        }
      }
    }

    console.log('\n' + '='.repeat(60))

    // Report but don't fail - we want to see all errors
    if (allPageErrors.some((p) => p.errors.length > 0)) {
      console.log(
        `Found errors on ${allPageErrors.filter((p) => p.errors.length > 0).length} pages`,
      )
    }
  })
})
