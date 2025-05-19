#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Tool, ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import * as api from "./api.js";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.chdir(__dirname);
dotenv.config();

// log(`CSCART_SHOP_URL: ${process.env.CSCART_SHOP_URL}`)

function log(message: string) {
  // write to data/mcp.log, format [date time] message
  // const logPath = path.join(__dirname, 'data', 'mcp.log');
  const logPath = path.join('d:/projects/expertizeme/cscart-mcp-server/data', 'mcp.log');
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logPath, logMessage);
}

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

// --- Input Schemas ---
const GetProductInputSchema = z.object({
  productId: z.number().int().positive().describe("ID of the product to retrieve"),
});
const GetOrderInputSchema = z.object({
  orderId: z.number().int().positive().describe("ID of the order to retrieve"),
});
const GetProductsInputSchema = z.object({});
const GetFeaturesInputSchema = z.object({});

const SearchProductsInputSchema = z.object({
  name: z.string().optional().describe("Product name to search for"),
  code: z.string().optional().describe("Product code (product_code) to search for"),
});

const GET_PRODUCT_TOOL: Tool = {
  name: "cscart_get_product",
  description: "Fetch a CS-Cart product by its ID. CS-Cart is a shop. Returns product with all features and variants. Product fields in cscart located at `product_features`, key should match with parser field.",
  inputSchema: zodToJsonSchema(GetProductInputSchema) as ToolInput,
  func: api.getProduct,
};

const GET_PRODUCTS_TOOL: Tool = {
  name: "cscart_get_products",
  description: "Fetch all CS-Cart products.",
  inputSchema: zodToJsonSchema(GetProductsInputSchema) as ToolInput,
  func: api.getProducts,
};

const GET_FEATURES_TOOL: Tool = {
  name: "cscart_get_features",
  description: "Fetch all CS-Cart product features. Returns array of features with variants (if present). Feature is a product attribute.",
  inputSchema: zodToJsonSchema(GetFeaturesInputSchema) as ToolInput,
  func: api.getFeatures,
};

const SEARCH_PRODUCTS_TOOL: Tool = {
  name: "cscart_search_products",
  description: "Search CS-Cart products by name (product) and code (product_code). Returns array of products, without features. Use cscart_get_product to get full product data with features.",
  inputSchema: zodToJsonSchema(SearchProductsInputSchema) as ToolInput,
  func: searchProducts,
};

const GET_ORDER_TOOL: Tool = {
  name: "cscart_get_order",
  description: "Fetch a CS-Cart order by its ID. Returns the order object as provided by CS-Cart API.",
  inputSchema: zodToJsonSchema(GetOrderInputSchema) as ToolInput,
  func: api.getOrder,
};

const TOOLS: Tool[] = [GET_PRODUCT_TOOL, GET_PRODUCTS_TOOL, GET_FEATURES_TOOL, SEARCH_PRODUCTS_TOOL, GET_ORDER_TOOL];

export async function searchProducts({ name, code }: { name?: string | null; code?: string | null }): Promise<any[]> {
  const products = await api.getProducts();
  return products.filter(product => {
    let match = true;
    if (name && typeof name === 'string' && name.trim() !== '') {
      match = match && typeof product.product === 'string' && product.product.toLowerCase().includes(name.toLowerCase());
    }
    if (code && typeof code === 'string' && code.trim() !== '') {
      match = match && typeof product.product_code === 'string' && product.product_code.toLowerCase().includes(code.toLowerCase());
    }
    return match;
  });
}

async function getOrder({orderId}: {orderId: number}): Promise<string> {
  const order = await api.getOrder(orderId);
  const orderInfo = api.getOrderInfo(order);
  const message = api.getOrderMessage(orderInfo) || 'Не удалось получить данные заказа';
  return message;
}

const server = new Server(
  {
    name: "cscart-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

function getAnswerJson(data: any): { content: { type: string; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === GET_PRODUCT_TOOL.name) {
      const { productId } = GetProductInputSchema.parse(args);
      const product = await api.getProduct(productId);
      return getAnswerJson(product);
    }
    if (name === GET_ORDER_TOOL.name) {
      const { orderId } = GetOrderInputSchema.parse(args);
      const message = await getOrder({orderId});
      return getAnswerJson(message);
    }
    if (name === GET_PRODUCTS_TOOL.name) {
      const products = await api.getProducts();
      return getAnswerJson(products);
    }
    if (name === GET_FEATURES_TOOL.name) {
      const features = await api.getFeatures();
      return getAnswerJson(features);
    }
    if (name === SEARCH_PRODUCTS_TOOL.name) {
      const { name, code } = SearchProductsInputSchema.parse(args);
      const results = await searchProducts({ name, code });
      return getAnswerJson(results);
    }
    throw new Error(`Unknown tool name: ${name}`);
  } catch (error) {
    return {
      content: [
        { type: "text", text: `Error: ${(error as Error).message}` },
      ],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on("SIGINT", async () => {
    console.log("SIGINT received, shutting down CS-Cart server...");
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
