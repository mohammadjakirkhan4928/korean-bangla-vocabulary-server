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


if (uri) {
  console.log("mongodb connected");
}

async function run() {
  try {
    await client.connect(); // establish connection to MongoDB Atlas cluster
    koreanToBanglaCollection = client.db("eps").collection("koreanToBangla");
    banglaToKoreanCollection = client.db("eps").collection("banglaToKorean");

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
        res.json(translation.banglaTranslation);
      } else {
        const errorMsg = `Translation not found for Korean word "${word}"`;
        console.log(errorMsg);
        res.status(404).json(errorMsg);
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
        res.json(translation.koreanTranslation);
      } else {
        const errorMsg = `Translation not found for Bangla word "${word}"`;
        console.log(errorMsg);
        res.status(404).json(errorMsg);
      }
    });
  } catch (err) {
    console.error(err);
  } finally {
    // await client.close();
  }
}

run().catch(console.error);

app.listen(port, () => console.log(`EPS running on ${port}`));
