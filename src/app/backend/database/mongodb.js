import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

if (!MONGO_URI) {
  throw new Error("Please add MONGO_URI in .env");
}

let cached = global.mongooseConnection;

if (!cached) {
  cached = global.mongooseConnection = {
    conn: null,
    promise: null,
  };
}

export const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const options = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    };

    // Only force a database when you explicitly set MONGODB_DB_NAME.
    // Otherwise Mongoose uses the database name from MONGO_URI.
    if (MONGODB_DB_NAME) {
      options.dbName = MONGODB_DB_NAME;
    }

    cached.promise = mongoose.connect(MONGO_URI, options).then((mongooseInstance) => {
      console.log("MongoDB Connected:", mongooseInstance.connection.name);
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    console.error("MongoDB Error:", error);
    throw error;
  }
};
