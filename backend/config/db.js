const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (process.env.USE_FILE_DB === "1") {
      console.log("Using local file database");
      return;
    }

    if (!mongoUri) {
      throw new Error("Missing MONGO_URI or MONGODB_URI in environment");
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB connection error:", error?.message || error);
    process.exit(1);
  }
};

module.exports = connectDB;
