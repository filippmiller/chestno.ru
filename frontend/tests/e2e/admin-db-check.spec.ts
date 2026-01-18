import { test, expect, ConsoleMessage } from '@playwright/test'

const TEST_EMAIL = 'filippmiller@gmail.com'
const TEST_PASSWORD = 'Airbus380+'

test.describe('Database Explorer Console Errors', () => {
  test.setTimeout(120000)

  test('Check /admin/db for console errors', async ({ page }) => {
    const consoleErrors: string[] = []

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
        console.log(`[CONSOLE ERROR] ${msg.text()}`)
      }
    })

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message)
      console.log(`[PAGE ERROR] ${error.message}`)
    })

    // Login
    console.log('Logging in...')
    await page.goto('/auth')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 30000 })
    console.log('Login successful')

    // Navigate to Database Explorer
    console.log('Navigating to /admin/db...')
    await page.goto('/admin/db')
    await page.waitForLoadState('networkidle', { timeout: 30000 })

    // Wait for content to load and potential errors to appear
    await page.waitForTimeout(5000)

    console.log('\n=== CONSOLE ERRORS ===')
    if (consoleErrors.length === 0) {
      console.log('No console errors found!')
    } else {
      consoleErrors.forEach((err, i) => {
        console.log(`${i + 1}. ${err}`)
      })
    }

    // Take a screenshot
    await page.screenshot({ path: 'admin-db-screenshot.png', fullPage: true })
    console.log('Screenshot saved to admin-db-screenshot.png')
  })
})
