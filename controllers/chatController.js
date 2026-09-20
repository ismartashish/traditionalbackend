import { processChatMessage } from "../services/chatbotService.js";

export const chatWithBot = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        message: "Message is required"
      });
    }

    const result = await processChatMessage(message);

    res.json(result);

  } catch (error) {
    console.error("CHAT CONTROLLER ERROR:", error);

    res.status(500).json({
      message: "Chatbot failed"
    });
  }
};