import dotenv from "dotenv";
import logger from "pino-http";
import express from "express";
import cors from "cors";

import { GoogleGenAI } from "@google/genai";
import { GoogleAuth } from "google-auth-library";

// Import the system prompts functions
import {
  generateDebateSystemPrompt,
  generateJudgeSystemPrompt,
} from "./system-prompts.js";

// Load environment variables from .env
dotenv.config();

const modelId = process.env.MODEL_ID;
const projectId = process.env.PROJECT_ID;
const projectLocation = process.env.PROJECT_LOCATION;
const appCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const appScope = process.env.GOOGLE_VERTEX_AI_SCOPE;
const port = process.env.PORT;

const authClient = new GoogleAuth({
  keyFile: appCredentials,
  scopes: [appScope],
});

const aiClient = new GoogleGenAI({
  vertexai: true,
  project: projectId,
  location: projectLocation,
  googleAuthOptions: authClient,
});

const app = express();

// Application settings
app.disable("x-powered-by");
app.use(express.text()); // for parsing text/plain
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Add CORS headers, only allow our frontend app
app.use(cors({ origin: process.env.FRONTEND_HOSTNAME }));

// Logging middleware
const pinoLogger = logger();
app.use(pinoLogger);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).send({ status: "OK", message: "Server is running" });
});

/**
 * POST /promptAI
 * Generate a debate argument from AI
 *
 * Request body:
 * {
 *   "message": "string - the argument or prompt",
 *   "topic": "string - optional, the debate topic",
 *   "role": "string - optional, the speaker role (affirmative/negative)"
 * }
 *
 * Response:
 * {
 *   "reply": "string - the AI generated argument"
 * }
 */
app.post("/promptAI", async (req, res) => {
  try {
    console.log("Received request to /promptAI:", req.body);

    // Validate request body
    if (!req.body || typeof req.body.message !== "string") {
      return res.status(400).json({
        error:
          "Missing or invalid 'message' field in request body. Expected string.",
      });
    }

    const topic = req.body.topic || "General";
    const role = req.body.role || "Debater";
    const message = req.body.message;

    // Use the system prompt generator function
    const systemPrompt = generateDebateSystemPrompt(topic, role);

    console.log(`Generating content for topic: "${topic}", role: "${role}"`);

    const aiResponse = await aiClient.models.generateContent({
      model: modelId,
      contents: message,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    if (!aiResponse || !aiResponse.text) {
      return res.status(500).json({
        error: "AI service did not return a valid response",
      });
    }

    console.log("AI response generated successfully");
    return res.status(200).json({
      reply: aiResponse.text,
    });
  } catch (error) {
    console.error("Error in /promptAI endpoint:", error.message);
    return res.status(500).json({
      error: "Failed to generate AI response",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * POST /judgeAI
 * Get AI judgment on a debate
 *
 * Request body:
 * {
 *   "transcript": "array or string - the debate messages/transcript",
 *   "topic": "string - optional, the debate topic"
 * }
 *
 * Response:
 * {
 *   "winner": "string - which side won (affirmative/negative)",
 *   "reasoning": "string - explanation of the judgment",
 *   "score": "number - score out of 100"
 * }
 */
app.post("/judgeAI", async (req, res) => {
  try {
    console.log("Received request to /judgeAI:", req.body);

    // Validate request body
    if (!req.body || !req.body.transcript) {
      return res.status(400).json({
        error: "Missing 'transcript' field in request body",
      });
    }

    const transcript = req.body.transcript;
    const topic = req.body.topic || "General";

    // Convert transcript to string if it's an array
    let transcriptStr =
      typeof transcript === "string"
        ? transcript
        : JSON.stringify(transcript, null, 2);

    console.log("Debate Transcript:", transcriptStr);

    // Use the system prompt generator function
    const systemPrompt = generateJudgeSystemPrompt(topic);

    console.log("Sending request to AI for judgment...");

    const aiResponse = await aiClient.models.generateContent({
      model: modelId,
      contents: `Please judge this debate:\n\n${transcriptStr}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      },
    });

    if (!aiResponse || !aiResponse.text) {
      return res.status(500).json({
        error: "AI service did not return a valid response",
      });
    }

    console.log("Raw AI response:", aiResponse.text);

    // Parse the JSON response from AI
    let judgmentJson;
    try {
      judgmentJson = JSON.parse(aiResponse.text);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", aiResponse.text);
      return res.status(500).json({
        error: "AI response was not valid JSON",
        details:
          process.env.NODE_ENV === "development" ? aiResponse.text : undefined,
      });
    }

    // Validate the parsed response has required fields
    if (
      !judgmentJson.winner ||
      !judgmentJson.reasoning ||
      judgmentJson.score === undefined
    ) {
      console.error("AI response missing required fields:", judgmentJson);
      return res.status(500).json({
        error: "AI response missing required fields (winner, reasoning, score)",
      });
    }

    console.log("Judgment JSON parsed successfully:", judgmentJson);

    return res.status(200).json({
      winner: judgmentJson.winner,
      reasoning: judgmentJson.reasoning,
      score: judgmentJson.score,
    });
  } catch (error) {
    console.error("Error in /judgeAI endpoint:", error.message);
    return res.status(500).json({
      error: "Failed to generate AI judgment",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Error handling for undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `CORS enabled for: ${
      process.env.FRONTEND_HOSTNAME || "http://localhost:3000"
    }`
  );
});
