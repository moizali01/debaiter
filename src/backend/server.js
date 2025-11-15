'use strict'
const dotenv = require("dotenv")
const logger = require("pino-http")()
const express = require("express")


// Load environment variables from .env
dotenv.config()

const app = express()

// Application settings
app.disable("x-powered-by")
app.use(express.text()) // for parsing text/plain
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({extended : true})) // for parsing application/x-www-form-urlencoded

app.post("/promptAI",(req,res) => {
	logger(req,res)

	const apiReq = new Request("http://localhost:8080/randomEndpoint",{
		method : "POST",
		headers : {
			"Content-Type" : "application/json"
		},
		body : JSON.stringify({
			name : "Deniz"
		})
	})

	fetch(apiReq)
	.then((resp) => resp.text())
	.then((bodyText) => res.send(`This is what randomEndpoint said ${bodyText}`))
})

app.listen(8080)
