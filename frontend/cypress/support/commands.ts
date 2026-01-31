// Cypress Custom Commands

/**
 * Login command - uses the auth v2 API
 */
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/v2/login',
    body: { email, password },
    failOnStatusCode: false,
  }).then((response) => {
    if (response.status !== 200) {
      cy.log(`Login failed: ${response.body?.detail || 'Unknown error'}`)
    }
  })
})

/**
 * Signup command - creates a new user via auth v2 API
 */
Cypress.Commands.add('signup', (email: string, password: string, name: string) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/v2/signup',
    body: { email, password, name },
    failOnStatusCode: false,
  }).then((response) => {
    if (response.status !== 200 && response.status !== 201) {
      cy.log(`Signup failed: ${response.body?.detail || 'Unknown error'}`)
    }
  })
})

/**
 * Logout command
 */
Cypress.Commands.add('logout', () => {
  cy.request({
    method: 'POST',
    url: '/api/auth/v2/logout',
    failOnStatusCode: false,
  })
})
