const mongoose = require("mongoose");
const env = require("./env");

mongoose.set("strictQuery", true);

async function connectDB() {
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log(
      `MongoDB connected: ${conn.connection.host}/${conn.connection.name}`
    );

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected");
    });
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
}

module.exports = connectDB;
