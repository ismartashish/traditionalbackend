import Product from "../models/Product.js";

/* Escape special regex characters */
const escapeRegex = (value = "") => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const searchProductsForChatbot = async (query = {}) => {
  const mongoQuery = {};

  /* -------------------------------- */
  /* Keyword                           */
  /* -------------------------------- */
  if (query.keyword) {
    const safeKeyword = escapeRegex(query.keyword);
    const regex = new RegExp(safeKeyword, "i");

    mongoQuery.$or = [
      { title: regex },
      { category: regex },
      { state: regex },
    ];
  }

  /* -------------------------------- */
  /* Category                          */
  /* -------------------------------- */
  if (query.category) {
    mongoQuery.category = new RegExp(
      `^${escapeRegex(query.category)}$`,
      "i"
    );
  }

  /* -------------------------------- */
  /* State                             */
  /* -------------------------------- */
  if (query.state) {
    mongoQuery.state = new RegExp(
      `^${escapeRegex(query.state)}$`,
      "i"
    );
  }

  /* -------------------------------- */
  /* Maximum price                     */
  /* -------------------------------- */
  if (query.maxPrice !== undefined) {
    mongoQuery.price = {
      ...(mongoQuery.price || {}),
      $lte: Number(query.maxPrice),
    };
  }

  /* -------------------------------- */
  /* Minimum price                     */
  /* -------------------------------- */
  if (query.minPrice !== undefined) {
    mongoQuery.price = {
      ...(mongoQuery.price || {}),
      $gte: Number(query.minPrice),
    };
  }

  /* -------------------------------- */
  /* In stock                          */
  /* -------------------------------- */
  if (query.inStock) {
    mongoQuery.stock = {
      $gt: 0,
    };
  }

  const products = await Product.find(mongoQuery)
    .sort({ rating: -1 })
    .limit(10)
    .lean();

  return products;
};
