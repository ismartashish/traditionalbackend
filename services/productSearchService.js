import Product from "../models/Product.js";

export const searchProductsForChatbot = async (query = {}) => {
  const mongoQuery = {};

  if (query.keyword) {
    const regex = new RegExp(query.keyword, "i");

    mongoQuery.$or = [
      { title: regex },
      { category: regex },
      { state: regex }
    ];
  }

  if (query.category) {
    mongoQuery.category = new RegExp(query.category, "i");
  }

  if (query.state) {
    mongoQuery.state = new RegExp(query.state, "i");
  }

  if (query.maxPrice) {
    mongoQuery.price = {
      $lte: Number(query.maxPrice)
    };
  }

  if (query.minPrice) {
    mongoQuery.price = {
      ...(mongoQuery.price || {}),
      $gte: Number(query.minPrice)
    };
  }

  if (query.inStock) {
    mongoQuery.stock = { $gt: 0 };
  }

  const products = await Product.find(mongoQuery)
    .sort({ rating: -1 })
    .limit(10)
    .lean();

  return products;
};