import dotenv from "dotenv"
import logger from "pino-http"
import express from "express"

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

app.post("/promptAI", (req, res) => {
	logger(req, res)

	if(req.body === undefined || req.body.prompt === undefined || typeof req.body.prompt !== "string"){
		res.status(403).send({
			error : "Missing valid prompt in body"
		})
		return;
	}

	aiClient.models.generateContent({
		model : modelId,
		contents : req.body.prompt
	}).then((aiResponse) => {
			res.send({
				response : aiResponse.text
			})
	})

	return;
})

app.listen(8080)
