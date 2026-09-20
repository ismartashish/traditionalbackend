import axios from "axios";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

import {
  searchProductsForChatbot,
} from "./productSearchService.js";

/* =========================================================
   GENERAL HELPERS
========================================================= */

const normalize = (text = "") => {
  return text.trim().toLowerCase();
};

const formatMoney = (value = 0) => {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
};

const escapeRegex = (value = "") => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/* =========================================================
   STOP WORDS
========================================================= */

const STOP_WORDS = new Set([
  "show",
  "me",
  "give",
  "find",
  "search",
  "looking",
  "for",
  "please",
  "some",
  "any",
  "the",
  "a",
  "an",
  "products",
  "product",
  "items",
  "item",
  "available",
  "have",
  "you",
  "do",
  "does",
  "there",
  "is",
  "are",
  "with",
  "from",
  "under",
  "below",
  "above",
  "over",
  "less",
  "than",
  "more",
  "between",
  "best",
  "top",
  "cheapest",
  "expensive",
  "highest",
  "lowest",
  "rated",
  "rating",
  "stock",
  "in",
  "of",
  "on",
  "for",
  "me",
]);

/* =========================================================
   GREETINGS / GENERIC
========================================================= */

const isGreeting = (text) =>
  /^(hi|hii|hello|hey|hey there|namaste|good morning|good afternoon|good evening)\b/i.test(
    text
  );

const isThanks = (text) =>
  /^(thanks|thank you|thx|thanku|thankyou)\b/i.test(text);

const isHelp = (text) =>
  /^(help|what can you do|what can i ask|how can you help)/i.test(
    text
  );

/* =========================================================
   PERSONAL INTENTS
========================================================= */

const isNameQuestion = (text) =>
  /my name|what is my name|what's my name|who am i/i.test(
    text
  );

const isEmailQuestion = (text) =>
  /my email|email address|registered email|what is my email|what's my email/i.test(
    text
  );

const isProfileQuestion = (text) =>
  /my profile|profile details|my account|account details/i.test(
    text
  );

/* =========================================================
   ORDER INTENTS
========================================================= */

const isOrderCountQuestion = (text) =>
  /how many orders|number of orders|orders have i placed|orders did i place/i.test(
    text
  );

const isBoughtItemsQuestion = (text) =>
  /how many items.*bought|how many products.*bought|items.*purchased|products.*purchased|what have i bought|what did i buy/i.test(
    text
  );

const isSpentQuestion = (text) =>
  /how much.*spent|how much.*spend|total.*spent|total.*purchase/i.test(
    text
  );

const isMyOrdersQuestion = (text) =>
  /my orders|show orders|order history|purchase history|orders history/i.test(
    text
  );

const isLatestOrderQuestion = (text) =>
  /latest order|recent order|last order/i.test(text);

const isOrderStatusQuestion = (text) =>
  /order status|status of my order|where is my order|where's my order|track my order|track.*order/i.test(
    text
  );

const isCancelOrderQuestion = (text) =>
  /cancel.*order|cancel.*purchase/i.test(text);

/* =========================================================
   PRODUCT INTENTS
========================================================= */

const isProductCountQuestion = (text) =>
  /how many products|number of products|how many items.*available|how many products.*have/i.test(
    text
  );

const isCompareQuestion = (text) =>
  /compare|comparison|difference between|which is better between/i.test(
    text
  );

const isReviewQuestion = (text) =>
  /reviews|review|what are people saying|customer feedback|ratings/i.test(
    text
  );

const isProductDetailQuestion = (text) =>
  /tell me about|details of|details about|information about|info about|more about/i.test(
    text
  );

const isRecommendationQuestion = (text) =>
  /recommend|recommendation|suggest|suggestion|what should i buy|which should i buy|something for|looking for something/i.test(
    text
  );

/* =========================================================
   PRICE EXTRACTION
========================================================= */

const extractPrices = (message) => {
  const text = message.toLowerCase();

  let minPrice;
  let maxPrice;

  const rangeMatch = text.match(
    /(?:between|from)\s*[₹rs.]?\s*(\d+)\s*(?:and|to|-)\s*[₹rs.]?\s*(\d+)/i
  );

  if (rangeMatch) {
    minPrice = Number(rangeMatch[1]);
    maxPrice = Number(rangeMatch[2]);
  }

  const underMatch = text.match(
    /(?:under|below|less than|max(?:imum)?|upto|up to)\s*[₹rs.]?\s*(\d+)/i
  );

  if (underMatch) {
    maxPrice = Number(underMatch[1]);
  }

  const aboveMatch = text.match(
    /(?:above|over|more than|min(?:imum)?)\s*[₹rs.]?\s*(\d+)/i
  );

  if (aboveMatch) {
    minPrice = Number(aboveMatch[1]);
  }

  return {
    minPrice,
    maxPrice,
  };
};

/* =========================================================
   RATING EXTRACTION
========================================================= */

const extractRating = (message) => {
  const match = message.match(
    /(?:rating|rated)\s*(?:above|over|at least|minimum)?\s*(\d(?:\.\d)?)/i
  );

  if (!match) {
    return undefined;
  }

  return Number(match[1]);
};

/* =========================================================
   STATE EXTRACTION
========================================================= */

const STATES = [
  "Rajasthan",
  "Bihar",
  "Uttar Pradesh",
  "West Bengal",
  "Madhya Pradesh",
  "Gujarat",
  "Maharashtra",
  "Kashmir",
  "Punjab",
  "Kerala",
  "Tamil Nadu",
  "Karnataka",
  "Odisha",
  "Assam",
];

const extractState = (message) => {
  const lower = message.toLowerCase();

  const aliases = {
    rajasthan: "Rajasthan",
    rajasthani: "Rajasthan",

    bihar: "Bihar",
    bihari: "Bihar",

    "uttar pradesh": "Uttar Pradesh",
    banaras: "Uttar Pradesh",
    banarasi: "Uttar Pradesh",

    "west bengal": "West Bengal",
    bengal: "West Bengal",

    "madhya pradesh": "Madhya Pradesh",

    gujarat: "Gujarat",
    gujarati: "Gujarat",

    maharashtra: "Maharashtra",
    maharashtrian: "Maharashtra",

    kashmir: "Kashmir",
    kashmiri: "Kashmir",

    punjab: "Punjab",
    punjabi: "Punjab",

    kerala: "Kerala",
    kerala: "Kerala",

    "tamil nadu": "Tamil Nadu",

    karnataka: "Karnataka",
    kannada: "Karnataka",

    odisha: "Odisha",
    assam: "Assam",
  };

  for (const [key, value] of Object.entries(aliases)) {
    if (lower.includes(key)) {
      return value;
    }
  }

  for (const state of STATES) {
    if (lower.includes(state.toLowerCase())) {
      return state;
    }
  }

  return undefined;
};

/* =========================================================
   CATEGORY EXTRACTION
========================================================= */

const CATEGORY_ALIASES = [
  {
    value: "Clothing",
    words: [
      "clothing",
      "cloth",
      "saree",
      "sari",
      "kurta",
      "dress",
      "apparel",
    ],
  },
  {
    value: "Handicraft",
    words: [
      "handicraft",
      "handicrafts",
      "handmade",
      "craft",
      "pottery",
    ],
  },
  {
    value: "Painting",
    words: [
      "painting",
      "paintings",
      "art",
      "madhubani",
    ],
  },
  {
    value: "Footwear",
    words: [
      "footwear",
      "shoes",
      "shoe",
      "mojari",
      "sandals",
    ],
  },
];

const extractCategory = (message) => {
  const lower = message.toLowerCase();

  for (const category of CATEGORY_ALIASES) {
    if (
      category.words.some((word) => lower.includes(word))
    ) {
      return category.value;
    }
  }

  return undefined;
};

/* =========================================================
   SORT EXTRACTION
========================================================= */

const extractSort = (message) => {
  const text = message.toLowerCase();

  if (
    /cheapest|lowest price|low to high|least expensive/i.test(
      text
    )
  ) {
    return "price_low";
  }

  if (
    /most expensive|highest price|high to low|costliest/i.test(
      text
    )
  ) {
    return "price_high";
  }

  if (
    /highest rated|best rated|top rated|best rating/i.test(
      text
    )
  ) {
    return "rating";
  }

  if (
    /most reviewed|popular|most popular|most reviews/i.test(
      text
    )
  ) {
    return "reviews";
  }

  if (
    /newest|latest products|new arrivals|recent products/i.test(
      text
    )
  ) {
    return "newest";
  }

  if (/oldest/i.test(text)) {
    return "oldest";
  }

  return undefined;
};

/* =========================================================
   STOCK EXTRACTION
========================================================= */

const extractStock = (message) => {
  const text = message.toLowerCase();

  if (
    /out of stock|not available|unavailable/i.test(text)
  ) {
    return {
      outOfStock: true,
    };
  }

  if (
    /in stock|available|currently available/i.test(text)
  ) {
    return {
      inStock: true,
    };
  }

  return {};
};

/* =========================================================
   KEYWORD EXTRACTION
========================================================= */

const extractKeyword = (message) => {
  const cleaned = message
    .toLowerCase()
    .replace(/[₹,!?]/g, " ")
    .replace(/\d+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const keywords = cleaned.filter(
    (word) =>
      word.length > 2 &&
      !STOP_WORDS.has(word) &&
      ![
        "rajasthan",
        "rajasthani",
        "bihar",
        "bihari",
        "clothing",
        "cloth",
        "handicraft",
        "handmade",
        "painting",
        "paintings",
        "footwear",
        "available",
        "stock",
        "rating",
        "under",
        "below",
        "above",
        "between",
      ].includes(word)
  );

  return keywords.join(" ").trim();
};

/* =========================================================
   PRODUCT QUERY PARSER
========================================================= */

const buildProductQuery = (message) => {
  const prices = extractPrices(message);
  const rating = extractRating(message);
  const state = extractState(message);
  const category = extractCategory(message);
  const sortBy =
    extractSort(message) || "rating";

  const stock = extractStock(message);

  const keyword = extractKeyword(message);

  return {
    keyword: keyword || undefined,
    minPrice: prices.minPrice,
    maxPrice: prices.maxPrice,
    minRating: rating,
    state,
    category,
    sortBy,
    inStock: stock.inStock,
    outOfStock: stock.outOfStock,
    limit: 10,
  };
};

/* =========================================================
   PRODUCT FORMAT
========================================================= */

const formatProducts = (products) => {
  return products.map((product) => ({
    id: product._id.toString(),
    title: product.title,
    price: product.price,
    images: product.images || [],
    category: product.category,
    state: product.state,
    stock: product.stock,
    rating: product.rating,
    numReviews: product.numReviews,
  }));
};

/* =========================================================
   USER ORDER HELPERS
========================================================= */

const getUserOrders = async (user) => {
  if (!user?._id) {
    return [];
  }

  return Order.find({
    user: user._id,
  })
    .populate("items.product", "title price category state images")
    .sort({ createdAt: -1 })
    .lean();
};

/* =========================================================
   ORDER COUNT
========================================================= */

const handleOrderCount = async (user) => {
  if (!user?._id) {
    return {
      reply:
        "Please log in first so I can check your order history 🔐",
      products: [],
    };
  }

  const orders = await Order.find({
    user: user._id,
    status: { $ne: "Cancelled" },
  }).lean();

  return {
    reply: `You have placed ${orders.length} order${
      orders.length === 1 ? "" : "s"
    } that haven't been cancelled. 📦`,
    products: [],
  };
};

/* =========================================================
   ITEMS BOUGHT
========================================================= */

const handleBoughtItems = async (user) => {
  if (!user?._id) {
    return {
      reply:
        "Please log in first so I can check what you've bought 🔐",
      products: [],
    };
  }

  const orders = await Order.find({
    user: user._id,
    status: { $ne: "Cancelled" },
  })
    .populate("items.product", "title")
    .lean();

  let totalItems = 0;

  const purchased = {};

  for (const order of orders) {
    for (const item of order.items || []) {
      const quantity = Number(item.quantity || 0);

      totalItems += quantity;

      const title =
        item.product?.title || "Unknown product";

      purchased[title] =
        (purchased[title] || 0) + quantity;
    }
  }

  const names = Object.entries(purchased)
    .sort((a, b) => b[1] - a[1])
    .map(([name, qty]) => `${name} × ${qty}`)
    .slice(0, 10);

  if (!totalItems) {
    return {
      reply:
        "I couldn't find any purchased items on your account yet. 🛍️",
      products: [],
    };
  }

  return {
    reply:
      `You've bought ${totalItems} item${
        totalItems === 1 ? "" : "s"
      } across your orders.\n\n` +
      names.join("\n"),
    products: [],
  };
};

/* =========================================================
   TOTAL SPENT
========================================================= */

const handleSpent = async (user) => {
  if (!user?._id) {
    return {
      reply:
        "Please log in first so I can calculate your purchases 🔐",
      products: [],
    };
  }

  const orders = await Order.find({
    user: user._id,
    status: { $ne: "Cancelled" },
  }).lean();

  const total = orders.reduce(
    (sum, order) =>
      sum + Number(order.totalAmount || 0),
    0
  );

  return {
    reply: `You've spent ${formatMoney(
      total
    )} across ${orders.length} order${
      orders.length === 1 ? "" : "s"
    }. 💳`,
    products: [],
  };
};

/* =========================================================
   LIST ORDERS
========================================================= */

const handleMyOrders = async (user) => {
  if (!user?._id) {
    return {
      reply:
        "Please log in first to view your orders 🔐",
      products: [],
    };
  }

  const orders = await getUserOrders(user);

  if (!orders.length) {
    return {
      reply: "You don't have any orders yet. 📦",
      products: [],
    };
  }

  const lines = orders.slice(0, 10).map((order, index) => {
    const itemCount = (order.items || []).reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0),
      0
    );

    const names = (order.items || [])
      .map((item) => item.product?.title)
      .filter(Boolean)
      .slice(0, 2)
      .join(", ");

    return `${index + 1}. ${names || "Order"} — ${
      itemCount
    } item${itemCount === 1 ? "" : "s"} — ${
      order.status
    } — ${formatMoney(order.totalAmount)}`;
  });

  return {
    reply:
      `Here are your recent orders:\n\n` +
      lines.join("\n"),
    products: [],
  };
};

/* =========================================================
   LATEST ORDER
========================================================= */

const handleLatestOrder = async (user) => {
  if (!user?._id) {
    return {
      reply:
        "Please log in first so I can check your latest order 🔐",
      products: [],
    };
  }

  const orders = await getUserOrders(user);

  if (!orders.length) {
    return {
      reply: "You don't have any orders yet. 📦",
      products: [],
    };
  }

  const order = orders[0];

  const itemNames = (order.items || [])
    .map((item) => item.product?.title)
    .filter(Boolean)
    .slice(0, 5);

  const count = (order.items || []).reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0),
    0
  );

  return {
    reply:
      `Your latest order is "${order.status}".\n\n` +
      `Items: ${count}\n` +
      `Products: ${
        itemNames.join(", ") || "Not available"
      }\n` +
      `Total: ${formatMoney(order.totalAmount)}`,
    products: [],
    order: {
      id: order._id,
      status: order.status,
      totalAmount: order.totalAmount,
    },
  };
};

/* =========================================================
   ORDER STATUS
========================================================= */

const handleOrderStatus = async (user) => {
  if (!user?._id) {
    return {
      reply:
        "Please log in first so I can track your order 🔐",
      products: [],
    };
  }

  const orders = await getUserOrders(user);

  if (!orders.length) {
    return {
      reply: "I couldn't find any orders on your account.",
      products: [],
    };
  }

  const order = orders[0];

  return {
    reply:
      `Your latest order status is "${order.status}". 📦\n\n` +
      `Total: ${formatMoney(order.totalAmount)}`,
    products: [],
  };
};

/* =========================================================
   CANCEL ORDER
========================================================= */

const findCancellableOrder = async (user, message) => {
  if (!user?._id) {
    return null;
  }

  const orders = await Order.find({
    user: user._id,
    status: {
      $nin: ["Delivered", "Cancelled"],
    },
  })
    .populate("items.product", "title price")
    .sort({ createdAt: -1 })
    .lean();

  if (!orders.length) {
    return null;
  }

  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 2 &&
        ![
          "cancel",
          "order",
          "purchase",
          "please",
          "my",
          "the",
        ].includes(word)
    );

  if (words.length) {
    for (const order of orders) {
      for (const item of order.items || []) {
        const title =
          item.product?.title?.toLowerCase() || "";

        if (
          words.some((word) =>
            title.includes(word)
          )
        ) {
          return order;
        }
      }
    }
  }

  return orders[0];
};

/* =========================================================
   PRODUCT REVIEWS
========================================================= */

const handleProductReviews = async (message) => {
  const keyword = extractKeyword(message);

  const product = await Product.findOne({
    $or: [
      {
        title: new RegExp(
          escapeRegex(keyword),
          "i"
        ),
      },
      {
        category: new RegExp(
          escapeRegex(keyword),
          "i"
        ),
      },
    ],
  }).lean();

  if (!product) {
    return {
      reply:
        "I couldn't identify which product you want reviews for.",
      products: [],
    };
  }

  const reviews = (product.reviews || [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    )
    .slice(0, 5);

  if (!reviews.length) {
    return {
      reply:
        `${product.title} currently has no written reviews.`,
      products: formatProducts([product]),
    };
  }

  const reviewText = reviews
    .map(
      (review) =>
        `⭐ ${review.rating}/5 — ${
          review.comment
        }`
    )
    .join("\n");

  return {
    reply:
      `${product.title} has an average rating of ${
        product.rating || 0
      }/5.\n\nRecent reviews:\n${reviewText}`,
    products: formatProducts([product]),
  };
};

/* =========================================================
   COMPARE PRODUCTS
========================================================= */

const handleCompare = async (message) => {
  const cleaned = message
    .replace(/compare/gi, "")
    .replace(/difference between/gi, "")
    .replace(/which is better/gi, "")
    .trim();

  const parts = cleaned
    .split(/\s+(?:and|vs\.?|versus)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return {
      reply:
        "Tell me the two product names you want to compare. Example: Compare Saree and Mojari.",
      products: [],
    };
  }

  const products = [];

  for (const part of parts.slice(0, 3)) {
    const product = await Product.findOne({
      title: new RegExp(
        escapeRegex(part),
        "i"
      ),
    }).lean();

    if (product) {
      products.push(product);
    }
  }

  if (products.length < 2) {
    return {
      reply:
        "I couldn't find both products in the catalog.",
      products: formatProducts(products),
    };
  }

  const lines = products.map(
    (product) =>
      `${product.title}: ${formatMoney(
        product.price
      )}, rating ${product.rating || 0}/5, stock ${
        product.stock || 0
      }`
  );

  return {
    reply:
      `Here's the comparison:\n\n` +
      lines.join("\n"),
    products: formatProducts(products),
  };
};

/* =========================================================
   GENERIC PRODUCT SEARCH
========================================================= */

const handleProductSearch = async (message) => {
  const query = buildProductQuery(message);

  let products =
    await searchProductsForChatbot(query);

  /*
    If nothing was found and the user asked a
    general recommendation, search the top catalog
    instead of immediately saying "nothing found".
  */

  if (!products.length && isRecommendationQuestion(message)) {
    products = await searchProductsForChatbot({
      sortBy: "rating",
      inStock: true,
      limit: 10,
    });
  }

  if (!products.length) {
    return {
      reply:
        "I couldn't find matching products. Try another category, price range, state, or product name.",
      products: [],
    };
  }

  const formatted = formatProducts(products);

  return {
    reply:
      `I found ${formatted.length} product${
        formatted.length === 1 ? "" : "s"
      } for you 😊`,
    products: formatted,
    query,
  };
};

/* =========================================================
   PRODUCT COUNT
========================================================= */

const handleProductCount = async () => {
  const count = await Product.countDocuments();

  return {
    reply: `We currently have ${count} product${
      count === 1 ? "" : "s"
    } in the catalog. 🛍️`,
    products: [],
  };
};

/* =========================================================
   AI GENERAL / PRODUCT RESPONSE
========================================================= */

const generateAIReply = async ({
  userMessage,
  products = [],
  user = null,
}) => {
  if (!process.env.HUGGINGFACE_API_KEY) {
    return null;
  }

  const productContext = products.length
    ? products
        .map(
          (product, index) =>
            `${index + 1}. ${product.title} | ₹${
              product.price
            } | ${product.category} | ${
              product.state
            } | stock ${
              product.stock
            } | rating ${product.rating}`
        )
        .join("\n")
    : "No product data.";

  try {
    const response = await axios.post(
      "https://router.huggingface.co/v1/chat/completions",
      {
        model: "openai/gpt-oss-20b:fastest",
        messages: [
          {
            role: "system",
            content: `
You are Bharat Assistant for an Indian traditional ecommerce store.

You answer naturally and briefly.

Never invent product information.
Never invent account information.
Never invent order information.

The database result supplied by the application is authoritative.
            `.trim(),
          },
          {
            role: "user",
            content: `
User:
${userMessage}

User name:
${user?.name || "Guest"}

Relevant products:
${productContext}

Respond naturally.
            `.trim(),
          },
        ],
        max_tokens: 250,
        temperature: 0.4,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    return (
      response.data?.choices?.[0]?.message?.content?.trim() ||
      null
    );
  } catch (error) {
    console.error(
      "AI RESPONSE ERROR:",
      error.response?.data || error.message
    );

    return null;
  }
};

/* =========================================================
   MAIN FUNCTION
========================================================= */

export const processChatMessage = async (
  message,
  user = null
) => {
  try {
    const text = normalize(message);

    if (!text) {
      return {
        reply: "Please type something 😊",
        products: [],
      };
    }

    /* ================================================
       GREETING
    ================================================ */

    if (isGreeting(text)) {
      return {
        reply: user?.name
          ? `Hi ${user.name} 👋 How can I help you today?`
          : "Hi 👋 How can I help you today?",
        products: [],
      };
    }

    /* ================================================
       THANKS
    ================================================ */

    if (isThanks(text)) {
      return {
        reply:
          "You're welcome! 😊 I'm here whenever you need me.",
        products: [],
      };
    }

    /* ================================================
       HELP
    ================================================ */

    if (isHelp(text)) {
      return {
        reply:
          "You can ask me about products, prices, ratings, stock, categories, states, recommendations, product reviews, your profile, orders, spending, purchased items, order status, and order cancellation.",
        products: [],
      };
    }

    /* ================================================
       NAME
    ================================================ */

    if (isNameQuestion(text)) {
      if (!user) {
        return {
          reply:
            "Please log in first so I can access your account.",
          products: [],
        };
      }

      return {
        reply: `Your account name is ${
          user.name || "not available"
        }. 😊`,
        products: [],
      };
    }

    /* ================================================
       EMAIL
    ================================================ */

    if (isEmailQuestion(text)) {
      if (!user) {
        return {
          reply:
            "Please log in first so I can access your account.",
          products: [],
        };
      }

      return {
        reply:
          `Your registered email is ${
            user.email || "not available"
          }. 📧`,
        products: [],
      };
    }

    /* ================================================
       PROFILE
    ================================================ */

    if (isProfileQuestion(text)) {
      if (!user) {
        return {
          reply:
            "Please log in first so I can access your profile.",
          products: [],
        };
      }

      return {
        reply:
          `Your profile:\n\n` +
          `Name: ${
            user.name || "Not available"
          }\n` +
          `Email: ${
            user.email || "Not available"
          }\n` +
          `Role: ${
            user.role || "buyer"
          }`,
        products: [],
      };
    }

    /* ================================================
       ORDER COUNT
    ================================================ */

    if (isOrderCountQuestion(text)) {
      return handleOrderCount(user);
    }

    /* ================================================
       BOUGHT ITEMS
    ================================================ */

    if (isBoughtItemsQuestion(text)) {
      return handleBoughtItems(user);
    }

    /* ================================================
       TOTAL SPENT
    ================================================ */

    if (isSpentQuestion(text)) {
      return handleSpent(user);
    }

    /* ================================================
       CANCEL ORDER
    ================================================ */

    if (isCancelOrderQuestion(text)) {
      if (!user) {
        return {
          reply:
            "Please log in first so I can cancel an order.",
          products: [],
        };
      }

      const order =
        await findCancellableOrder(user, text);

      if (!order) {
        return {
          reply:
            "I couldn't find a cancellable order on your account.",
          products: [],
        };
      }

      const names = (order.items || [])
        .map((item) => item.product?.title)
        .filter(Boolean);

      return {
        reply:
          `I found your order containing ${
            names.join(", ") || "your items"
          }.\n\n` +
          `Status: ${order.status}\n` +
          `Total: ${formatMoney(
            order.totalAmount
          )}\n\n` +
          `Do you want to cancel it? Reply "yes" to confirm.`,
        products: [],
        action: {
          type: "CANCEL_ORDER_CONFIRM",
          orderId: order._id.toString(),
        },
      };
    }

    /* ================================================
       MY ORDERS
    ================================================ */

    if (isMyOrdersQuestion(text)) {
      return handleMyOrders(user);
    }

    /* ================================================
       LATEST ORDER
    ================================================ */

    if (isLatestOrderQuestion(text)) {
      return handleLatestOrder(user);
    }

    /* ================================================
       ORDER STATUS
    ================================================ */

    if (isOrderStatusQuestion(text)) {
      return handleOrderStatus(user);
    }

    /* ================================================
       PRODUCT COUNT
    ================================================ */

    if (isProductCountQuestion(text)) {
      return handleProductCount();
    }

    /* ================================================
       COMPARE
    ================================================ */

    if (isCompareQuestion(text)) {
      return handleCompare(message);
    }

    /* ================================================
       REVIEWS
    ================================================ */

    if (isReviewQuestion(text)) {
      return handleProductReviews(message);
    }

    /* ================================================
       PRODUCT DETAILS
    ================================================ */

    if (isProductDetailQuestion(text)) {
      const result = await handleProductSearch(message);

      return result;
    }

    /* ================================================
       PRODUCT / RECOMMENDATION QUERY
    ================================================ */

    const productResult =
      await handleProductSearch(message);

    /*
      Optional AI polish for the natural-language
      response. Database results remain authoritative.
    */

    const aiReply = await generateAIReply({
      userMessage: message,
      products: productResult.products,
      user,
    });

    return {
      ...productResult,
      reply:
        aiReply || productResult.reply,
    };
  } catch (error) {
    console.error(
      "CHATBOT SERVICE ERROR:",
      error.response?.data || error.message
    );

    return {
      reply:
        "Something went wrong while processing your request 😅",
      products: [],
    };
  }
};
