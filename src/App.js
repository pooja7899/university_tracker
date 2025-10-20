import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Dashboard.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// ------------------ LOGIN COMPONENT ------------------
function Login({ setToken, setRole }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    axios
      .post('http://localhost:5000/login', { email, password })
      .then(res => {
        setToken(res.data.token);
        setRole(res.data.role);
        toast.success('Login successful');
      })
      .catch(() => toast.error('Login failed'));
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <input
        type="password"
        placeholder="Password"
        onChange={e => setPassword(e.target.value)}
      />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}

// ------------------ DASHBOARD COMPONENT ------------------
function Dashboard({ token }) {
  const [students, setStudents] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    enrollment_year: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [editingId, setEditingId] = useState(null);

  // ------------------ Fetch Students ------------------
  const fetchStudents = useCallback(() => {
    // For demo: populate with sample students
    const sampleStudents = [
      { id: 1, name: 'Alice', email: 'alice@example.com', enrollment_year: 2025 },
      { id: 2, name: 'Bob', email: 'bob@example.com', enrollment_year: 2024 },
      { id: 3, name: 'Charlie', email: 'charlie@example.com', enrollment_year: 2023 },
    ];
    setStudents(sampleStudents);

    // Uncomment below to fetch from backend once your token is valid
    /*
    axios
      .get('http://localhost:5000/students', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => setStudents([...res.data].reverse()))
      .catch(err => console.error('Error fetching students:', err));
    */
  }, [token]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // ------------------ Form Handlers ------------------
  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    if (editingId) {
      // Update student (backend call)
      axios
        .put(`http://localhost:5000/students/${editingId}`, formData, { headers })
        .then(() => {
          toast.success('Student updated');
          fetchStudents();
          setFormData({ name: '', email: '', enrollment_year: '' });
          setEditingId(null);
        })
        .catch(err => console.error(err));
    } else {
      // Add student (backend call)
      axios
        .post('http://localhost:5000/students', formData, { headers })
        .then(() => {
          toast.success('Student added');
          fetchStudents();
          setFormData({ name: '', email: '', enrollment_year: '' });
        })
        .catch(err => console.error(err));
    }
  };

  // ------------------ Other Handlers ------------------
  const handleEdit = student => {
    setFormData({
      name: student.name,
      email: student.email,
      enrollment_year: student.enrollment_year
    });
    setEditingId(student.id);
  };

  const handleDelete = id => {
    if (!token) {
      // For demo: remove locally
      setStudents(students.filter(s => s.id !== id));
      toast.info('Student deleted (demo)');
      return;
    }

    axios
      .delete(`http://localhost:5000/students/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(() => {
        toast.info('Student deleted');
        fetchStudents();
      })
      .catch(err => console.error(err));
  };

  const markAttendance = (studentId, status) => {
    if (!status) return;
    toast.success(`Marked ${status} for Student ${studentId} (demo)`);

    if (!token) return; // skip backend if dummy
    axios
      .post(
        'http://localhost:5000/attendance',
        { student_id: studentId, status },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .catch(err => console.error(err));
  };

  const viewAttendance = studentId => {
    if (!token) {
      alert(`Viewing attendance for Student ${studentId} (demo)`);
      return;
    }

    axios
      .get(`http://localhost:5000/attendance/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        const history = res.data;
        if (history.length === 0) {
          alert(`No attendance records found for Student ${studentId}`);
        } else {
          const formatted = history
            .map(entry => `${entry.date}: ${entry.status}`)
            .join('\n');
          alert(`Attendance for Student ${studentId}:\n\n${formatted}`);
        }
      })
      .catch(err => console.error(err));
  };

  // ------------------ Render ------------------
  return (
    <div className="container">
      <h1>University Tracker Dashboard</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          name="name"
          placeholder="Name"
          value={formData.name}
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />
        <input
          type="number"
          name="enrollment_year"
          placeholder="Enrollment Year"
          value={formData.enrollment_year}
          onChange={handleChange}
          required
        />
        <button type="submit" style={{ marginLeft: '10px' }}>
          {editingId ? 'Update Student' : 'Add Student'}
        </button>
      </form>

      <input
        type="text"
        placeholder="Search by name..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ marginBottom: '20px', padding: '10px', width: '300px', borderRadius: '6px', border: '1px solid #ccc' }}
      />

      <select
        value={yearFilter}
        onChange={e => setYearFilter(e.target.value)}
        style={{ marginLeft: '20px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
      >
        <option value="">All Years</option>
        <option value="2026">2026</option>
        <option value="2025">2025</option>
        <option value="2024">2024</option>
        <option value="2023">2023</option>
        <option value="2022">2022</option>
        <option value="2021">2021</option>
        <option value="2020">2020</option>
      </select>

      <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Enrollment Year</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {students
            .filter(
              s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
                (yearFilter === '' || s.enrollment_year.toString() === yearFilter)
            )
            .map(student => (
              <tr key={student.id}>
                <td>{student.id}</td>
                <td>{student.name}</td>
                <td>{student.email}</td>
                <td>{student.enrollment_year}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => handleEdit(student)}>Edit</button>
                    <button onClick={() => handleDelete(student.id)}>Delete</button>
                    <select onChange={e => markAttendance(student.id, e.target.value)}>
                      <option value="">Mark Attendance</option>
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                    </select>
                    <button onClick={() => viewAttendance(student.id)}>View</button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------ MAIN APP COMPONENT ------------------
function App() {
  // Temporary dummy token for testing
  const [token, setToken] = useState('dummy-token');
  const [role, setRole] = useState('admin');

  return (
    <>
      {!token ? (
        <Login setToken={setToken} setRole={setRole} />
      ) : (
        <Dashboard token={token} role={role} />
      )}
      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}

export default App;
