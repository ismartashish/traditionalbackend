import axios from "axios";
import Order from "../models/Order.js";
import { searchProductsForChatbot } from "./productSearchService.js";

const normalizeText = (message = "") => {
  return message.trim().toLowerCase();
};

/* =========================================================
   PRODUCT QUERY EXTRACTION
========================================================= */
const extractProductQuery = (message) => {
  const query = {};

  /* ----------------------------- */
  /* Price                          */
  /* ----------------------------- */

  const maxPriceMatch = message.match(
    /(?:under|below|less than)\s*[₹rs.]?\s*(\d+)/i
  );

  if (maxPriceMatch) {
    query.maxPrice = Number(maxPriceMatch[1]);
  }

  const minPriceMatch = message.match(
    /(?:above|over|more than)\s*[₹rs.]?\s*(\d+)/i
  );

  if (minPriceMatch) {
    query.minPrice = Number(minPriceMatch[1]);
  }

  /* ----------------------------- */
  /* State                          */
  /* ----------------------------- */

  if (/rajasthan|rajasthani/i.test(message)) {
    query.state = "Rajasthan";
  } else if (/bihar|bihari/i.test(message)) {
    query.state = "Bihar";
  } else if (
    /uttar pradesh|banaras|banarasi/i.test(message)
  ) {
    query.state = "Uttar Pradesh";
  } else if (/kashmir|kashmiri/i.test(message)) {
    query.state = "Kashmir";
  }

  /* ----------------------------- */
  /* Category                       */
  /* ----------------------------- */

  if (
    /clothing|cloth|saree|kurta|dress|apparel/i.test(message)
  ) {
    query.category = "Clothing";
  } else if (
    /handicraft|handmade|craft|pottery/i.test(message)
  ) {
    query.category = "Handicraft";
  } else if (/painting|paintings|art/i.test(message)) {
    query.category = "Painting";
  } else if (
    /footwear|shoes|mojari|sandals/i.test(message)
  ) {
    query.category = "Footwear";
  }

  /* ----------------------------- */
  /* Stock                          */
  /* ----------------------------- */

  if (
    /in stock|available|available products|currently available/i.test(
      message
    )
  ) {
    query.inStock = true;
  }

  return query;
};

/* =========================================================
   FORMAT PRODUCTS
========================================================= */
const formatProducts = (products) => {
  return products.map((product) => ({
    id: product._id.toString(),
    title: product.title,
    price: product.price,
    category: product.category,
    state: product.state,
    stock: product.stock,
    rating: product.rating,
  }));
};

/* =========================================================
   PERSONAL INTENT
========================================================= */
const isGreeting = (text) => {
  return /^(hi|hii|hello|hey|hey there|namaste|good morning|good afternoon|good evening)\b/i.test(
    text
  );
};

const isNameQuestion = (text) => {
  return (
    /my name/i.test(text) ||
    /what is my name/i.test(text) ||
    /what's my name/i.test(text) ||
    /who am i/i.test(text)
  );
};

const isEmailQuestion = (text) => {
  return (
    /my email/i.test(text) ||
    /email address/i.test(text) ||
    /what is my email/i.test(text) ||
    /what's my email/i.test(text) ||
    /registered email/i.test(text)
  );
};

const isProfileQuestion = (text) => {
  return (
    /my profile/i.test(text) ||
    /profile details/i.test(text) ||
    /my account/i.test(text) ||
    /account details/i.test(text)
  );
};

const isOrderQuestion = (text) => {
  return (
    /my order/i.test(text) ||
    /my orders/i.test(text) ||
    /order status/i.test(text) ||
    /where is my order/i.test(text) ||
    /where's my order/i.test(text) ||
    /latest order/i.test(text) ||
    /recent order/i.test(text)
  );
};

/* =========================================================
   ORDER RESPONSE
========================================================= */
const getLatestOrderResponse = async (user) => {
  if (!user?._id) {
    return {
      reply:
        "Please log in first so I can check your orders 🔐",
      products: [],
    };
  }

  const order = await Order.findOne({
    user: user._id,
  })
    .sort({ createdAt: -1 })
    .populate("items.product", "title price")
    .lean();

  if (!order) {
    return {
      reply: "I couldn't find any orders on your account 📦",
      products: [],
    };
  }

  const itemCount = Array.isArray(order.items)
    ? order.items.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
      )
    : 0;

  const productNames = Array.isArray(order.items)
    ? order.items
        .map((item) => item.product?.title)
        .filter(Boolean)
        .slice(0, 3)
    : [];

  let reply = `Your latest order is currently "${order.status}".`;

  if (productNames.length > 0) {
    reply += ` It contains ${itemCount} item${
      itemCount === 1 ? "" : "s"
    }: ${productNames.join(", ")}.`;
  }

  if (order.totalAmount !== undefined) {
    reply += ` Total amount: ₹${Number(
      order.totalAmount
    ).toLocaleString("en-IN")}.`;
  }

  return {
    reply,
    products: [],
  };
};

/* =========================================================
   HUGGING FACE AI RESPONSE
========================================================= */
const generateAIReply = async ({
  message,
  productContext,
}) => {
  if (!process.env.HUGGINGFACE_API_KEY) {
    return null;
  }

  const context =
    productContext.length > 0
      ? productContext
          .map(
            (product, index) =>
              `${index + 1}. ${product.title} | Price: ₹${product.price} | Category: ${product.category} | State: ${product.state} | Stock: ${product.stock} | Rating: ${product.rating}`
          )
          .join("\n")
      : "No matching products were found.";

  try {
    const response = await axios.post(
      "https://router.huggingface.co/v1/chat/completions",
      {
        model: "Qwen/Qwen2.5-7B-Instruct",
        messages: [
          {
            role: "system",
            content: `
You are Bharat Assistant, an ecommerce shopping assistant for traditional Indian products.

Use ONLY the provided product information.

Rules:
- Do not invent products.
- Do not invent prices.
- Do not invent stock.
- Do not invent ratings.
- Be concise and friendly.
- Mention product names and prices when relevant.
            `.trim(),
          },
          {
            role: "user",
            content: `
User question:
${message}

Available products:
${context}

Answer the user naturally.
            `.trim(),
          },
        ],
        max_tokens: 200,
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
      "HUGGING FACE ERROR:",
      error.response?.status,
      error.response?.data || error.message
    );

    return null;
  }
};

/* =========================================================
   MAIN CHAT FUNCTION
========================================================= */
export const processChatMessage = async (message, user = null) => {
  try {
    if (!message || !message.trim()) {
      return {
        reply: "Please enter a message 😊",
        products: [],
      };
    }

    const text = normalizeText(message);

    /* =====================================================
       GREETING
    ===================================================== */

    if (isGreeting(text)) {
      const name = user?.name
        ? ` ${user.name}`
        : "";

      return {
        reply: `Hi${name} 👋 How can I help you today? You can ask me about products, your account, or your orders.`,
        products: [],
      };
    }

    /* =====================================================
       NAME
    ===================================================== */

    if (isNameQuestion(text)) {
      if (!user) {
        return {
          reply:
            "Please log in first, then I can tell you the name on your account 🔐",
          products: [],
        };
      }

      return {
        reply: `Your account name is ${user.name || "not available"} 😊`,
        products: [],
      };
    }

    /* =====================================================
       EMAIL
    ===================================================== */

    if (isEmailQuestion(text)) {
      if (!user) {
        return {
          reply:
            "Please log in first, then I can show you your registered email 🔐",
          products: [],
        };
      }

      return {
        reply: user.email
          ? `Your registered email is ${user.email} 📧`
          : "I couldn't find an email address on your account.",
        products: [],
      };
    }

    /* =====================================================
       PROFILE
    ===================================================== */

    if (isProfileQuestion(text)) {
      if (!user) {
        return {
          reply:
            "Please log in first so I can access your account details 🔐",
          products: [],
        };
      }

      const profileLines = [
        `Name: ${user.name || "Not available"}`,
        `Email: ${user.email || "Not available"}`,
        `Role: ${user.role || "buyer"}`,
      ];

      return {
        reply:
          `Here are your account details:\n\n${profileLines.join(
            "\n"
          )}`,
        products: [],
      };
    }

    /* =====================================================
       ORDERS
    ===================================================== */

    if (isOrderQuestion(text)) {
      return await getLatestOrderResponse(user);
    }

    /* =====================================================
       PRODUCT SEARCH
    ===================================================== */

    const query = extractProductQuery(message);

    const products = await searchProductsForChatbot(query);

    const productContext = formatProducts(products);

    /* =====================================================
       NO PRODUCTS
    ===================================================== */

    if (productContext.length === 0) {
      return {
        reply:
          "Sorry, I couldn't find any matching products 😅 Try another category, state, or price range.",
        products: [],
      };
    }

    /* =====================================================
       AI RESPONSE
    ===================================================== */

    const aiReply = await generateAIReply({
      message,
      productContext,
    });

    /* =====================================================
       FALLBACK RESPONSE
    ===================================================== */

    const fallbackReply = `I found ${productContext.length} matching product${
      productContext.length === 1 ? "" : "s"
    } for you 😊`;

    return {
      reply: aiReply || fallbackReply,
      products: productContext,
    };
  } catch (error) {
    console.error(
      "CHATBOT SERVICE ERROR:",
      error.response?.data || error.message
    );

    return {
      reply:
        "Sorry, I couldn't process that request right now 😅",
      products: [],
    };
  }
};
