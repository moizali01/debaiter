'use strict'
const dotenv = require("dotenv")
const lorem_ipsum = require("lorem-ipsum")
const logger = require("pino-http")()
const express = require("express")

// Load environment variables from .env
dotenv.config()

const app = express()

const lorem = new lorem_ipsum.LoremIpsum({
	sentencesPerParagraph : {
		max : 8,
		min : 4,
	},
	wordsPerSentence : {
		max : 16,
		min : 4,
	}
})

// Application settings
app.disable("x-powered-by")
app.use(express.text()) // for parsing text/plain
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({extended : true})) // for parsing application/x-www-form-urlencoded

app.post("/promptAI",(req,res) => {
	logger(req,res)

	res.send(lorem.generateParagraphs(5))

	// const apiReq = new Request("http://localhost:8080/randomEndpoint",{
	// 	method : "POST",
	// 	headers : {
	// 		"Content-Type" : "application/json"
	// 	},
	// 	body : JSON.stringify({
	// 		name : "Deniz"
	// 	})
	// })

	// fetch(apiReq)
	// .then((resp) => resp.text())
	// .then((bodyText) => res.send(`This is what randomEndpoint said ${bodyText}`))
})

app.listen(8080)
