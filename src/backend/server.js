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

// Disabling CORS for now, until we get a domain for our app
app.use(cors({ origin: process.env.FRONTEND_HOSTNAME }));

app.post("/promptAI",(req,res) => {
	logger(req,res)

	if(req.body === undefined || req.body.message === undefined || typeof req.body.message !== "string"){
		res.status(403).send({
			error : "Missing valid prompt in body"
		})
		return;
	}

	aiClient.models.generateContent({
		model : modelId,
		contents : req.body.message
	}).then((aiResponse) => {
			res.status(200).send({
				response : aiResponse.text
			})
	})

	return;
})

app.listen(8080, () => {
	console.log("Server started on port 8080")
})
