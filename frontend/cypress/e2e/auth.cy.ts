describe('Authentication', () => {
  const testEmail = `test-${Date.now()}@example.com`
  const testPassword = 'TestPassword123!'
  const testName = 'Test User'

  describe('Registration', () => {
    beforeEach(() => {
      cy.visit('/auth')
    })

    it('should display registration form', () => {
      // Switch to registration tab if needed
      cy.contains('Регистрация').click()
      cy.get('input[type="email"]').should('be.visible')
      cy.get('input[type="password"]').should('be.visible')
    })

    it('should show validation errors for empty form', () => {
      cy.contains('Регистрация').click()
      cy.get('form').submit()
      // Should show validation messages
      cy.get('[class*="error"], [class*="invalid"]').should('exist')
    })

    it('should register a new user', () => {
      cy.contains('Регистрация').click()

      // Fill the form
      cy.get('input[type="email"]').type(testEmail)
      cy.get('input[type="password"]').type(testPassword)

      // Look for name field if present
      cy.get('body').then(($body) => {
        if ($body.find('input[name="name"], input[placeholder*="Имя"]').length) {
          cy.get('input[name="name"], input[placeholder*="Имя"]').type(testName)
        }
      })

      cy.get('form').submit()

      // Should redirect or show success message
      cy.url().should('not.include', '/auth', { timeout: 10000 })
    })
  })

  describe('Login', () => {
    beforeEach(() => {
      cy.visit('/auth')
    })

    it('should display login form', () => {
      cy.get('input[type="email"]').should('be.visible')
      cy.get('input[type="password"]').should('be.visible')
    })

    it('should show error for invalid credentials', () => {
      cy.get('input[type="email"]').type('nonexistent@example.com')
      cy.get('input[type="password"]').type('wrongpassword')
      cy.get('form').submit()

      // Should show error message
      cy.contains(/ошибка|неверн|не найден/i, { timeout: 10000 }).should('be.visible')
    })

    it('should login with valid credentials', () => {
      // First signup via API to ensure user exists
      cy.signup(testEmail, testPassword, testName)

      cy.visit('/auth')
      cy.get('input[type="email"]').type(testEmail)
      cy.get('input[type="password"]').type(testPassword)
      cy.get('form').submit()

      // Should redirect to dashboard or home
      cy.url().should('not.include', '/auth', { timeout: 10000 })
    })
  })

  describe('Logout', () => {
    it('should logout user', () => {
      // Login first
      cy.login(testEmail, testPassword)
      cy.visit('/dashboard')

      // Find and click logout
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="logout"], button:contains("Выйти")').length) {
          cy.contains('Выйти').click()
          cy.url().should('include', '/auth')
        }
      })
    })
  })
})
