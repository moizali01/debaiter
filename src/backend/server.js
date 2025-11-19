import dotenv from "dotenv"
import logger from "pino-http"
import express from "express"
import cors from "cors"

import { GoogleGenAI } from "@google/genai"
import { GoogleAuth } from "google-auth-library"

// Load environment variables from .env
dotenv.config()

const modelId = process.env.MODEL_ID
const projectId = process.env.PROJECT_ID
const projectLocation = process.env.PROJECT_LOCATION
const appCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS
const appScope = process.env.GOOGLE_VERTEX_AI_SCOPE
const port = process.env.PORT

const authClient = new GoogleAuth({
	keyFile : appCredentials,
	scopes : [appScope]
})

const aiClient = new GoogleGenAI({
	vertexai : true,
	project : projectId,
	location : projectLocation,
	googleAuthOptions : authClient
})

const app = express()

// Application settings
app.disable("x-powered-by")
app.use(express.text()) // for parsing text/plain
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

// Add CORS headers, only allow our frontend app
app.use(cors({ origin: process.env.FRONTEND_HOSTNAME }));

app.post("/promptAI",(req,res) => {
	logger(req,res)
	console.log("Received request to /promptAI:", req.body)
	const topic = req.body.topic || "General"
	const role = req.body.role || "None"

	const systemPrompt = `You are a debating AI. You will debate the topic of "${topic}" taking the role of "${role}" speaker. Provide well thought out and balanced arguments.`

	if(req.body === undefined || req.body.message === undefined || typeof req.body.message !== "string"){
		res.status(403).send({
			error : "Missing valid prompt in body"
		})
		return;
	}

	aiClient.models.generateContent({
		model : modelId,
		contents : req.body.message,
		config : {
			systemInstruction : systemPrompt,
		}
	}).then((aiResponse) => {
			res.status(200).send({
				reply : aiResponse.text
			})
	})

	return;
})

app.post("/judgeAI",(req,res) => {
	logger(req,res)
	console.log("Received request to /judge:", req.body)

	const transcript = req.body.transcript
	console.log("Transcript:", transcript)
	const topic = req.body.topic || "General"

	console.log("Debate Transcript:", transcript)

	const systemPrompt = `You are an expert debate judge. You will judge the debate on the topic of "${topic}". Provide a fair and unbiased evaluation of the debate based on the transcript provided. Your response must be a valid JSON object with the following fields: winner (string), reasoning (string), score (number between 0 and 100).`

	aiClient.models.generateContent({
		model : modelId,
		contents : JSON.stringify(transcript),
		config : {
			systemInstruction : systemPrompt,
			responseMimeType: "application/json"
		}
	}).then((aiResponse) => {
			// parse the aiResponse.text as json
			console.log("Judgement JSON:", aiResponse.text);
			const judgementJson = JSON.parse(aiResponse.text);
			// console.log("Judgement JSON:", judgementJson);
			res.status(200).send({
				winner : judgementJson.winner,
				reasoning : judgementJson.reasoning,
				score : judgementJson.score
			})
	})

	return;

})


app.listen(port, () => {
	console.log(`Server started on port ${port}`)
})
