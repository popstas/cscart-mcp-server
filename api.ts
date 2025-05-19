import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

function getEnvVariable(varName: string): string {
  const value = process.env[varName];
  if (!value) {
    console.error(`Environment variable ${varName} is not set`);
    process.exit(1);
  }
  return value;
}

const SHOP_URL: string = getEnvVariable("CSCART_SHOP_URL");
const EMAIL: string = getEnvVariable("CSCART_EMAIL");
const API_KEY: string = getEnvVariable("CSCART_API_KEY");
const CACHE_TIME: number = Number(process.env["CSCART_CACHE_TIME"] ?? 3600);
const ADMIN_URL: string = getEnvVariable("CSCART_ADMIN_URL");
const PRODUCT_LINK_TEMPLATE: string = getEnvVariable("CSCART_PRODUCT_LINK_TEMPLATE");
const TELEGRAM_FIELD: string = getEnvVariable("CSCART_TELEGRAM_FIELD");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load features cache at startup
const FEATURES_CACHE_FILE = path.resolve(__dirname, "data/features.json");
let featuresCache: any[] | null = null;
let featuresCacheTimestamp: number | null = null;
loadFeaturesCache();

// Call loadProductsCache at startup
const PRODUCTS_CACHE_FILE = path.resolve(__dirname, "data/products.json");
let productsCache: any[] | null = null;
let productsCacheTimestamp: number | null = null;
loadProductsCache();


async function loadFeaturesCache() {
  try {
    const data = await fs.readFile(FEATURES_CACHE_FILE, "utf-8");
    const parsed = JSON.parse(data);
    featuresCache = parsed.featuresCache;
    featuresCacheTimestamp = parsed.featuresCacheTimestamp;
  } catch (err) {
    featuresCache = null;
    featuresCacheTimestamp = null;
  }
}

async function saveFeaturesCache() {
  try {
    await fs.mkdir(path.dirname(FEATURES_CACHE_FILE), { recursive: true });
    await fs.writeFile(
      FEATURES_CACHE_FILE,
      JSON.stringify({ featuresCache, featuresCacheTimestamp }, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("Failed to save features cache:", err);
  }
}

const featureVariantsCache: Map<string, any> = new Map();
const FEATURE_VARIANTS_DIR = path.resolve(__dirname, "data/feature");

/**
 * For each feature, request GET /features/:id (with persistent caching), attach variants field if present.
 * @param features Array of features
 * @returns Array of features with variants field (if present)
 */
async function getFeaturesWithVariants(features: any[]): Promise<any[]> {
  const token = Buffer.from(`${EMAIL}:${API_KEY}`).toString("base64");
  const baseUrl = `${SHOP_URL}/api/2.0`;
  // Map over features, enriching with variants if available
  const enriched = await Promise.all(features.map(async (feature) => {
    const id = feature.feature_id;
    feature.variants = ['empty'];
    if (!id) return feature;
    // Try in-memory cache first
    if (featureVariantsCache.has(id)) {
      return { ...feature, variants: featureVariantsCache.get(id)?.variants };
    }
    // Try persistent cache
    const cacheFile = path.join(FEATURE_VARIANTS_DIR, `${id}.json`);
    try {
      // Try to read from file
      const dataStr = await fs.readFile(cacheFile, "utf-8");
      const featureObj = JSON.parse(dataStr);
      featureVariantsCache.set(id, featureObj.variants);
      return { ...feature, variants: featureObj.variants };
    } catch (err) {
      // File does not exist or read error, continue to fetch
    }
    // Fetch from API
    try {
      const endpoint = `${baseUrl}/features/${id}`;
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Basic ${token}`,
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        // Could not fetch, just return as is
        return { ...feature, variants: ['error'] };
      }
      const data = await response.json() as { variants: any[] };
      // Cache the variants field (always as array)
      const variantsArr = Array.isArray(data?.variants) ? data.variants : [];
      const variantsObj = { variants: variantsArr };
      featureVariantsCache.set(id, variantsObj);
      // Write to persistent cache
      try {
        await fs.mkdir(FEATURE_VARIANTS_DIR, { recursive: true });
        await fs.writeFile(cacheFile, JSON.stringify(data, null, 2), "utf-8");
      } catch (err) {
        // Ignore write errors
      }
      return { ...feature, variants: variantsObj };
    } catch (err) {
      // On error, just return feature with empty variants
      return { ...feature, variants: ['error'] };
    }
  }));
  return enriched;
}

async function getFeatures(): Promise<any[]> {
  const now = Math.floor(Date.now() / 1000);
  let allFeatures: any[] = [];
  if (featuresCache && featuresCacheTimestamp && now - featuresCacheTimestamp < CACHE_TIME) {
    allFeatures = featuresCache;
  }
  else {
    const token = Buffer.from(`${EMAIL}:${API_KEY}`).toString("base64");
    const baseUrl = `${SHOP_URL}/api/2.0`;
    let page = 1;
    const perPage = 250;
    while (true) {
      const endpoint = `${baseUrl}/features?items_per_page=${perPage}&page=${page}`;
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Basic ${token}`,
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch features page ${page}: ${response.status} ${response.statusText}`);
      }
      const data = await response.json() as { features: any[] };
      const featuresOnPage = data.features || [];
      if (featuresOnPage.length === 0) break;
      allFeatures.push(...featuresOnPage);
      if (featuresOnPage.length < perPage) break;
      page++;
    }
  }

  allFeatures = await getFeaturesWithVariants(allFeatures);
  featuresCache = allFeatures;
  featuresCacheTimestamp = now;
  await saveFeaturesCache();
  return allFeatures;
}

async function getProduct(productId: number): Promise<any> {
  const token = Buffer.from(`${EMAIL}:${API_KEY}`).toString("base64");
  const baseUrl = `${SHOP_URL}/api/2.0`;

  // Параллельно запрашиваем базовый объект и вложенные характеристики
  const [prodRes, featRes] = await Promise.all([
    fetch(`${baseUrl}/products/${productId}`, {
      headers: {
        Authorization: `Basic ${token}`,
        Accept: "application/json",
      },
    }),
    fetch(`${baseUrl}/products/${productId}/features?items_per_page=250`, {
      headers: {
        Authorization: `Basic ${token}`,
        Accept: "application/json",
      },
    }),
  ]);

  if (!prodRes.ok) throw new Error(`Ошибка получения товара ${productId}: ${prodRes.status}`);
  if (!featRes.ok) throw new Error(`Ошибка получения характеристик для товара ${productId}: ${featRes.status}`);

  const prodData = await prodRes.json() as any;
  const featData = await featRes.json() as any;
  const product = prodData;
  const features = featData.features || [];

  // Получаем кэш всех features для поиска variant name
  const allFeatures = await getFeatures();
  // Индексируем по feature_id
  const featuresById: Record<string, any> = {};
  for (const f of allFeatures) {
    featuresById[f.feature_id] = f;
  }

  const productFeatures = features.map((feature: any) => {
    let value = feature.value;

    // Если в фичах продукта есть variants, значит это множественная фича
    if (feature.feature_type === 'M' && feature.variants && feature.use_variant_picker) {
      value = Object.values(feature.variants).map((variant: any) => variant.variant);
    }

    if (feature.feature_type === 'N') {
      value = Number(feature.value_int);
    }

    // Если есть variants и variant_id, ищем имя варианта
    else if (feature.variant_id && featuresById[`${feature.feature_id}`]) {
      const variants = featuresById[`${feature.feature_id}`].variants || [];
      const foundVariant = variants[`${feature.variant_id}`];
      if (foundVariant && foundVariant.variant) {
        value = foundVariant.variant;
      }
    }
    return {
      [feature.description]: value,
    }
  });

  return {  
    ...product,
    product_features: productFeatures,
  };
}

// Load cache from file at startup
async function loadProductsCache() {
  try {
    const data = await fs.readFile(PRODUCTS_CACHE_FILE, "utf-8");
    const parsed = JSON.parse(data);
    productsCache = parsed.productsCache;
    productsCacheTimestamp = parsed.productsCacheTimestamp;
  } catch (err) {
    productsCache = null;
    productsCacheTimestamp = null;
  }
}

// Save cache to file
async function saveProductsCache() {
  try {
    await fs.mkdir(path.dirname(PRODUCTS_CACHE_FILE), { recursive: true });
    await fs.writeFile(
      PRODUCTS_CACHE_FILE,
      JSON.stringify({ productsCache, productsCacheTimestamp }, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("Failed to save products cache:", err);
  }
}

async function getProducts(): Promise<any[]> {
  const now = Math.floor(Date.now() / 1000);
  let allProducts: any[] = [];
  if (productsCache && productsCacheTimestamp && now - productsCacheTimestamp < CACHE_TIME) {
    allProducts = productsCache;
  } else {
    const token = Buffer.from(`${EMAIL}:${API_KEY}`).toString("base64");
    const perPage = 250;
    let page = 1;
    while (true) {
      const endpoint = `${SHOP_URL}/api/2.0/products?items_per_page=${perPage}&page=${page}`;
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Authorization: `Basic ${token}`,
            Accept: "application/json",
          },
        });
      } catch (error) {
        throw new Error(`Network error fetching products page ${page}: ${(error as Error).message}`);
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch products page ${page}: ${response.status} ${response.statusText}`);
      }
      const data = (await response.json()) as { products: Record<string, any> };
      const productsOnPage = Object.values(data.products);
      if (productsOnPage.length === 0) {
        break;
      }
      allProducts.push(...productsOnPage);
      if (productsOnPage.length < perPage) {
        break;
      }
      page += 1;
    }
    productsCache = allProducts;
    productsCacheTimestamp = now;
    await saveProductsCache();
  }

  productsCache = allProducts.map(product => ({
    product_id: product.product_id,
    product: product.product,
    timestamp: product.timestamp,
    updated_timestamp: product.updated_timestamp,
    price: product.price,
    seo_name: product.seo_name,
  }));

  return allProducts;
}

async function getOrder(orderId: number): Promise<any> {
  const token = Buffer.from(`${EMAIL}:${API_KEY}`).toString("base64");
  const baseUrl = `${SHOP_URL}/api/2.0`;
  const url = `${baseUrl}/orders/${orderId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${token}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch order ${orderId}: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

function getOrderInfo(order: any) {
  if (!order) return null;
  // console.log(`order: ${JSON.stringify(order)}`);
  const order_id = order.order_id;
  const total = order.total;
  const phone = order.phone || order.payment_info?.customer_phone || '';
  const email = order.email || '';
  const telegram = TELEGRAM_FIELD ? order.fields[TELEGRAM_FIELD] || '' : '';
  const name = `${order.firstname} ${order.lastname}`;
  const company = order.company || '';
  const notes = order.notes || '';
  const order_url = `${ADMIN_URL}?dispatch=orders.details&order_id=${order_id}`;
  const payment_method = order.payment_method?.payment || '';
  const products = order.products
    ? Object.values(order.products).map((p: any) => ({
        product_id: p.product_id,
        product_code: p.product_code,
        subtotal: p.subtotal,
        product: p.product,
        amount: p.amount,
        base_price: p.base_price,
      })).map((p) => {
        const productExternalId = p.product_code.replace('px-', '');
        const productLink = PRODUCT_LINK_TEMPLATE.replace('{id}', productExternalId);
        return [
          `- ${p.subtotal} USD`,
          (p.amount > 1 ? ` (${p.base_price} x ${p.amount})` : ''),
          ` - <a href="${productLink}">${p.product}</a>`,
        ].join('');
      }).join('\n')
    : '';
  return {
    order_id,
    total,
    name,
    phone,
    email,
    telegram,
    company,
    order_url,
    notes,
    payment_method,
    products,
  };
}

function getOrderMessage(info: any) {
  return `Заказ № ${info.order_id}  
Сумма: ${info.total}  
Способ оплаты: ${info.payment_method}
Ссылка на заказ: ${info.order_url}

Клиент:
- Имя: ${info.name}
- Телефон: ${info.phone}
- Email: ${info.email}
- Telegram: ${info.telegram}
- Компания: ${info.company}

Примечания к заказу:
${info.notes}

Товары:
${info.products}`;
}

export {
  getProduct,
  getProducts,
  getFeatures,
  getFeaturesWithVariants,
  getOrder,
  getOrderInfo,
  getOrderMessage,
};