import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await axios.post(
      "https://api-inference.huggingface.co/models/google/flan-t5-large",
      {
        inputs: message,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        },
      }
    );

    res.json({
      reply: response.data[0]?.generated_text || "No response",
    });
  } catch (error) {
    console.error(error.message);
    res.json({
      reply: "Server busy, try again 😅",
    });
  }
});

export default router;