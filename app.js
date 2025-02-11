const express = require("express");
const { connectDB } = require("./database");

const app = express();

const PORT = 3000;

app.use(express.json());

app.use((req, res, next) => {
  req.db = connectDB();
  next();
});

app.get("/products", (req, res, next) => {
  try {
    const products = req.db
      .prepare(
        `
      SELECT products.product_id, products.name, manufacturers.name AS manufacturers_name
      FROM products
      LEFT JOIN manufacturers ON products.manufacturer_id = manufacturers.manufacturer_id    
    `
      )
      .all();
    res.json(products);
  } catch (err) {
    next(err);
  }
});

app.get("/categories-products", (req, res, next) => {
  try {
    const productsCat = req.db
      .prepare(
        `
      SELECT products.product_id, products.name AS product_name, categories.name AS category_name
      FROM products
      JOIN products_categories ON products.product_id = products_categories.product_id
      JOIN categories ON categories.category_id = products_categories.category_id
      `
      )
      .all();
    res.json(productsCat);
  } catch (error) {
    next(err);
  }
});

app.use((req, res, next) => {
  if (req.db) req.db.close();
  next();
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json[{ error: err.messages || "Internal Server Error" }];
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
