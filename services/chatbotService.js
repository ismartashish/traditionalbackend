import { searchProductsForChatbot } from "./productSearchService.js";
import axios from "axios";

export const processChatMessage = async (message) => {

  // Very simple query extraction for first version
  const query = {};

  const priceMatch = message.match(/(?:under|below|less than)\s*[₹rs.]?\s*(\d+)/i);

  if (priceMatch) {
    query.maxPrice = Number(priceMatch[1]);
  }

  if (/rajasthan|rajasthani/i.test(message)) {
    query.state = "Rajasthan";
  }

  if (/in stock|available/i.test(message)) {
    query.inStock = true;
  }

  const products = await searchProductsForChatbot(query);

  const productContext = products.map((p) => ({
    id: p._id,
    title: p.title,
    price: p.price,
    category: p.category,
    state: p.state,
    stock: p.stock,
    rating: p.rating
  }));

  // Send productContext + message to your AI model
  // ...

  return {
    reply: "...",
    products: productContext
  };
};