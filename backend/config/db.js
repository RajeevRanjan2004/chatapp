const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (process.env.USE_FILE_DB === "1") {
      console.log("Using local file database");
      return;
    }

    if (!process.env.MONGO_URI) {
      throw new Error("Missing MONGO_URI in environment");
    }

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB connection error:", error?.message || error);
    process.exit(1);
  }
};

module.exports = connectDB;
