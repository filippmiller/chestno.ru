describe('Home Page', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should display the main heading', () => {
    cy.contains('Сделано в России! Честно!').should('be.visible')
  })

  it('should have navigation links', () => {
    cy.contains('Каталог производителей').should('be.visible')
    cy.contains('Каталог товаров').should('be.visible')
    cy.contains('Истории производств').should('be.visible')
    cy.contains('О проекте').should('be.visible')
    cy.contains('Тарифы для производителей').should('be.visible')
  })

  it('should have login and register buttons', () => {
    cy.contains('Войти').should('be.visible')
    cy.contains('Регистрация').should('be.visible')
  })

  it('should display category cards', () => {
    cy.contains('Еда и фермерские продукты').should('be.visible')
    cy.contains('Одежда и текстиль').should('be.visible')
    cy.contains('Дом и интерьер').should('be.visible')
  })

  it('should have a search input', () => {
    cy.get('input[placeholder*="Найти"]').should('be.visible')
  })

  it('should navigate to organizations page', () => {
    cy.contains('Каталог производителей').click()
    cy.url().should('include', '/orgs')
  })

  it('should navigate to products page', () => {
    cy.contains('Каталог товаров').click()
    cy.url().should('include', '/products')
  })
})
