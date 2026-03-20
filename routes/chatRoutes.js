import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await axios.post(
      "https://router.huggingface.co/hf-inference/models/google/flan-t5-base",
      {
        inputs: `You are a helpful assistant for Bharat Traditions ecommerce app.
User: ${message}
Assistant:`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        },
      }
    );

    let reply = "Try again 😅";

    if (Array.isArray(response.data)) {
      reply = response.data[0]?.generated_text;
    } else if (response.data?.error) {
      reply = "Model is loading ⏳, try again in few seconds";
    }

    res.json({ reply });

  } catch (error) {
    console.error("CHAT ERROR:", error.response?.data || error.message);

    res.json({
      reply: "Server busy 😅 try again later"
    });
  }
});

export default router;