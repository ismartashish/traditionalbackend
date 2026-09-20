import express from "express";

import {
  chatWithBot,
} from "../controllers/chatController.js";

import {
  optionalAuth,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
  Guest:
  - product search
  - product recommendations
  - product information

  Logged-in:
  - name
  - email
  - profile
  - orders
  - purchased items
  - spending
  - cancellation
*/

router.post(
  "/",
  optionalAuth,
  chatWithBot
);

export default router;
