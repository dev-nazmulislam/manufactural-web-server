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

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const partsCollection = client.db("manufacturer-data").collection("parts");
    const userCollection = client.db("manufacturer-data").collection("users");
    const orderCollection = client.db("manufacturer-data").collection("orders");
    const paymentCollection = client
      .db("manufacturer-data")
      .collection("payments");
    const reviewCollection = client
      .db("manufacturer-data")
      .collection("comments");

    // Payment Methood
    // app.post("/create-payment-intent", async (req, res) => {
    //   const service = req.body;
    //   const price = service.price;
    //   const amount = price * 100;
    //   const paymentIntent = await stripe.paymentIntents.create({
    //     amount: amount,
    //     currency: "usd",
    //     payment_method_types: ["card"],
    //   });
    //   res.send({ clientSecret: paymentIntent.client_secret });
    // });

    // Get User data
    app.get("/user", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.put("/user/admin/:email", async (req, res) => {
      const email = req.params.email;
      const role = req.query.role;
      // return console.log(role);
      const filter = { email: email };
      if (role === "Admin") {
        const updateDoc = {
          $set: { role: "User" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        const updateDoc = {
          $set: { role: "Admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    });

    // Update & insert User to database
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    // Delete User
    app.delete("/user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // Get product
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

    app.get("/order", async (req, res) => {
      const email = req.query.email;
      const status = req.query.status;
      let query;
      if (status == "all") {
        query = { email };
      } else {
        query = { email, orderStatus: status };
      }
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
        orderStatus: "Pandding",
      };
      const exists = await orderCollection.findOne(query);
      newOrder.orderStatus = "Pandding";
      if (exists) {
        return res.send({ success: false });
      } else {
        const result = await orderCollection.insertOne(newOrder);
        return res.send({ success: true });
      }
    });

    // Update orders Data
    app.put("/update/:id", async (req, res) => {
      const id = req.params.id;
      const updatedOrder = req.body;
      // console.log(updatedOrder);

      const filter = { _id: id };
      const options = { upsert: true };
      const updatedDoc = {
        $set: updatedOrder,
      };
      const result = await orderCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // Delete orders Data
    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });

    // // Update Order data for payment
    // app.patch("/orders/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const payment = req.body;
    //   const filter = { _id: ObjectId(id) };
    //   const updatedDoc = {
    //     $set: {
    //       paid: true,
    //       transactionId: payment.transactionId,
    //     },
    //   };

    //   const result = await paymentCollection.insertOne(payment);
    //   const updatedBooking = await bookingCollection.updateOne(
    //     filter,
    //     updatedDoc
    //   );
    //   res.send(updatedBooking);
    // });

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
