/**
 * 02-checkout.browser.stack.test.ts
 *
 * Browser-driven checkout flow — a complete user journey through the UI.
 *
 * This test demonstrates how L1 stack tests extend to browser-driven
 * verification. The same principle applies: real system, real dependencies,
 * no mocks. But instead of making HTTP calls, we drive a real browser through
 * the checkout flow: browse products, add to cart, fill checkout form, submit,
 * and verify the confirmation page.
 *
 * Maps to L1 patterns:
 * - Pattern 1.1 (Stack Tests): Full user journey, not component tests
 * - Pattern 1.2 (Full-Loop Assertions): UI state + page content + console
 * - Pattern 1.3 (Sequential Ordering): Assumes 01-startup passed
 * - Pattern 1.5 (No-Mock Philosophy): Real browser, real pages, real DOM
 *
 * Uses Playwright's Page Object Model (POM) to keep test code clean and
 * maintainable. Page objects encapsulate DOM selectors and interaction
 * patterns — changing a button selector updates one file, not every test.
 */

import { test, expect, Page, Locator } from '@playwright/test';

// ---------------------------------------------------------------------------
// Page Objects
// ---------------------------------------------------------------------------
// Page objects encapsulate DOM structure and interaction patterns. They make
// tests readable and maintainable — selectors live in one place, and test
// code expresses user intent, not DOM manipulation.
//
// In a real project, these would live in a separate directory like
// tests/stack/browser/pages/ and be imported by multiple test files.

class ProductsPage {
  readonly page: Page;
  readonly productCard: (name: string) => Locator;
  readonly addToCartButton: (name: string) => Locator;
  readonly cartBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    // Selectors are data-testid-based for stability. CSS classes and text
    // content change frequently; test IDs are stable contracts between
    // the app and its tests.
    this.productCard = (name: string) =>
      page.locator(`[data-testid="product-card"]:has-text("${name}")`);
    this.addToCartButton = (name: string) =>
      this.productCard(name).locator('[data-testid="add-to-cart"]');
    this.cartBadge = page.locator('[data-testid="cart-badge"]');
  }

  async goto() {
    await this.page.goto('/products');
    // Wait for product list to render — ensures data loaded from backend.
    await this.page.locator('[data-testid="product-card"]').first().waitFor();
  }

  async addProductToCart(productName: string) {
    await this.addToCartButton(productName).click();
    // Wait for cart badge to update — proves the add-to-cart action
    // completed and the UI re-rendered to reflect the new cart state.
    await expect(this.cartBadge).toBeVisible();
  }

  async getCartCount(): Promise<string> {
    return (await this.cartBadge.textContent()) ?? '0';
  }
}

class CartPage {
  readonly page: Page;
  readonly cartItems: Locator;
  readonly checkoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cartItems = page.locator('[data-testid="cart-item"]');
    this.checkoutButton = page.locator('[data-testid="checkout-button"]');
  }

  async goto() {
    await this.page.goto('/cart');
    await this.cartItems.first().waitFor();
  }

  async getItemCount(): Promise<number> {
    return this.cartItems.count();
  }

  async proceedToCheckout() {
    await this.checkoutButton.click();
    // Wait for navigation to the checkout form.
    await this.page.waitForURL('**/checkout');
  }
}

class CheckoutPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly nameInput: Locator;
  readonly addressInput: Locator;
  readonly cityInput: Locator;
  readonly zipInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    // Form field selectors — each tied to a specific data-testid.
    this.emailInput = page.locator('[data-testid="checkout-email"]');
    this.nameInput = page.locator('[data-testid="checkout-name"]');
    this.addressInput = page.locator('[data-testid="checkout-address"]');
    this.cityInput = page.locator('[data-testid="checkout-city"]');
    this.zipInput = page.locator('[data-testid="checkout-zip"]');
    this.submitButton = page.locator('[data-testid="checkout-submit"]');
    this.errorMessage = page.locator('[data-testid="checkout-error"]');
  }

  async goto() {
    await this.page.goto('/checkout');
  }

  /**
   * Fill the checkout form with valid data.
   *
   * Each field is filled individually using fill(), which clears the field
   * first and types the new value. This is more reliable than type() for
   * pre-populated or auto-completed fields.
   */
  async fillForm(data: {
    email: string;
    name: string;
    address: string;
    city: string;
    zip: string;
  }) {
    await this.emailInput.fill(data.email);
    await this.nameInput.fill(data.name);
    await this.addressInput.fill(data.address);
    await this.cityInput.fill(data.city);
    await this.zipInput.fill(data.zip);
  }

  async submit() {
    await this.submitButton.click();
  }

  async expectValidationError(message: string | RegExp) {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(message);
  }
}

class OrderConfirmationPage {
  readonly page: Page;
  readonly orderId: Locator;
  readonly orderSummary: Locator;
  readonly itemCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.orderId = page.locator('[data-testid="order-id"]');
    this.orderSummary = page.locator('[data-testid="order-summary"]');
    this.itemCount = page.locator('[data-testid="order-item-count"]');
  }

  async expectVisible() {
    await expect(this.orderId).toBeVisible();
    await expect(this.orderSummary).toBeVisible();
  }

  async getOrderId(): Promise<string> {
    return (await this.orderId.textContent()) ?? '';
  }
}

// ---------------------------------------------------------------------------
// Tests — Atomic User Journey: Browse, Add to Cart, Checkout
// ---------------------------------------------------------------------------

test.describe('Browser Stack Test: Checkout Flow', () => {
  // Shared state across tests within this describe block.
  // Each test in the sequence builds on the previous one's state.
  let productsPage: ProductsPage;
  let orderId: string;

  test('step 1: browse products and add item to cart', async ({ page }) => {
    productsPage = new ProductsPage(page);

    // Navigate to the products listing page.
    await productsPage.goto();

    // Primary assertion: product cards are rendered.
    // This proves the frontend fetched data from the backend API
    // and rendered it into the DOM.
    const productCount = await page
      .locator('[data-testid="product-card"]')
      .count();
    expect(productCount).toBeGreaterThan(0);

    // Add a specific product to the cart via UI interaction.
    await productsPage.addProductToCart('Test Widget');

    // Second-order assertion: cart badge updated.
    // The badge is a derived UI element — it reflects server-side state
    // (the cart was created) through the frontend's reactive update.
    const count = await productsPage.getCartCount();
    expect(count).toBe('1');

    // Second-order assertion: cart badge is visible in the page header.
    // This verifies the UI component that signals cart state to the user.
    await expect(productsPage.cartBadge).toBeVisible();
  });

  test('step 2: cart page shows the added item', async ({ page }) => {
    const cartPage = new CartPage(page);

    await cartPage.goto();

    // Primary assertion: cart contains exactly one item.
    const itemCount = await cartPage.getItemCount();
    expect(itemCount).toBe(1);

    // Second-order assertion: item details match what was added.
    const cartItemText = await page
      .locator('[data-testid="cart-item"]')
      .first()
      .textContent();
    expect(cartItemText).toContain('Test Widget');
  });

  test('step 3: checkout form validates required fields', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.goto();

    // Submit the form without filling any fields.
    await checkoutPage.submit();

    // Primary assertion: validation error appears.
    // This tests client-side and/or server-side validation without
    // creating a real order — a lightweight check before the full flow.
    await checkoutPage.expectValidationError(/required|invalid/i);
  });

  test('step 4: complete checkout and see confirmation', async ({ page }) => {
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);
    const confirmationPage = new OrderConfirmationPage(page);

    // Start from the cart page and navigate to checkout.
    await cartPage.goto();
    await cartPage.proceedToCheckout();

    // Fill the checkout form with valid data.
    await checkoutPage.fillForm({
      email: 'shopper@example.com',
      name: 'Test Shopper',
      address: '123 Main St',
      city: 'Springfield',
      zip: '62701',
    });

    // Submit the form.
    await checkoutPage.submit();

    // Primary assertion: confirmation page renders with order ID.
    // Wait for navigation to complete and confirmation to appear.
    await page.waitForURL('**/order-confirmation', { timeout: 30000 });
    await confirmationPage.expectVisible();

    // Capture the order ID for subsequent verification.
    orderId = await confirmationPage.getOrderId();
    expect(orderId).toMatch(/^ord_[a-zA-Z0-9]+$/);

    // Second-order assertion: confirmation page shows correct item count.
    await expect(confirmationPage.itemCount).toContainText('1');

    // Second-order assertion: confirmation page references the product.
    const summaryText = await confirmationPage.orderSummary.textContent();
    expect(summaryText).toContain('Test Widget');
  });

  test('step 5: order appears in order history (cross-page verification)', async ({
    page,
  }) => {
    // Navigate to the orders page — a different page than the confirmation.
    await page.goto('/orders');

    // Second-order: cross-page verification.
    // The order that was just placed should appear in the order history.
    // This proves the order was persisted to the database (not just rendered
    // in the confirmation page) and the orders list endpoint returns it.
    const orderRow = page.locator(
      `[data-testid="order-row"]:has-text("${orderId}")`,
    );
    await expect(orderRow).toBeVisible();

    // Third-order: order status is correct.
    // A newly placed order should show as "confirmed" or "processing".
    const statusBadge = orderRow.locator('[data-testid="order-status"]');
    await expect(statusBadge).toContainText(/confirmed|processing/i);
  });
});
