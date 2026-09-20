import { processChatMessage } from "../services/chatbotService.js";

export const chatWithBot = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        reply: "Please enter a message 😊",
        products: [],
      });
    }

    const result = await processChatMessage(
      message.trim(),
      req.user || null
    );

    return res.json(result);
  } catch (error) {
    console.error("CHAT CONTROLLER ERROR:", error);

    return res.status(500).json({
      reply: "Something went wrong while processing your request 😅",
      products: [],
    });
  }
};
