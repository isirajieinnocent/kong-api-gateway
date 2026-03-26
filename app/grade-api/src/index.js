const express = require('express');
const app = express();

app.use(express.json());

// In-memory store (stateless — resets on restart, matches the :stateless image behaviour)
const grades = [];

// GET /grades — return all grade submissions
app.get('/grades', (req, res) => {
  res.json({
    total: grades.length,
    grades,
  });
});

// POST /grades — submit a new grade
app.post('/grades', (req, res) => {
  const { student, subject, grade } = req.body;

  if (!student || !subject || grade === undefined) {
    return res.status(400).json({
      error: 'Missing required fields: student, subject, grade',
    });
  }

  if (typeof grade !== 'number' || grade < 0 || grade > 100) {
    return res.status(400).json({
      error: 'grade must be a number between 0 and 100',
    });
  }

  const entry = {
    id: grades.length + 1,
    student,
    subject,
    grade,
    submitted_at: new Date().toISOString(),
  };

  grades.push(entry);
  res.status(201).json(entry);
});

// Health check — Kong or load balancers can use this
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Grade API listening on port ${PORT}`);
});
