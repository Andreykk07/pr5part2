const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Ініціалізація БД
const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price NUMERIC(10, 2) NOT NULL,
      stock INT NOT NULL,
      category VARCHAR(100) NOT NULL
    );
  `);
};
initDb();

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'UP', service: 'catalog-service' });
  } catch (err) {
    res.status(500).json({ status: 'DOWN', error: err.message });
  }
});

app.get('/products', async (req, res) => {
  const { search, category } = req.query;
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND name ILIKE $${params.length}`;
  }
  if (category) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }

  const result = await pool.query(query, params);
  res.json(result.rows);
});

app.get('/products/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
  res.json(result.rows[0]);
});

app.post('/products/:id/reserve', async (req, res) => {
  const { quantity } = req.body;
  const productId = req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const productRes = await client.query('SELECT stock FROM products WHERE id = $1 FOR UPDATE', [productId]);
    
    if (productRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const currentStock = productRes.rows[0].stock;
    if (currentStock < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [quantity, productId]);
    await client.query('COMMIT');
    res.json({ message: 'Reservation successful' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.listen(3001, () => console.log('Catalog Service running on port 3001'));v
