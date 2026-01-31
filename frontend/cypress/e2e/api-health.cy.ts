describe('API Health Check', () => {
  it('should return healthy status', () => {
    cy.request('/api/health/').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('status', 'healthy')
      expect(response.body.checks).to.have.property('database')
      expect(response.body.checks).to.have.property('supabase_auth')
      expect(response.body.checks).to.have.property('configuration')
    })
  })

  it('should have healthy database connection', () => {
    cy.request('/api/health/db').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('status', 'healthy')
      expect(response.body).to.have.property('database', 'connected')
    })
  })

  it('should have healthy Supabase connection', () => {
    cy.request('/api/health/supabase').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('status', 'healthy')
    })
  })
})

describe('Widget API', () => {
  it('should return 404 for non-existent organization', () => {
    cy.request({
      url: '/api/v1/widgets/preview/non-existent-org',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(404)
    })
  })

  it('should return 404 for non-existent org in badge endpoint', () => {
    cy.request({
      url: '/api/v1/widgets/badge/test-org',
      failOnStatusCode: false,
    }).then((response) => {
      // Returns 404 for non-existent organization
      expect(response.status).to.eq(404)
      expect(response.body).to.have.property('detail')
    })
  })
})
