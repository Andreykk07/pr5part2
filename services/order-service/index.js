const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://catalog-service:3001';

const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      status VARCHAR(50) NOT NULL,
      items JSONB NOT NULL
    );
  `);
};
initDb();

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'UP', service: 'order-service' });
  } catch (err) {
    res.status(500).json({ status: 'DOWN', error: err.message });
  }
});

app.post('/orders', async (req, res) => {
  const { userId, items } = req.body; // items: [{ productId, quantity }]

  try {
    for (const item of items) {
      const prodFetch = await fetch(`${CATALOG_SERVICE_URL}/products/${item.productId}`);
      if (prodFetch.status === 404) return res.status(400).json({ error: `Product ${item.productId} not found` });
      
      const product = await prodFetch.json();
      if (product.stock < item.quantity) return res.status(400).json({ error: `Not enough stock for product ${item.productId}` });
    }

    for (const item of items) {
      const reserveRes = await fetch(`${CATALOG_SERVICE_URL}/products/${item.productId}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: item.quantity })
      });
      if (!reserveRes.ok) return res.status(500).json({ error: 'Failed to reserve inventory' });
    }

    const orderRes = await pool.query(
      'INSERT INTO orders (user_id, status, items) VALUES ($1, $2, $3) RETURNING *',
      [userId, 'CREATED', JSON.stringify(items)]
    );

    res.status(201).json(orderRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/orders/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.json(result.rows[0]);
});

app.patch('/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  const result = await pool.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.json(result.rows[0]);
});

app.listen(3002, () => console.log('Order Service running on port 3002'));
