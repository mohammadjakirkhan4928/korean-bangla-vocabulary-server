const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 9000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI_453038;

if(uri){
  console.log('mongoDB connected succcessfully')
}

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    koreanToBanglaCollection = client
      .db("korean-bangla-word-book")
      .collection("koreanToBangla");
    banglaToKoreanCollection = client
      .db("korean-bangla-word-book")
      .collection("banglaToKorean");
    userCollection = client.db("korean-bangla-word-book").collection("user");

    const verifyIsAdmin = async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          return res.status(401).send("Unauthorized access");
        }
        const token = authHeader.split(" ")[1];
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
          if (err) {
            return res.status(403).send({ message: "Forbidden access" });
          }
          const admin = await userCollection.findOne({ email: decoded.email });
          if (!admin) {
            return res.status(403).send({ message: "Forbidden access" });
          }
          req.admin = admin;
          next();
        });
      } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred while verifying the admin");
      }
    };

    app.get("/suggestions/:partialWord", async (req, res) => {
      const { partialWord } = req.params;
      try {
        // Use regular expression to find words that start with the partial word
        const koreanSuggestions = await koreanToBanglaCollection
          .find({ koreanWord: { $regex: `^${partialWord}`, $options: "i" } })
          .limit(5) // Limit the number of suggestions to 5
          .toArray();

        const banglaSuggestions = await banglaToKoreanCollection
          .find({ banglaWord: { $regex: `^${partialWord}`, $options: "i" } })
          .limit(5) // Limit the number of suggestions to 5
          .toArray();

        // Combine and return both sets of suggestions
        const suggestions = [
          ...koreanSuggestions.map((item) => item.koreanWord),
          ...banglaSuggestions.map((item) => item.banglaWord),
        ];

        res.json({ suggestions });
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        res.status(500).json({ error: "Internal server error" });
      }
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
    app.post("/addword", verifyIsAdmin, async (req, res) => {
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
    app.get("/allwords", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const searchTerm = req.query.q || "";
        const words = await koreanToBanglaCollection
          .find({
            $or: [
              { koreanWord: { $regex: searchTerm, $options: "i" } },
              { banglaTranslation: { $regex: searchTerm, $options: "i" } },
            ],
          })
          .skip((page - 1) * 10)
          .limit(10)
          .toArray();

        const totalCount = await koreanToBanglaCollection.countDocuments({
          $or: [
            { koreanWord: { $regex: searchTerm, $options: "i" } },
            { banglaTranslation: { $regex: searchTerm, $options: "i" } },
          ],
        });
        res.status(200).json({ words, totalCount });
      } catch (error) {
        console.error("Error fetching all words:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
    app.post("/verifyAdmin", async (req, res) => {
      const { email, password } = req.body;

      try {
        const user = await userCollection.findOne({ email });

        if (user) {
          const passwordMatch = await bcrypt.compare(password, user.password);

          if (passwordMatch) {
            const token = jwt.sign({ email }, process.env.JWT_SECRET, {
              expiresIn: "1h",
            });
            res.status(200).json({ token });
          } else {
            res.status(401).json({ error: "Invalid credentials" });
          }
        } else {
          res.status(401).json({ error: "Invalid credentials" });
        }
      } catch (error) {
        console.error("Error verifying user:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
    app.post("/multiplewordadd", verifyIsAdmin, async (req, res) => {
      const words = req.body;
      try {
        for (const word of words) {
          console.log("Processing word:", word);

          // Check if the word exists in either collection
          const koreanToBanglaWord = await koreanToBanglaCollection.findOne({
            koreanWord: word.koreanWord,
          });
          const banglaToKoreanWord = await banglaToKoreanCollection.findOne({
            banglaWord: word.banglaWord,
          });

          // If the word exists with matching translations in both collections, skip storing
          if (
            koreanToBanglaWord &&
            koreanToBanglaWord.banglaTranslation === word.banglaWord &&
            banglaToKoreanWord &&
            banglaToKoreanWord.koreanTranslation === word.koreanWord
          ) {
            console.log(
              "Word with matching translations already exists in both collections. Skipping."
            );
            continue;
          }

          // Check if the Korean word exists in the koreanToBangla collection
          if (koreanToBanglaWord) {
            // Check if the Bangla translation matches
            if (koreanToBanglaWord.banglaTranslation !== word.banglaWord) {
              // Store the word if the Bangla translation doesn't match
              await koreanToBanglaCollection.insertOne({
                koreanWord: word.koreanWord,
                banglaTranslation: word.banglaWord,
              });
              console.log("Stored word with updated Bangla translation");
            }
          } else {
            // Store the word if it doesn't exist in the koreanToBangla collection
            await koreanToBanglaCollection.insertOne({
              koreanWord: word.koreanWord,
              banglaTranslation: word.banglaWord,
            });
            console.log("Stored word in koreanToBangla collection");
          }

          // Check if the Bangla word exists in the banglaToKorean collection
          if (banglaToKoreanWord) {
            // Check if the Korean translation matches
            if (banglaToKoreanWord.koreanTranslation !== word.koreanWord) {
              // Store the word if the Korean translation doesn't match
              await banglaToKoreanCollection.insertOne({
                banglaWord: word.banglaWord,
                koreanTranslation: word.koreanWord,
              });
              console.log("Stored word with updated Korean translation");
            }
          } else {
            // Store the word if it doesn't exist in the banglaToKorean collection
            await banglaToKoreanCollection.insertOne({
              banglaWord: word.banglaWord,
              koreanTranslation: word.koreanWord,
            });
            console.log("Stored word in banglaToKorean collection");
          }
        }
        console.log("All words processed successfully");
        res.status(200).json({ message: "Words uploaded successfully" });
      } catch (error) {
        console.error("Error uploading words:", error);
        res.status(500).json({ error: "Internal server error" }); // Send error response to the client
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("korean-word-book server is running");
});

app.listen(port, () => {
  console.log(`korean-word-book Server is running on port: ${port}`);
});

module.exports = app;
