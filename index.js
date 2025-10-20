const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'secret_key';

// ------------------- Middleware -------------------
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// ------------------- MySQL Connection -------------------
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'university_tracker',
});

db.connect(err => {
  if (err) {
    console.error('❌ DB connection failed:', err);
    process.exit(1);
  }
  console.log('✅ Connected to MySQL Database');
});

// ------------------- JWT Verification -------------------
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'Token missing' });

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

// ------------------- Routes -------------------
app.get('/', (req, res) => {
  res.send('✅ University Tracker Backend is running');
});

// ------------------- User Registration -------------------
app.post('/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const hashed = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO users (email, password, role) VALUES (?, ?, ?)';
    db.query(query, [email, hashed, role || 'student'], err => {
      if (err) {
        console.error('Register error:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      res.status(201).json({ message: 'User registered successfully' });
    });
  } catch (error) {
    console.error('Register failed:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------- Login -------------------
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '2h' });
    res.json({ token, role: user.role });
  });
});

// ------------------- Students CRUD -------------------
app.get('/students', verifyToken, (req, res) => {
  db.query('SELECT * FROM students', (err, results) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json(results);
  });
});

app.post('/students', verifyToken, (req, res) => {
  const { name, email, enrollment_year } = req.body;
  if (!name || !email || !enrollment_year) return res.status(400).json({ error: 'All fields are required' });

  const query = 'INSERT INTO students (name, email, enrollment_year) VALUES (?, ?, ?)';
  db.query(query, [name, email, enrollment_year], (err, result) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.status(201).json({ id: result.insertId, name, email, enrollment_year });
  });
});

app.put('/students/:id', verifyToken, (req, res) => {
  const studentId = req.params.id;
  const { name, email, enrollment_year } = req.body;

  const query = 'UPDATE students SET name = ?, email = ?, enrollment_year = ? WHERE id = ?';
  db.query(query, [name, email, enrollment_year, studentId], err => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json({ message: 'Student updated successfully' });
  });
});

app.delete('/students/:id', verifyToken, (req, res) => {
  const studentId = req.params.id;
  db.query('DELETE FROM students WHERE id = ?', [studentId], err => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json({ message: 'Student deleted successfully' });
  });
});

// ------------------- Attendance -------------------
app.post('/attendance', verifyToken, (req, res) => {
  const { student_id, status } = req.body;
  if (!student_id || !status) return res.status(400).json({ error: 'Missing fields' });

  const date = new Date().toISOString().split('T')[0];
  const query = `
    INSERT INTO attendance (student_id, date, status)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE status = VALUES(status)
  `;
  db.query(query, [student_id, date, status], err => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.status(201).json({ message: 'Attendance marked successfully' });
  });
});

app.get('/attendance/:student_id', verifyToken, (req, res) => {
  const studentId = req.params.student_id;
  const query = 'SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date DESC';
  db.query(query, [studentId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json(results);
  });
});

// ------------------- Start Server -------------------
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
