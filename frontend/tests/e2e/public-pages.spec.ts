import { test, expect, ConsoleMessage } from '@playwright/test'

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/products',
  '/stories',
  '/about',
  '/pricing',
  '/orgs',
  '/auth',
]

interface PageErrors {
  route: string
  errors: string[]
}

test.describe('Public Pages Console Errors', () => {
  test.setTimeout(180000)

  test('Check all public pages for console errors', async ({ page }) => {
    const allPageErrors: PageErrors[] = []
    const consoleErrors: string[] = []

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    page.on('pageerror', (error) => {
      consoleErrors.push(`[PAGE ERROR] ${error.message}`)
    })

    for (const route of PUBLIC_ROUTES) {
      console.log(`Checking route: ${route}`)
      const errorsBefore = consoleErrors.length

      try {
        await page.goto(route, { timeout: 30000 })
        await page.waitForLoadState('networkidle', { timeout: 30000 })
        await page.waitForTimeout(2000)

        const newErrors = consoleErrors.slice(errorsBefore)
        if (newErrors.length > 0) {
          allPageErrors.push({
            route,
            errors: [...newErrors],
          })
        }
        console.log(`  - Errors: ${newErrors.length}`)
      } catch (error) {
        console.log(`  - Navigation error: ${error}`)
        allPageErrors.push({
          route,
          errors: [`Navigation failed: ${error}`],
        })
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('PUBLIC PAGES ERROR SUMMARY')
    console.log('='.repeat(60))

    if (allPageErrors.length === 0) {
      console.log('No errors found on any public page!')
    } else {
      for (const pageError of allPageErrors) {
        console.log(`\nRoute: ${pageError.route}`)
        pageError.errors.forEach((e) => console.log(`  - ${e}`))
      }
    }

    console.log('\n' + '='.repeat(60))
  })
})
