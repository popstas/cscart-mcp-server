# CS-Cart MCP Server

This MCP server provides integration with the CS-Cart API, allowing Model Context Protocol (MCP) clients to access product and order data from your CS-Cart store.

## Features
- `cscart_get_product` Fetch product by ID with full details
- `cscart_search_products` Search products by name or product code
- `cscart_get_products` List all products
- `cscart_get_features` Get product features and variants
- `cscart_get_order` Fetch order details by order ID

Uses CS-Cart REST API v2.0 ([API docs](https://docs.cs-cart.com/4.18.x/developer_guide/api/index.html))

## Configuration

### Environment Variables

Set these environment variables to configure the CS-Cart integration:

- `CSCART_SHOP_URL` – Base URL of your CS-Cart store (e.g., `https://shop.example.com`)
- `CSCART_EMAIL` – CS-Cart admin email (e.g., `admin@example.com`)
- `CSCART_API_KEY` – API key from CS-Cart admin panel
- `CSCART_CACHE_TIME` – Cache duration in seconds (e.g., `3600` for 1 hour)
- `CSCART_ADMIN_URL` – URL to access CS-Cart admin panel (e.g., `https://shop.example.com/admin.php`)
- `CSCART_PRODUCT_LINK_TEMPLATE` – Template for generating product links (e.g., `https://example.com/products/{id}`)
- `CSCART_TELEGRAM_FIELD` – Field ID for Telegram integration in CS-Cart (e.g., `2`)

### Logging

Logs are written to `data/mcp.log` in the server directory. The log directory will be created automatically if it doesn't exist.

## Debug
```
npx @modelcontextprotocol/inspector node ./dist/index.js
```

## Example MCP Config (NPX)
```json
{
  "mcpServers": {
    "cscart": {
      "command": "npx",
      "args": [
        "-y",
        "@popstas/cscart-mcp-server"
      ],
      "env": {
        "CSCART_SHOP_URL": "https://shop.example.com",
        "CSCART_EMAIL": "admin@example.com",
        "CSCART_API_KEY": "1234567890",
        "CSCART_CACHE_TIME": "3600",
        "CSCART_ADMIN_URL": "https://shop.example.com/admin.php",
        "CSCART_PRODUCT_LINK_TEMPLATE": "https://example.com/products/{id}",
        "CSCART_TELEGRAM_FIELD": "52"
      }
    }
  }
}
```

## Usage
Run the server with the required environment variables set. Example (with npx):
```sh
CSCART_SHOP_URL=https://shop.example.com \
CSCART_EMAIL=admin@example.com \
CSCART_API_KEY=1234567890 \
CSCART_CACHE_TIME=3600 \
CSCART_ADMIN_URL=https://shop.example.com/admin.php \
CSCART_PRODUCT_LINK_TEMPLATE="https://example.com/products/{id}" \
CSCART_TELEGRAM_FIELD=52 \
npx @popstas/cscart-mcp-server
```

## Available Tools

### `cscart_get_product`
Fetch a CS-Cart product by its ID. Returns product with all features and variants.

**Parameters:**
- `productId` (number, required): ID of the product to retrieve

### `cscart_search_products`
Search CS-Cart products by name and/or product code.

**Parameters:**
- `name` (string, optional): Product name to search for (partial match, case-insensitive)
- `code` (string, optional): Product code to search for (partial match, case-insensitive)

### `cscart_get_products`
Fetch all CS-Cart products.

**Parameters:** None

### `cscart_get_features`
Fetch all CS-Cart product features and their variants.

**Parameters:** None

### `cscart_get_order`
Fetch a CS-Cart order by its ID.

**Parameters:**
- `orderId` (number, required): ID of the order to retrieve

## References
- [CS-Cart API Documentation](https://docs.cs-cart.com/4.18.x/developer_guide/api/index.html)
- [Model Context Protocol](https://modelcontextprotocol.io)

---
MIT License
