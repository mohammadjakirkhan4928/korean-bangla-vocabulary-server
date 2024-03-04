const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

require("dotenv").config();



const port = process.env.PORT || 9000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());



const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});


let koreanToBanglaCollection;
let banglaToKoreanCollection;
let userCollection;

if (uri) {
  console.log("mongodb connected");
}

async function run() {
  try {
    await client.connect(); // establish connection to MongoDB Atlas cluster
    koreanToBanglaCollection = client.db("eps").collection("koreanToBangla");
    banglaToKoreanCollection = client.db("eps").collection("banglaToKorean");
    userCollection = client.db("eps").collection("user");

    app.get("/", async (req, res) => {
      res.send("eps server is running");
    });

    app.get("/koreantobangla/:word", async (req, res) => {
      const { word } = req.params;
      console.log(`Received request for Korean word "${word}"`);
      const translation = await koreanToBanglaCollection.findOne({
        koreanWord: word,
      });
      if (translation) {
        console.log(`Translation found: ${translation.banglaTranslation}`);
        res.json({ translation: translation.banglaTranslation });
      } else {
        const errorMsg = `Translation not found for Korean word "${word}"`;
        console.log(errorMsg);
        res.status(404).json({ error: errorMsg });
      }
    });
    app.get("/banglatokorean/:word", async (req, res) => {
      const { word } = req.params;
      console.log(`Received request for Bangla word "${word}"`);
      const translation = await banglaToKoreanCollection.findOne({
        banglaWord: word,
      });
      if (translation) {
        console.log(`Translation found: ${translation.koreanTranslation}`);
        res.json({ translation: translation.koreanTranslation });
      } else {
        const errorMsg = `Translation not found for Bangla word "${word}"`;
        console.log(errorMsg);
        res.status(404).json({ error: errorMsg });
      }
    });
    app.post("/addword", async (req, res) => {
      const { koreanWord, banglaWord } = req.body;

      // Check if the word already exists in either collection
      const koreanToBanglaWordExists = await koreanToBanglaCollection.findOne({
        koreanWord: koreanWord,
      });
      const banglaToKoreanWordExists = await banglaToKoreanCollection.findOne({
        banglaWord: banglaWord,
      });

      // If the word exists in either collection, send an error message
      if (koreanToBanglaWordExists || banglaToKoreanWordExists) {
        return res.status(400).json({ error: "Word already exists" });
      }

      // Insert the new word into the respective collections
      await koreanToBanglaCollection.insertOne({
        koreanWord: koreanWord,
        banglaTranslation: banglaWord,
      });
      await banglaToKoreanCollection.insertOne({
        banglaWord: banglaWord,
        koreanTranslation: koreanWord,
      });

      res.status(201).json({ message: "Word added successfully" });
    });





  } catch (err) {
    console.error(err);
  } finally {
    // await client.close();
  }
}

run().catch(console.error);

app.listen(port, () => console.log(`eps-server running on ${port}`));
