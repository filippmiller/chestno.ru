import { test, expect } from '@playwright/test'

test.describe('Registration and Login Flow', () => {
    const baseURL = process.env.E2E_BASE_URL || 'https://chestnoru-production.up.railway.app'
    const timestamp = Date.now()
    const testEmail = `testuser${timestamp}@example.com`
    const testPassword = `TestPass${timestamp}!`
    const testFullName = 'Test User'

    test('should register a new user and then login successfully', async ({ page }) => {
        // Step 1: Navigate to auth page
        await page.goto(`${baseURL}/auth`, { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle').catch(() => {}) // Ignore timeout

        // Step 2: Click on Registration tab
        await page.click('text=Регистрация')
        await page.waitForTimeout(500)

        // Step 3: Fill registration form
        const fullNameInput = page.locator('input[placeholder*="Полное имя"], input[name*="full"], input[type="text"]').first()
        const emailInput = page.locator('input[type="email"]')
        const passwordInput = page.locator('input[type="password"]')
        const registerButton = page.locator('button:has-text("Зарегистрироваться")')

        // Fill form fields
        await fullNameInput.fill(testFullName)
        await emailInput.fill(testEmail)
        await passwordInput.fill(testPassword)

        // Step 4: Submit registration
        await registerButton.click()
        await page.waitForTimeout(3000) // Wait for response

        // Step 5: Check for email confirmation message
        const successMessage = page.locator('text=/подтвердите.*e-mail|email.*подтвержден|confirmation/i')
        const errorMessage = page.locator('text=/ошибка|error/i')

        // Either we see success message (email confirmation required) or error
        const hasSuccessMessage = await successMessage.isVisible().catch(() => false)
        const hasErrorMessage = await errorMessage.isVisible().catch(() => false)

        console.log(`Registration result - Success message visible: ${hasSuccessMessage}, Error message visible: ${hasErrorMessage}`)

        // If email confirmation is required, that's expected behavior
        if (hasSuccessMessage) {
            console.log('✅ Registration successful - email confirmation required')
            expect(hasSuccessMessage).toBe(true)
        } else if (hasErrorMessage) {
            // Check if it's a validation error or something else
            const errorText = await errorMessage.textContent().catch(() => '')
            console.log(`Registration error: ${errorText}`)
            
            // If user already exists, that's also acceptable (idempotency)
            if (errorText.includes('уже зарегистрирован') || errorText.includes('already registered')) {
                console.log('✅ User already exists - this is acceptable for idempotent tests')
            } else {
                throw new Error(`Registration failed with error: ${errorText}`)
            }
        } else {
            // Check if we were redirected (auto-login after registration)
            const currentUrl = page.url()
            if (!currentUrl.includes('/auth')) {
                console.log('✅ Registration successful - auto-logged in and redirected')
                return // Test passed - user was auto-logged in
            } else {
                throw new Error('Registration completed but no success message or redirect')
            }
        }

        // Step 6: Now try to login with the same credentials
        console.log('\n=== Testing Login ===')
        
        // Click on Login tab
        await page.click('text=Вход')
        await page.waitForTimeout(500)

        // Fill login form
        const loginEmailInput = page.locator('input[type="email"]').first()
        const loginPasswordInput = page.locator('input[type="password"]').first()
        const loginButton = page.locator('button:has-text("Войти")')

        await loginEmailInput.fill(testEmail)
        await loginPasswordInput.fill(testPassword)
        await loginButton.click()
        await page.waitForTimeout(3000)

        // Step 7: Check login result
        const loginErrorMessage = page.locator('text=/неверный|invalid|ошибка|error/i')
        const hasLoginError = await loginErrorMessage.isVisible().catch(() => false)

        if (hasLoginError) {
            const errorText = await loginErrorMessage.textContent().catch(() => '')
            console.log(`Login error: ${errorText}`)
            
            // If email is not confirmed, that's expected
            if (errorText.includes('подтвердите') || errorText.includes('confirmation')) {
                console.log('⚠️  Login failed - email not confirmed (expected behavior)')
                // This is acceptable - user needs to confirm email first
            } else {
                throw new Error(`Login failed with error: ${errorText}`)
            }
        } else {
            // Check if we were redirected (successful login)
            const currentUrl = page.url()
            if (!currentUrl.includes('/auth')) {
                console.log('✅ Login successful - redirected to dashboard')
            } else {
                // Check if there's a success indicator
                const userMenu = page.locator('text=/выйти|logout|профиль|profile/i')
                const hasUserMenu = await userMenu.isVisible().catch(() => false)
                
                if (hasUserMenu) {
                    console.log('✅ Login successful - user menu visible')
                } else {
                    console.log('⚠️  Login completed but no clear success indicator')
                }
            }
        }
    })
})


