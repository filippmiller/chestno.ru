// Cypress E2E Support File

// Import commands.js using ES2015 syntax
import './commands'

// Prevent TypeScript from showing error for Cypress globals
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login via API
       * @example cy.login('test@example.com', 'password123')
       */
      login(email: string, password: string): Chainable<void>

      /**
       * Custom command to signup a new user via API
       * @example cy.signup('test@example.com', 'password123', 'Test User')
       */
      signup(email: string, password: string, name: string): Chainable<void>

      /**
       * Custom command to logout
       * @example cy.logout()
       */
      logout(): Chainable<void>
    }
  }
}
