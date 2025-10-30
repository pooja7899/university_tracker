// src/App.js
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./Dashboard.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { saveAs } from "file-saver";

// ------------------ LOGIN ------------------
function Login({ setToken, setRole }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    console.log("Sending login:", { email, password }); // Log before the request

    axios
      .post("http://localhost:5000/login", { email, password }) // Use state values
      .then((res) => {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("role", res.data.role);
        setToken(res.data.token);
        setRole(res.data.role);
        toast.success("Login successful!");
      })
      .catch((err) => {
        const msg = err.response?.data?.error || "Login failed";
        toast.error(msg);
      });
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>University Tracker Login</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleLogin}>Login</button>
        <p className="demo-info">
          Demo credentials: <br />
          <strong>admin@example.com</strong> / <strong>password123</strong>
        </p>
      </div>
    </div>
  );
}

// ------------------ DASHBOARD ------------------
function Dashboard({ token, role, setToken, setRole }) {
  const [students, setStudents] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    enrollment_year: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalAttendance: 0,
    avgPercentage: 0,
  });
  const [comments, setComments] = useState([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

  const getHeaders = useCallback(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // ---------------- FETCH STUDENTS ----------------
  const fetchStudents = useCallback(() => {
    axios
      .get("http://localhost:5000/students", { headers: getHeaders() })
      .then((res) => setStudents(res.data))
      .catch(() => toast.error("Failed to fetch students"));
  }, [getHeaders]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // ---------------- FETCH STATS ----------------
  const fetchStats = useCallback(() => {
    axios
      .get("http://localhost:5000/attendance/stats", { headers: getHeaders() })
      .then((res) => setStats(res.data))
      .catch(() => toast.error("Failed to fetch stats"));
  }, [getHeaders]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ---------------- FETCH COMMENTS ----------------
  const fetchComments = useCallback(() => {
    axios
      .get("http://localhost:5000/comments", { headers: getHeaders() })
      .then((res) => setComments(res.data))
      .catch(() => toast.error("Failed to fetch comments"));
  }, [getHeaders]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // ---------------- LOGOUT ----------------
  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
    setRole(null);
  };

  // ---------------- FORM HANDLERS ----------------
  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const headers = getHeaders();

    if (role !== "admin") {
      toast.info("Only admin can add or edit students");
      return;
    }

    const request = editingId
      ? axios.put(`http://localhost:5000/students/${editingId}`, formData, {
          headers,
        })
      : axios.post("http://localhost:5000/students", formData, { headers });

    request
      .then(() => {
        toast.success(editingId ? "Student updated" : "Student added");
        fetchStudents();
        setFormData({ name: "", email: "", enrollment_year: "" });
        setEditingId(null);
      })
      .catch(() => toast.error("Operation failed"));
  };

  const handleDelete = (id) => {
    if (role !== "admin") {
      toast.info("Only admin can delete students");
      return;
    }

    axios
      .delete(`http://localhost:5000/students/${id}`, { headers: getHeaders() })
      .then(() => {
        toast.success("Student deleted");
        fetchStudents();
      })
      .catch(() => toast.error("Failed to delete student"));
  };

  const markAttendance = (studentId, status) => {
    axios
      .post(
        "http://localhost:5000/attendance",
        { student_id: studentId, status },
        { headers: getHeaders() }
      )
      .then(() => {
        toast.success(`Marked ${status}`);
        fetchStats();
      })
      .catch(() => toast.error("Failed to mark attendance"));
  };

  const viewAttendance = (studentId) => {
    axios
      .get(`http://localhost:5000/attendance/${studentId}`, {
        headers: getHeaders(),
      })
      .then((res) => {
        const history = res.data;
        if (!history.length) toast.info("No attendance records found");
        else alert(history.map((h) => `${h.date}: ${h.status}`).join("\n"));
      })
      .catch(() => toast.error("Failed to fetch attendance"));
  };

  const postComment = () => {
    if (!noteTitle || !noteBody) return toast.error("Write title & body");
    axios
      .post(
        "http://localhost:5000/comments",
        { title: noteTitle, body: noteBody },
        { headers: getHeaders() }
      )
      .then(() => {
        toast.success("Note added");
        setNoteTitle("");
        setNoteBody("");
        fetchComments();
      })
      .catch(() => toast.error("Failed to add note"));
  };

  const handleExport = () => {
    const payload = { students, stats, comments };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    saveAs(blob, "university_tracker_export.json");
    toast.success("Exported JSON");
  };

  // ---------------- RENDER ----------------
  return (
    <div className="container">
      <ToastContainer position="top-right" autoClose={3000} />
      <h1>University Tracker Dashboard</h1>
      <button onClick={handleLogout}>Logout</button>

      {/* Stats Section */}
      <div className="stats-cards">
        <div className="card">
          <h4>Total Students</h4>
          <p className="big">{stats.totalStudents}</p>
        </div>
        <div className="card">
          <h4>Total Attendance</h4>
          <p className="big">{stats.totalAttendance}</p>
        </div>
        <div className="card">
          <h4>Average Attendance</h4>
          <p className="big">{stats.avgPercentage}%</p>
        </div>
        <div className="card">
          <h4>Actions</h4>
          <button onClick={handleExport}>Export JSON</button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {role === "admin" && (
        <form onSubmit={handleSubmit} className="student-form">
          <input
            name="name"
            value={formData.name}
            placeholder="Name"
            onChange={handleChange}
            required
          />
          <input
            name="email"
            value={formData.email}
            placeholder="Email"
            onChange={handleChange}
            required
          />
          <input
            name="enrollment_year"
            value={formData.enrollment_year}
            placeholder="Year"
            onChange={handleChange}
            required
          />
          <button type="submit">
            {editingId ? "Update" : "Add"} Student
          </button>
        </form>
      )}

      {/* Students Table */}
      <table className="students-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Year</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.name}</td>
              <td>{s.email}</td>
              <td>{s.enrollment_year}</td>
              <td>
                {role === "admin" && (
                  <>
                    <button onClick={() => setEditingId(s.id)}>Edit</button>
                    <button onClick={() => handleDelete(s.id)}>Delete</button>
                  </>
                )}
                <select
                  onChange={(e) => markAttendance(s.id, e.target.value)}
                  defaultValue=""
                >
                  <option value="">Mark</option>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                </select>
                <button onClick={() => viewAttendance(s.id)}>View</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Notes Section */}
      <div className="notes-section">
        <h3>Notes / Comments</h3>
        <input
          placeholder="Note Title"
          value={noteTitle}
          onChange={(e) => setNoteTitle(e.target.value)}
        />
        <textarea
          placeholder="Note Body"
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
        />
        <button onClick={postComment}>Add Note</button>

        <ul className="comments-list">
          {comments.map((c) => (
            <li key={c.id}>
              <strong>{c.title}</strong>: {c.body}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ------------------ MAIN APP ------------------
function App() {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role");
    if (storedToken) setToken(storedToken);
    if (storedRole) setRole(storedRole);
  }, []);

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
      {!token ? (
        <Login setToken={setToken} setRole={setRole} />
      ) : (
        <Dashboard
          token={token}
          role={role}
          setToken={setToken}
          setRole={setRole}
        />
      )}
    </>
  );
}

export default App;

