const Database = require("better-sqlite3");

const db = new Database("webbutiken.db", { verbose: console.log });

module.exports = db;
