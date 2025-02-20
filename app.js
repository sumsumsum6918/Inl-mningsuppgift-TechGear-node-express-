const express = require("express");
const Joi = require("joi");
const db = require("./database");

const app = express();

const PORT = 3000;

app.use(express.json());

const productSchema = Joi.object({
  manufacturer_id: Joi.number().integer().required(),
  name: Joi.string().required(),
  description: Joi.string().allow(""),
  price: Joi.number().required(),
  stock_quantity: Joi.number().integer().required(),
});

const updateProductSchema = Joi.object({
  manufacturer_id: Joi.number().integer().optional(),
  name: Joi.string().optional(),
  description: Joi.string().allow("").optional(),
  price: Joi.number().optional(),
  stock_quantity: Joi.number().integer().optional(),
}).min(1);

const updateCustomerSchema = Joi.object({
  name: Joi.string().optional(),
  email: Joi.string().email().optional(),
  phone: Joi.number().integer().optional(),
  address: Joi.string().optional(),
  password: Joi.string().optional(),
}).min(1);

app.use((req, res, next) => {
  try {
    req.db = db;
    console.log("Connected to the database!");
    next();
  } catch (err) {
    console.error("Database connection error:", err.message);
  }
});

app.get("/products", (req, res, next) => {
  try {
    const products = req.db
      .prepare(
        `
      SELECT products.product_id,
          products.name,
          manufacturers.name AS manufacturers_name,
          categories.name AS category_name
       FROM products
       LEFT JOIN
          manufacturers ON products.manufacturer_id = manufacturers.manufacturer_id
       LEFT JOIN
         products_categories ON products.product_id = products_categories.product_id
       LEFT JOIN
          categories ON categories.category_id = products_categories.category_id;
    `
      )
      .all();
    res.json(products);
  } catch (err) {
    next(err);
  }
});

app.get("/products/search", (req, res, next) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "Search term is required" });
  try {
    const products = req.db
      .prepare(
        `
      SELECT 
      p.product_id, 
      m.name AS manufacturers_name, 
      p.name, 
      p.description, 
      p.price, 
      p.stock_quantity
      FROM products p
      LEFT JOIN manufacturers m
      ON p.manufacturer_id = m.manufacturer_id     
      WHERE p.name LIKE ?
      `
      )
      .all(`%${name}%`);

    if (products.length === 0)
      return res.status(404).json({ message: "No products found" });

    res.json(products);
  } catch (err) {
    next(err);
  }
});

app.get("/products/category/:categoryId", (req, res, next) => {
  const { categoryId } = req.params;
  if (!categoryId)
    return res.status(400).json({ error: "Category ID is required" });

  try {
    const products = req.db
      .prepare(
        `
      SELECT categories.name AS category_name,  products.name AS product_name
      FROM products
      JOIN products_categories ON products.product_id = products_categories.product_id
      JOIN categories ON categories.category_id = products_categories.category_id
      WHERE categories.category_id = ?
      `
      )
      .all(categoryId);
    res.json(products);
  } catch (error) {
    next(error);
  }
});

app.get("/products/:id", (req, res, next) => {
  const { id } = req.params;

  try {
    const product = req.db
      .prepare(
        `SELECT 
          *
       FROM products
      WHERE product_id = ?
    `
      )
      .get(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
});

app.post("/products", (req, res, next) => {
  const { error, value } = productSchema.validate(req.body);

  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const stmt = db.prepare(`
      INSERT INTO products (manufacturer_id, name, description, price, stock_quantity)
      VALUES (?, ?, ?, ?, ?)
      `);

    const result = stmt.run(
      value.manufacturer_id,
      value.name,
      value.description,
      value.price,
      value.stock_quantity
    );

    res.status(201).json({ id: result.lastInsertRowid, ...value });
  } catch (err) {
    next(err);
  }
});

app.put("/products/:id", (req, res, next) => {
  const { id } = req.params;
  const { error, value } = updateProductSchema.validate(req.body);

  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const existingProduct = db
      .prepare("SELECT * FROM products WHERE product_id = ?")
      .get(id);
    if (!existingProduct)
      return res.status(404).json({ error: "Product not found." });

    const fields = Object.keys(value)
      .map((key) => `${key} = ?`)
      .join(", ");

    const values = Object.values(value);

    if (fields.length > 0) {
      const stmt = db.prepare(`
      UPDATE products SET ${fields} WHERE product_id = ?
      `);
      stmt.run(...values, id);
    }

    const updatedProduct = db
      .prepare("SELECT * FROM products WHERE product_id = ?")
      .get(id);

    res.json(updatedProduct);
  } catch (err) {
    next(err);
  }
});

app.delete("/products/:id", (req, res, next) => {
  const { id } = req.params;

  try {
    const existingProduct = req.db
      .prepare("SELECT * FROM products WHERE product_id = ?")
      .get(id);

    if (!existingProduct)
      return res.status(404).json({ error: "Product not found." });

    const stmt = req.db.prepare("DELETE FROM products where product_id = ?");
    stmt.run(id);

    res.json({ message: "Product and related reviews deleted sucessfully" });
  } catch (err) {
    next(err);
  }
});

app.get("/customers", (req, res, next) => {
  try {
    const customers = req.db.prepare("SELECT * FROM customers").all();
    res.json(customers);
  } catch (err) {
    next(err);
  }
});

app.get("/customers/:id", (req, res, next) => {
  const { id } = req.params;

  try {
    const customer = req.db
      .prepare(
        `SELECT 
          name AS customer_name,
          email,
          phone,
          address,
          MAX(orders.order_date) AS Latest_order
       FROM customers
       JOIN orders
       ON orders.customer_id = customers.customer_id
      WHERE customers.customer_id = ?
    `
      )
      .get(id);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(customer);
  } catch (err) {
    next(err);
  }
});

app.get("/customers/:id/orders", (req, res, next) => {
  const { id } = req.params;

  try {
    const customer = req.db
      .prepare(
        `SELECT 
          name AS customer_name
       FROM customers
      WHERE customer_id = ?
    `
      )
      .get(id);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const orders = req.db
      .prepare(
        `
      SELECT orders.order_id, 
      products.name AS product_name,
      quantity,
      order_date
      FROM orders
      LEFT JOIN orders_products
      ON orders.order_id = orders_products.order_id
      JOIN customers
      ON customers.customer_id = orders.customer_id
      LEFT JOIN products 
      ON products.product_id = orders_products.product_id
      WHERE orders.customer_id = ?
      `
      )
      .all(id);

    res.json({
      customer_id: customer.customer_name,
      orders_history: orders.length > 0 ? orders : "No orders found.",
    });
  } catch (err) {
    next(err);
  }
});

app.put("/customers/:id", (req, res, next) => {
  const { id } = req.params;
  const { error, value } = updateCustomerSchema.validate(req.body);

  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const existingCustomer = db
      .prepare("SELECT * FROM customers WHERE customer_id = ?")
      .get(id);
    if (!existingCustomer)
      return res.status(404).json({ error: "Customer not found." });

    const fields = Object.keys(value)
      .map((key) => `${key} = ?`)
      .join(", ");

    const values = Object.values(value);

    if (fields.length > 0) {
      const stmt = db.prepare(`
      UPDATE customers SET ${fields} WHERE customer_id = ?
      `);
      stmt.run(...values, id);
    }

    const updatedCustomer = db
      .prepare("SELECT * FROM customers WHERE customer_id = ?")
      .get(id);

    res.json(updatedCustomer);
  } catch (err) {
    next(err);
  }
});

app.get("/reviews", (req, res, next) => {
  try {
    const reviews = req.db
      .prepare(
        `
      SELECT products.name AS product_name, customers.name AS customer_name, reviews.rating, reviews.comment
      FROM reviews
      JOIN products ON products.product_id = reviews.product_id
      JOIN customers ON customers.customer_id = reviews.customer_id 
      `
      )
      .all();
    res.json(reviews);
  } catch (error) {
    next(error);
  }
});

app.get("/orders", (req, res, next) => {
  try {
    const orders = req.db
      .prepare(
        `
      SELECT order_id, products.name AS product_name, quantity, unit_price AS price
      FROM orders_products
      JOIN products ON products.product_id = orders_products.product_id
      `
      )
      .all();
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// app.use((req, res, next) => {
//   if (req.db) req.db.close();
//   next();
// });

// app.use((err, req, res, next) => {
//   console.error(err);
//   res.status(500).json({ error: err.messages || "Internal Server Error" });
// });

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
