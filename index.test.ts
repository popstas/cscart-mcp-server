import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as dotenv from 'dotenv';
dotenv.config();

// Import functions to test
import { searchProducts } from './index.js';
import * as api from './api.js';

describe('CS-Cart MCP Server', () => {
  it('should load environment variables', () => {
    expect(process.env.CSCART_SHOP_URL).toBeDefined();
    expect(process.env.CSCART_EMAIL).toBeDefined();
    expect(process.env.CSCART_API_KEY).toBeDefined();
  });

  it('should export main logic functions', () => {
    expect(api.getProduct).toBeInstanceOf(Function);
    expect(api.getProducts).toBeInstanceOf(Function);
    expect(searchProducts).toBeInstanceOf(Function);
    expect(api.getFeaturesWithVariants).toBeInstanceOf(Function);
  });

  it('searchProducts should filter products by name and code', async () => {
    // Mock getProducts to return a controlled list
    const mockProducts = [
      { product: 'Test Product', product_code: 'ABC123' },
      { product: 'Other', product_code: 'XYZ789' },
    ];
    // Spy on getProducts
    const getProductsSpy = vi.spyOn(api, 'getProducts').mockResolvedValue(mockProducts);
    const results = await searchProducts({ name: 'Test', code: 'ABC' });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);
    expect(results[0].product).toBe('Test Product');
    // Restore
    getProductsSpy.mockRestore();
  });

  // Example test for getProduct (integration, requires real API and valid productId)
  it('should fetch a product by ID', async () => {
    const product = await api.getProduct(1221);
    expect(product).toBeDefined();
    expect(product).toHaveProperty('product_id');
  });
});
