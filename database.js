const Database = require("better-sqlite3");

const connectDB = () => {
  return new Database("webbutiken.db", { verbose: console.log });
};

module.exports = { connectDB };
