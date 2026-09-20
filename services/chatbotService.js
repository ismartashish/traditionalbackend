import axios from "axios";
import { searchProductsForChatbot } from "./productSearchService.js";

export const processChatMessage = async (message) => {
  if (!message || !message.trim()) {
    return {
      reply: "Please enter a message 😊",
      products: [],
    };
  }

  try {
    const query = {};

    // -----------------------------
    // PRICE
    // -----------------------------
    const priceMatch = message.match(
      /(?:under|below|less than)\s*[₹rs.]?\s*(\d+)/i
    );

    if (priceMatch) {
      query.maxPrice = Number(priceMatch[1]);
    }

    // -----------------------------
    // STATE
    // -----------------------------
    if (/rajasthan|rajasthani/i.test(message)) {
      query.state = "Rajasthan";
    } else if (/bihar|bihari/i.test(message)) {
      query.state = "Bihar";
    } else if (/uttar pradesh|up\b|banaras|banarasi/i.test(message)) {
      query.state = "Uttar Pradesh";
    } else if (/kashmir|kashmiri/i.test(message)) {
      query.state = "Kashmir";
    }

    // -----------------------------
    // CATEGORY
    // -----------------------------
    if (/clothing|cloth|saree|kurta|dress/i.test(message)) {
      query.category = "Clothing";
    } else if (/handicraft|handmade|craft/i.test(message)) {
      query.category = "Handicraft";
    } else if (/painting|paintings/i.test(message)) {
      query.category = "Painting";
    } else if (/footwear|shoes|mojari/i.test(message)) {
      query.category = "Footwear";
    }

    // -----------------------------
    // STOCK
    // -----------------------------
    if (/in stock|available/i.test(message)) {
      query.inStock = true;
    }

    // -----------------------------
    // SEARCH MONGODB
    // -----------------------------
    const products = await searchProductsForChatbot(query);

    const productContext = products.map((p) => ({
      id: p._id.toString(),
      title: p.title,
      price: p.price,
      category: p.category,
      state: p.state,
      stock: p.stock,
      rating: p.rating,
    }));

    // -----------------------------
    // FALLBACK REPLY
    // -----------------------------
    let reply;

    if (productContext.length === 0) {
      reply = "Sorry, I couldn't find any matching products 😅";
    } else {
      reply = `I found ${productContext.length} product${
        productContext.length > 1 ? "s" : ""
      } that may interest you 😊`;
    }

    // -----------------------------
    // PRODUCT CONTEXT FOR AI
    // -----------------------------
    const context =
      productContext.length > 0
        ? productContext
            .map(
              (p, index) =>
                `${index + 1}. ${p.title} | ₹${p.price} | ${p.category} | ${p.state} | Stock: ${p.stock} | Rating: ${p.rating}`
            )
            .join("\n")
        : "No matching products.";

    // -----------------------------
    // HUGGING FACE AI
    // -----------------------------
    if (process.env.HUGGINGFACE_API_KEY) {
      try {
        const response = await axios.post(
          "https://router.huggingface.co/v1/chat/completions",
          {
            model: "Qwen/Qwen2.5-7B-Instruct",
            messages: [
              {
                role: "system",
                content: `
You are Bharat Assistant, an ecommerce assistant for traditional Indian products.

Use ONLY the product data provided by the application.
Never invent products, prices, stock, ratings, categories or states.

Be friendly and concise.
                `,
              },
              {
                role: "user",
                content: `
User question:
${message}

Available products:
${context}

Answer the user's question using the available products.
                `,
              },
            ],
            max_tokens: 150,
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

        const aiReply =
          response.data?.choices?.[0]?.message?.content?.trim();

        if (aiReply) {
          reply = aiReply;
        }
      } catch (aiError) {
        console.error(
          "HUGGING FACE ERROR:",
          aiError.response?.status,
          aiError.response?.data || aiError.message
        );

        // Keep the product-based fallback reply.
      }
    } else {
      console.warn("HUGGINGFACE_API_KEY is missing");
    }

    // -----------------------------
    // FINAL RESPONSE
    // -----------------------------
    return {
      reply,
      products: productContext,
    };
  } catch (error) {
    console.error(
      "CHATBOT ERROR:",
      error.response?.data || error.message
    );

    return {
      reply: "I couldn't process that request right now 😅",
      products: [],
    };
  }
};
