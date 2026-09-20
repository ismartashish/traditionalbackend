import express from "express";
import { chatWithBot } from "../controllers/chatController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

/*
  Product questions work without login.
  Personal questions use req.user when logged in.
*/
router.post("/", optionalAuth, chatWithBot);

export default router;
