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

  if (/rajasthan|rajasthani/i.test(message)) {
    query.state = "Rajasthan";
  } else if (/bihar|bihari/i.test(message)) {
    query.state = "Bihar";
  } else if (/uttar pradesh|banaras|banarasi/i.test(message)) {
    query.state = "Uttar Pradesh";
  } else if (/kashmir|kashmiri/i.test(message)) {
    query.state = "Kashmir";
  }

  if (/clothing|cloth|saree|kurta|dress|apparel/i.test(message)) {
    query.category = "Clothing";
  } else if (/handicraft|handmade|craft|pottery/i.test(message)) {
    query.category = "Handicraft";
  } else if (/painting|paintings|art/i.test(message)) {
    query.category = "Painting";
  } else if (/footwear|shoes|mojari|sandals/i.test(message)) {
    query.category = "Footwear";
  }

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
   BASIC INTENTS
========================================================= */

const isGreeting = (text) =>
  /^(hi|hii|hello|hey|hey there|namaste|good morning|good afternoon|good evening)\b/i.test(
    text
  );

const isNameQuestion = (text) =>
  /my name|what is my name|what's my name|who am i/i.test(text);

const isEmailQuestion = (text) =>
  /my email|email address|what is my email|what's my email|registered email/i.test(
    text
  );

const isProfileQuestion = (text) =>
  /my profile|profile details|my account|account details/i.test(text);

const isOrderQuestion = (text) =>
  /my order|my orders|order status|where is my order|where's my order|latest order|recent order/i.test(
    text
  );

const isCancelOrderQuestion = (text) =>
  /cancel.*order|cancel my order|cancel order|cancel.*purchase/i.test(text);

const isConfirmation = (text) =>
  /^(yes|yep|yeah|yup|confirm|confirmed|please do|do it|cancel it|sure)$/i.test(
    text
  );

const isRejection = (text) =>
  /^(no|nope|nah|don't|dont|not now|stop)$/i.test(text);

/* =========================================================
   FIND USER'S LATEST CANCELLABLE ORDER
========================================================= */

const findCancellableOrder = async (user, message = "") => {
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
    .limit(10)
    .lean();

  if (!orders.length) {
    return null;
  }

  // Try to match a product name from the user's message.
  const ignoredWords = [
    "cancel",
    "my",
    "the",
    "order",
    "please",
    "purchase",
    "this",
  ];

  const keywords = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !ignoredWords.includes(word));

  if (keywords.length > 0) {
    for (const order of orders) {
      const hasMatchingProduct = order.items?.some((item) => {
        const title = item.product?.title?.toLowerCase() || "";

        return keywords.some((keyword) =>
          title.includes(keyword)
        );
      });

      if (hasMatchingProduct) {
        return order;
      }
    }
  }

  // Otherwise use latest cancellable order.
  return orders[0];
};

/* =========================================================
   ORDER SUMMARY
========================================================= */

const buildOrderSummary = (order) => {
  const itemNames =
    order.items
      ?.map((item) => item.product?.title)
      .filter(Boolean)
      .slice(0, 5) || [];

  const itemCount =
    order.items?.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    ) || 0;

  return {
    orderId: order._id.toString(),
    status: order.status,
    itemCount,
    itemNames,
    totalAmount: order.totalAmount,
  };
};

/* =========================================================
   ORDER STATUS
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

  const itemCount =
    order.items?.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    ) || 0;

  const productNames =
    order.items
      ?.map((item) => item.product?.title)
      .filter(Boolean)
      .slice(0, 3) || [];

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
   AI RESPONSE
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
- Never invent products.
- Never invent prices.
- Never invent stock.
- Never invent ratings.
- Be concise and friendly.
            `.trim(),
          },
          {
            role: "user",
            content: `
User question:
${message}

Available products:
${context}

Answer naturally.
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

export const processChatMessage = async (
  message,
  user = null
) => {
  try {
    if (!message?.trim()) {
      return {
        reply: "Please enter a message 😊",
        products: [],
      };
    }

    const text = normalizeText(message);

    /* ============================================
       GREETING
    ============================================ */

    if (isGreeting(text)) {
      return {
        reply: user?.name
          ? `Hi ${user.name} 👋 How can I help you today?`
          : "Hi 👋 How can I help you today?",
        products: [],
      };
    }

    /* ============================================
       NAME
    ============================================ */

    if (isNameQuestion(text)) {
      if (!user) {
        return {
          reply:
            "Please log in first, then I can tell you your account name 🔐",
          products: [],
        };
      }

      return {
        reply: `Your account name is ${
          user.name || "not available"
        } 😊`,
        products: [],
      };
    }

    /* ============================================
       EMAIL
    ============================================ */

    if (isEmailQuestion(text)) {
      if (!user) {
        return {
          reply:
            "Please log in first, then I can show your registered email 🔐",
          products: [],
        };
      }

      return {
        reply: user.email
          ? `Your registered email is ${user.email} 📧`
          : "I couldn't find an email on your account.",
        products: [],
      };
    }

    /* ============================================
       PROFILE
    ============================================ */

    if (isProfileQuestion(text)) {
      if (!user) {
        return {
          reply:
            "Please log in first so I can access your account details 🔐",
          products: [],
        };
      }

      return {
        reply:
          `Here are your account details:\n\n` +
          `Name: ${user.name || "Not available"}\n` +
          `Email: ${user.email || "Not available"}\n` +
          `Role: ${user.role || "buyer"}`,
        products: [],
      };
    }

    /* ============================================
       CANCEL ORDER
    ============================================ */

    if (isCancelOrderQuestion(text)) {
      if (!user) {
        return {
          reply:
            "Please log in first so I can cancel your order 🔐",
          products: [],
        };
      }

      const order = await findCancellableOrder(user, text);

      if (!order) {
        return {
          reply:
            "I couldn't find a cancellable order on your account. Delivered or already cancelled orders can't be cancelled.",
          products: [],
        };
      }

      const summary = buildOrderSummary(order);

      const itemText =
        summary.itemNames.length > 0
          ? summary.itemNames.join(", ")
          : "your order";

      return {
        reply:
          `I found your order containing ${itemText}.\n\n` +
          `Current status: ${summary.status}\n` +
          `Total: ₹${Number(
            summary.totalAmount || 0
          ).toLocaleString("en-IN")}\n\n` +
          `Do you want me to cancel this order? Reply "yes" to confirm.`,
        products: [],
        action: {
          type: "CANCEL_ORDER_CONFIRM",
          orderId: summary.orderId,
          status: summary.status,
          itemNames: summary.itemNames,
          totalAmount: summary.totalAmount,
        },
      };
    }

    /* ============================================
       NORMAL ORDER QUERY
    ============================================ */

    if (isOrderQuestion(text)) {
      return await getLatestOrderResponse(user);
    }

    /* ============================================
       PRODUCT SEARCH
    ============================================ */

    const query = extractProductQuery(message);

    const products =
      await searchProductsForChatbot(query);

    const productContext = formatProducts(products);

    if (productContext.length === 0) {
      return {
        reply:
          "Sorry, I couldn't find any matching products 😅 Try another category, state, or price range.",
        products: [],
      };
    }

    const aiReply = await generateAIReply({
      message,
      productContext,
    });

    const fallbackReply =
      `I found ${productContext.length} matching product${
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
