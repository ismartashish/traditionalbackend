import Product from "../models/Product.js";

/* =========================================================
   HELPERS
========================================================= */

const escapeRegex = (value = "") => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/* =========================================================
   PRODUCT SEARCH
========================================================= */

export const searchProductsForChatbot = async (query = {}) => {
  const mongoQuery = {};

  /* -----------------------------
     KEYWORD
  ----------------------------- */

  if (query.keyword?.trim()) {
    const words = query.keyword
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const regexes = words.map(
      (word) => new RegExp(escapeRegex(word), "i")
    );

    mongoQuery.$and = regexes.map((regex) => ({
      $or: [
        { title: regex },
        { category: regex },
        { state: regex },
      ],
    }));
  }

  /* -----------------------------
     CATEGORY
  ----------------------------- */

  if (query.category) {
    mongoQuery.category = new RegExp(
      `^${escapeRegex(query.category)}$`,
      "i"
    );
  }

  /* -----------------------------
     STATE
  ----------------------------- */

  if (query.state) {
    mongoQuery.state = new RegExp(
      `^${escapeRegex(query.state)}$`,
      "i"
    );
  }

  /* -----------------------------
     MIN PRICE
  ----------------------------- */

  if (
    query.minPrice !== undefined &&
    query.minPrice !== null
  ) {
    mongoQuery.price = {
      ...(mongoQuery.price || {}),
      $gte: Number(query.minPrice),
    };
  }

  /* -----------------------------
     MAX PRICE
  ----------------------------- */

  if (
    query.maxPrice !== undefined &&
    query.maxPrice !== null
  ) {
    mongoQuery.price = {
      ...(mongoQuery.price || {}),
      $lte: Number(query.maxPrice),
    };
  }

  /* -----------------------------
     MIN RATING
  ----------------------------- */

  if (
    query.minRating !== undefined &&
    query.minRating !== null
  ) {
    mongoQuery.rating = {
      $gte: Number(query.minRating),
    };
  }

  /* -----------------------------
     STOCK
  ----------------------------- */

  if (query.inStock === true) {
    mongoQuery.stock = { $gt: 0 };
  }

  if (query.outOfStock === true) {
    mongoQuery.stock = { $lte: 0 };
  }

  /* -----------------------------
     SORT
  ----------------------------- */

  let sort = {};

  switch (query.sortBy) {
    case "price_low":
      sort = { price: 1 };
      break;

    case "price_high":
      sort = { price: -1 };
      break;

    case "rating":
      sort = { rating: -1, numReviews: -1 };
      break;

    case "reviews":
      sort = { numReviews: -1, rating: -1 };
      break;

    case "newest":
      sort = { createdAt: -1 };
      break;

    case "oldest":
      sort = { createdAt: 1 };
      break;

    default:
      sort = { rating: -1, numReviews: -1 };
  }

  /* -----------------------------
     LIMIT
  ----------------------------- */

  const limit = Math.min(
    Math.max(Number(query.limit) || 10, 1),
    30
  );

  return Product.find(mongoQuery)
    .sort(sort)
    .limit(limit)
    .lean();
};

/* =========================================================
   PRODUCT BY ID
========================================================= */

export const getProductForChatbot = async (productId) => {
  return Product.findById(productId)
    .populate("seller", "name shopName")
    .lean();
};

/* =========================================================
   PRODUCT COUNT
========================================================= */

export const countProductsForChatbot = async (query = {}) => {
  const products = await searchProductsForChatbot({
    ...query,
    limit: 30,
  });

  return products.length;
};
