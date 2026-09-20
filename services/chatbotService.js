import axios from "axios";
import { searchProductsForChatbot } from "./productSearchService.js";

export const processChatMessage = async (message) => {
  try {
    if (!message || !message.trim()) {
      return {
        reply: "Please enter a message 😊",
        products: [],
      };
    }

    const query = {};
    const text = message.toLowerCase();

    // -----------------------------
    // Price extraction
    // -----------------------------
    const priceMatch = message.match(
      /(?:under|below|less than)\s*[₹rs.]?\s*(\d+)/i
    );

    if (priceMatch) {
      query.maxPrice = Number(priceMatch[1]);
    }

    // -----------------------------
    // State extraction
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
    // Category extraction
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
    // Stock filter
    // -----------------------------
    if (/in stock|available/i.test(message)) {
      query.inStock = true;
    }

    // -----------------------------
    // Get products from MongoDB
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
    // Prepare product context
    // -----------------------------
    const context =
      productContext.length > 0
        ? productContext
            .map(
              (p, index) =>
                `${index + 1}. ${p.title} | Price: ₹${p.price} | Category: ${p.category} | State: ${p.state} | Stock: ${p.stock} | Rating: ${p.rating}`
            )
            .join("\n")
        : "No matching products found.";

    // -----------------------------
    // AI prompt
    // -----------------------------
    const prompt = `
You are Bharat Assistant, an ecommerce shopping assistant for traditional Indian products.

Answer the user's question using ONLY the product information provided below.

Products:
${context}

User question:
${message}

Rules:
- Be concise and friendly.
- Do not invent products.
- Do not invent prices, ratings, stock, or locations.
- If no products match, say that no matching products were found.
- Mention relevant product names and prices when useful.

Answer:
`;

    // -----------------------------
    // Hugging Face
    // -----------------------------
    const response = await axios.post(
      "https://router.huggingface.co/hf-inference/models/google/flan-t5-base",
      {
        inputs: prompt,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    let reply = "I found these products for you 😊";

    if (Array.isArray(response.data)) {
      reply =
        response.data[0]?.generated_text?.trim() ||
        reply;
    } else if (response.data?.error) {
      console.error("Hugging Face error:", response.data.error);

      reply =
        productContext.length > 0
          ? `I found ${productContext.length} matching product(s) for you.`
          : "I couldn't find any matching products.";
    }

    return {
      reply,
      products: productContext,
    };
  } catch (error) {
    console.error(
      "CHATBOT SERVICE ERROR:",
      error.response?.data || error.message
    );

    return {
      reply: "Sorry, I couldn't process that request right now 😅",
      products: [],
    };
  }
};
