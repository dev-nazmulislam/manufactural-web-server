const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
var nodemailer = require("nodemailer");
var sgTransport = require("nodemailer-sendgrid-transport");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.krxly.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const partsCollection = client.db("manufacturer-data").collection("parts");
    const orderCollection = client.db("manufacturer-data").collection("orders");
    const reviewCollection = client
      .db("manufacturer-data")
      .collection("comments");

    app.get("/items", async (req, res) => {
      const query = {};
      const cursor = partsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Load order data api
    app.get("/orders", async (req, res) => {
      const query = {};
      const cursor = orderCollection.find(query);
      const result = await cursor.toArray();

      res.send(result);
    });

    // Insert order api
    app.post("/orders", async (req, res) => {
      const newOrder = req.body;
      const query = {
        name: newOrder.name,
        email: newOrder.email,
      };
      const exists = await orderCollection.findOne(query);
      newOrder.orderStatus = true;
      if (exists) {
        return res.send({ success: false });
      } else {
        const result = await orderCollection.insertOne(newOrder);
        return res.send({ success: true });
      }
    });

    // Load reviews data api
    app.get("/reviews", async (req, res) => {
      const query = {};
      const page = parseInt(req.query.page);
      const cursor = reviewCollection.find(query);
      const reviews = await cursor
        .skip(page * 3)
        .limit(3)
        .toArray();
      res.send(reviews);
    });

    // Post review api
    app.post("/reviews", async (req, res) => {
      const newReview = req.body;
      const result = await reviewCollection.insertOne(newReview);
      res.send(result);
    });

    // Count Reviews
    app.get("/reviewCount", async (req, res) => {
      const count = await reviewCollection.estimatedDocumentCount();
      res.send({ count });
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello From NR Computers!");
});

app.listen(port, () => {
  console.log(`NR Computers listening on port ${port}`);
});
