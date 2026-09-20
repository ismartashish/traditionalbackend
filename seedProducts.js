import dns from "dns";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./models/Product.js";

// Fix MongoDB SRV DNS resolution
dns.setServers(["8.8.8.8", "1.1.1.1"]);

dotenv.config();

const products = [
  {
    title: "Jaipuri Blue Pottery",
    price: 1499,
    category: "Handicraft",
    state: "Rajasthan",
    stock: 20,
    rating: 4.5,
    numReviews: 10,
  },
  {
    title: "Traditional Madhubani Painting",
    price: 1999,
    category: "Painting",
    state: "Bihar",
    stock: 15,
    rating: 4.7,
    numReviews: 12,
  },
  {
    title: "Banarasi Silk Saree",
    price: 3999,
    category: "Clothing",
    state: "Uttar Pradesh",
    stock: 8,
    rating: 4.8,
    numReviews: 18,
  },
  {
    title: "Kashmiri Traditional Shawl",
    price: 2499,
    category: "Clothing",
    state: "Kashmir",
    stock: 12,
    rating: 4.6,
    numReviews: 14,
  },
  {
    title: "Rajasthani Handmade Mojari",
    price: 999,
    category: "Footwear",
    state: "Rajasthan",
    stock: 25,
    rating: 4.4,
    numReviews: 9,
  },
];

const seedProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected");

    await Product.deleteMany({});
    console.log("🗑️ Existing products removed");

    const inserted = await Product.insertMany(products);

    console.log(`✅ ${inserted.length} products inserted`);

    await mongoose.disconnect();
    console.log("✅ MongoDB disconnected");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error);
    process.exit(1);
  }
};

seedProducts();