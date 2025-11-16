'use strict'
const dotenv = require("dotenv")
const logger = require("pino-http")()
const express = require("express")
const cors = require("cors");

// Load environment variables from .env
dotenv.config()

const app = express()

// Application settings
app.disable("x-powered-by")
app.use(express.text()) // for parsing text/plain
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({extended : true})) // for parsing application/x-www-form-urlencoded

app.use(cors({ origin: 'http://localhost:3000' }));

app.use(logger);

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


app.post('/MessageToAI', (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ error: 'No message was provided.' });
  }

  // This is where you would call the Gemini API, etc.
  console.log(`Received message: ${userMessage}`);
  const aiResponse = `Bla Bla Bla. You just said: "${userMessage}"`;


  // send something back to the frontend
  res.status(200).json({ reply: aiResponse });
});


app.listen(8080, () => {
	console.log("Server started on port 8080")
})
