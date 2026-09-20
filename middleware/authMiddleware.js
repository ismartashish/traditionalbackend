import jwt from "jsonwebtoken";
import User from "../models/User.js";

/* ================= PROTECT ================= */
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({
          message: "User not found",
        });
      }

      next();
    } catch (err) {
      console.error("AUTH ERROR:", err.message);

      return res.status(401).json({
        message: "Invalid token",
      });
    }
  } else {
    return res.status(401).json({
      message: "No token provided",
    });
  }
};

/* ================= OPTIONAL AUTH ================= */
/*
  Used by chatbot.


 
/* ================= SELLER ONLY ================= */
export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Guest user
  if (
    !authHeader ||
    !authHeader.startsWith("Bearer ")
  ) {
    req.user = null;
    return next();
  }

  try {
    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = await User.findById(
      decoded.id
    ).select("-password");

    next();
  } catch (error) {
    // Invalid/expired token shouldn't break
    // public product questions.
    req.user = null;
    next();
  }
};
export const sellerOnly = (req, res, next) => {
  if (req.user && req.user.role === "seller") {
    next();
  } else {
    return res.status(403).json({
      message: "Seller access only",
    });
  }
};
