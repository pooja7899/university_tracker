// index.js
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'dev_secret_key';

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// MySQL connection
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'university_tracker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper: query -> Promise
function q(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

// JWT middleware
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'Token missing' });
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

// Role guard
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(403).json({ error: 'No user' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// Basic root
app.get('/', (req, res) => res.send('✅ University Tracker Backend running'));

// ---------- Auth ----------
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const results = await q('SELECT * FROM users WHERE email = ?', [email]);
    if (results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = results[0];

    const match = await bcrypt.compare(password, user.password);
    console.log('Password match:', match);

    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, email: user.email, role: user.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});
// ---------- Students CRUD ----------
app.get('/students', verifyToken, async (req, res) => {
  try {
    const students = await q('SELECT * FROM students ORDER BY id DESC');
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/students', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, enrollment_year } = req.body;
    if (!name || !email || !enrollment_year)
      return res.status(400).json({ error: 'All fields required' });

    const result = await q(
      'INSERT INTO students (name, email, enrollment_year) VALUES (?, ?, ?)',
      [name, email, enrollment_year]
    );
    res.status(201).json({ id: result.insertId, name, email, enrollment_year });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/students/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { name, email, enrollment_year } = req.body;
    await q(
      'UPDATE students SET name=?, email=?, enrollment_year=? WHERE id=?',
      [name, email, enrollment_year, id]
    );
    res.json({ message: 'Student updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/students/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await q('DELETE FROM students WHERE id=?', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- Attendance ----------
app.post('/attendance', verifyToken, async (req, res) => {
  try {
    const { student_id, status } = req.body;
    if (!student_id || !status)
      return res.status(400).json({ error: 'Missing fields' });

    const date = new Date().toISOString().split('T')[0];
    await q(
      `INSERT INTO attendance (student_id, date, status)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status)`,
      [student_id, date, status]
    );
    res.status(201).json({ message: 'Attendance recorded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/attendance/:student_id', verifyToken, async (req, res) => {
  try {
    const studentId = req.params.student_id;
    const rows = await q(
      'SELECT date, status FROM attendance WHERE student_id=? ORDER BY date DESC',
      [studentId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- Classes ----------
app.get('/classes', verifyToken, async (req, res) => {
  try {
    const data = await q('SELECT * FROM classes ORDER BY schedule_day, start_time');
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/classes', verifyToken, async (req, res) => {
  if (req.user.role !== 'faculty' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Only faculty or admin can create classes' });

  try {
    const { course_name, schedule_day, start_time, end_time } = req.body;
    await q(
      'INSERT INTO classes (course_name, faculty_id, schedule_day, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
      [course_name, req.user.id, schedule_day, start_time, end_time]
    );
    res.status(201).json({ message: 'Class created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Create lecture
app.post('/lectures', verifyToken, async (req, res) => {
  if (req.user.role !== 'faculty' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Only faculty or admin can create lectures' });

  const { class_id, topic, lecture_date } = req.body;
  if (!class_id || !topic || !lecture_date)
    return res.status(400).json({ error: 'Missing fields' });

  try {
    await q('INSERT INTO lectures (class_id, topic, lecture_date) VALUES (?, ?, ?)', [class_id, topic, lecture_date]);
    res.status(201).json({ message: 'Lecture created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get lectures for a class
app.get('/lectures/:class_id', verifyToken, async (req, res) => {
  try {
    const rows = await q('SELECT * FROM lectures WHERE class_id = ? ORDER BY lecture_date DESC', [req.params.class_id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Create assignment
app.post('/assignments', verifyToken, async (req, res) => {
  if (req.user.role !== 'faculty' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Only faculty or admin can create assignments' });

  const { class_id, title, description, due_date } = req.body;
  if (!class_id || !title || !due_date)
    return res.status(400).json({ error: 'Missing fields' });

  try {
    await q('INSERT INTO assignments (class_id, title, description, due_date) VALUES (?, ?, ?, ?)', [class_id, title, description, due_date]);
    res.status(201).json({ message: 'Assignment created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get assignments for a class
app.get('/assignments/:class_id', verifyToken, async (req, res) => {
  try {
    const rows = await q('SELECT * FROM assignments WHERE class_id = ? ORDER BY due_date ASC', [req.params.class_id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit assignment
app.post('/submissions', verifyToken, async (req, res) => {
  if (req.user.role !== 'student')
    return res.status(403).json({ error: 'Only students can submit assignments' });

  const { assignment_id, file_url } = req.body;
  if (!assignment_id || !file_url)
    return res.status(400).json({ error: 'Missing fields' });

  try {
    const student = await q('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (student.length === 0) return res.status(404).json({ error: 'Student not found' });

    await q('INSERT INTO submissions (assignment_id, student_id, submitted_at, file_url) VALUES (?, ?, NOW(), ?)', [assignment_id, student[0].id, file_url]);
    res.status(201).json({ message: 'Submission successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


app.get('/dashboard', verifyToken, async (req, res) => {
  try {
    if (req.user.role === 'faculty') {
      const classes = await q('SELECT * FROM classes WHERE faculty_id = ?', [req.user.id]);
      const assignments = await q(`
        SELECT a.*, c.course_name 
        FROM assignments a 
        JOIN classes c ON a.class_id = c.id 
        WHERE c.faculty_id = ?`, [req.user.id]);
      res.json({ classes, assignments });
    } else if (req.user.role === 'student') {
      const student = await q('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (student.length === 0) return res.status(404).json({ error: 'Student not found' });

      const attendance = await q('SELECT * FROM attendance WHERE student_id = ?', [student[0].id]);
      const submissions = await q('SELECT * FROM submissions WHERE student_id = ?', [student[0].id]);
      res.json({ attendance, submissions });
    } else {
      res.status(403).json({ error: 'Dashboard not available for this role' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Grade submission
app.put('/submissions/:id/grade', verifyToken, async (req, res) => {
  if (req.user.role !== 'faculty' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Only faculty or admin can grade' });

  const { grade } = req.body;
  try {
    await q('UPDATE submissions SET grade = ? WHERE id = ?', [grade, req.params.id]);
    res.json({ message: 'Graded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- Stats & Trends ----------
app.get('/attendance/stats', verifyToken, async (req, res) => {
  try {
    const totalStudentsRes = await q('SELECT COUNT(*) AS total FROM students');
    const totalAttendanceRes = await q('SELECT COUNT(*) AS total FROM attendance');
    const presentRes = await q("SELECT COUNT(*) AS presentCount FROM attendance WHERE status='Present'");

    const totalStudents = totalStudentsRes[0]?.total || 0;
    const totalAttendance = totalAttendanceRes[0]?.total || 0;
    const presentCount = presentRes[0]?.presentCount || 0;
    const avgPercentage = totalAttendance === 0 ? 0 : Math.round((presentCount / totalAttendance) * 10000) / 100;

    res.json({ totalStudents, totalAttendance, presentCount, avgPercentage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/attendance/trends', verifyToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const rows = await q(
      `SELECT date, 
              SUM(status='Present') AS present, 
              COUNT(*) AS total
       FROM attendance
       WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY date
       ORDER BY date ASC`,
      [days]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- Comments / Notes ----------
app.post('/comments', verifyToken, async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'Missing fields' });

    const result = await q(
      'INSERT INTO comments (title, body, created_by) VALUES (?, ?, ?)',
      [title, body, req.user.email || req.user.id]
    );
        res.status(201).json({ id: result.insertId, title, body });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/comments', verifyToken, async (req, res) => {
  try {
    const rows = await q(
      'SELECT id, title, body, created_by, created_at FROM comments ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- Start ----------
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});





