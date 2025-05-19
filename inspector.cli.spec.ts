import { execa } from 'execa';
import { describe, it, expect } from 'vitest';

const CLI_SCRIPT = 'npm';
const CLI_ARGS = ['-s', 'run', 'mcp-cli', '--'];

describe('MCP Inspector CLI', () => {
  it('should return a tools list via tools/list', async () => {
    const args = [...CLI_ARGS, '--method', 'tools/list'];
    const { stdout } = await execa(CLI_SCRIPT, args, { stdin: 'inherit' });
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty('tools');
    expect(Array.isArray(parsed.tools)).toBe(true);
  });

  it('should return items list via tools/call cscart_get_products', async () => {
    const args = [...CLI_ARGS, '--method', 'tools/call', '--tool-name', 'cscart_get_products'];
    const { stdout } = await execa(CLI_SCRIPT, args, { stdin: 'inherit' });
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty('content');
    expect(Array.isArray(parsed.content)).toBe(true);
  }, 20000);

  it('should search products by name=24SMI and return product_id[]', async () => {
    const args = [
      ...CLI_ARGS,
      '--method', 'tools/call',
      '--tool-name', 'cscart_search_products',
      '--tool-arg', 'name=24SMI'
    ];
    const { stdout } = await execa(CLI_SCRIPT, args, { stdin: 'inherit' });
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty('content');
    expect(Array.isArray(parsed.content)).toBe(true);
    // content[0].text is a JSON string array
    const products = JSON.parse(parsed.content[0].text);
    expect(Array.isArray(products)).toBe(true);
    products.forEach((p: any) => expect(p).toHaveProperty('product_id'));
  }, 20000);

  it('should get product by productId=1221 and return {product_features: {}[]}', async () => {
    const args = [
      ...CLI_ARGS,
      '--method', 'tools/call',
      '--tool-name', 'cscart_get_product',
      '--tool-arg', 'productId=1221'
    ];
    const { stdout } = await execa(CLI_SCRIPT, args, { stdin: 'inherit' });
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty('content');
    expect(Array.isArray(parsed.content)).toBe(true);
    // content[0].text is a JSON string object
    const product = JSON.parse(parsed.content[0].text);
    expect(product).toHaveProperty('product_features');
    expect(Array.isArray(product.product_features)).toBe(true);
    product.product_features.forEach((f: any) => expect(typeof f).toBe('object'));
  }, 20000);

  it('should get order by orderId=100 and return order object', async () => {
    const args = [
      ...CLI_ARGS,
      '--method', 'tools/call',
      '--tool-name', 'cscart_get_order',
      '--tool-arg', 'orderId=100'
    ];
    const { stdout } = await execa(CLI_SCRIPT, args, { stdin: 'inherit' });
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty('content');
    expect(Array.isArray(parsed.content)).toBe(true);
    // content[0].text is a JSON string object
    const orderText = parsed.content[0].text;
    expect(orderText).toContain('Заказ');
  });
});
