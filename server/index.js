require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Course, Enrollment } = require('./models');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

if (!process.env.MONGO_URI) console.warn('Warning: MONGO_URI is not configured.');
if (!process.env.JWT_SECRET) console.warn('Warning: JWT_SECRET is not configured.');
if (!process.env.ADMIN_CODE) console.warn('Warning: ADMIN_CODE is not configured.');

const allowedOrigin = process.env.CLIENT_URL || true;
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '100kb' }));

const signToken = (user) =>
  jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role
});

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Please log in.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only.' });
  }
  next();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateCourseInput(body) {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const category = String(body.category || '').trim();
  const level = String(body.level || 'Beginner').trim();
  const lessons = Array.isArray(body.lessons)
    ? body.lessons
        .map((lesson) => ({
          title: String(lesson?.title || '').trim()
        }))
        .filter((lesson) => lesson.title)
    : [];

  if (!title) throw new Error('Course title is required.');
  if (!['Beginner', 'Intermediate', 'Advanced'].includes(level)) {
    throw new Error('Invalid course level.');
  }
  if (lessons.length === 0) {
    throw new Error('Add at least one lesson.');
  }

  return { title, description, category, level, lessons };
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const adminCode = String(req.body.adminCode || '');

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ message: 'Name must be 2–80 characters.' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: 'Enter a valid email.' });
  }
  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ message: 'Password must be 6–128 characters.' });
  }

  const role =
    process.env.ADMIN_CODE &&
    adminCode &&
    adminCode === process.env.ADMIN_CODE
      ? 'admin'
      : 'student';

  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role
  });

  res.status(201).json({
    token: signToken(user),
    user: sanitizeUser(user)
  });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');

  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Wrong email or password.' });
  }

  res.json({
    token: signToken(user),
    user: sanitizeUser(user)
  });
}));

app.get('/api/courses', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const category = String(req.query.category || '').trim();
  const level = String(req.query.level || '').trim();
  const filter = {};

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
      { category: { $regex: escaped, $options: 'i' } }
    ];
  }
  if (category) filter.category = category;
  if (level) filter.level = level;

  res.json(await Course.find(filter).sort({ createdAt: -1 }));
}));

app.get('/api/courses/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid course ID.' });
  }

  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found.' });

  res.json(course);
}));

app.post('/api/courses', protect, adminOnly, asyncHandler(async (req, res) => {
  const course = await Course.create(validateCourseInput(req.body));
  res.status(201).json(course);
}));

app.put('/api/courses/:id', protect, adminOnly, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid course ID.' });
  }

  const update = validateCourseInput(req.body);
  const previous = await Course.findById(req.params.id);
  if (!previous) return res.status(404).json({ message: 'Course not found.' });

  const lessonsChanged =
    JSON.stringify(previous.lessons.map((lesson) => lesson.title)) !==
    JSON.stringify(update.lessons.map((lesson) => lesson.title));

  const course = await Course.findByIdAndUpdate(
    req.params.id,
    update,
    { new: true, runValidators: true }
  );

  if (lessonsChanged) {
    // Lesson indexes are stored in enrollments, so changing the curriculum
    // invalidates old completion indexes. Start progress fresh.
    await Enrollment.updateMany(
      { course: course._id },
      { $set: { completed: [], progress: 0 } }
    );
  }

  res.json(course);
}));

app.delete('/api/courses/:id', protect, adminOnly, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid course ID.' });
  }

  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found.' });

  await Enrollment.deleteMany({ course: course._id });
  res.json({ message: 'Course deleted successfully.' });
}));

app.post('/api/enrollments', protect, asyncHandler(async (req, res) => {
  const courseId = req.body.courseId;

  if (!mongoose.isValidObjectId(courseId)) {
    return res.status(400).json({ message: 'Invalid course ID.' });
  }

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: 'Course not found.' });

  const existing = await Enrollment.findOne({
    user: req.user.id,
    course: courseId
  });

  if (existing) {
    return res.status(409).json({ message: 'You are already enrolled in this course.' });
  }

  const enrollment = await Enrollment.create({
    user: req.user.id,
    course: courseId
  });

  res.status(201).json(await enrollment.populate('course'));
}));

app.get('/api/enrollments/me', protect, asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ user: req.user.id })
    .populate('course')
    .sort({ createdAt: -1 });

  res.json(enrollments);
}));

app.patch('/api/enrollments/:id/progress', protect, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid enrollment ID.' });
  }

  const lessonIndex = Number(req.body.lessonIndex);
  if (!Number.isInteger(lessonIndex) || lessonIndex < 0) {
    return res.status(400).json({ message: 'Invalid lesson index.' });
  }

  const enrollment = await Enrollment.findOne({
    _id: req.params.id,
    user: req.user.id
  }).populate('course');

  if (!enrollment || !enrollment.course) {
    return res.status(404).json({ message: 'Enrollment not found.' });
  }

  if (lessonIndex >= enrollment.course.lessons.length) {
    return res.status(400).json({ message: 'Lesson does not exist.' });
  }

  const completed = new Set(enrollment.completed);
  if (completed.has(lessonIndex)) {
    completed.delete(lessonIndex);
  } else {
    completed.add(lessonIndex);
  }

  enrollment.completed = [...completed].sort((a, b) => a - b);
  enrollment.progress =
    enrollment.course.lessons.length === 0
      ? 0
      : Math.round(
          (enrollment.completed.length / enrollment.course.lessons.length) * 100
        );

  await enrollment.save();
  res.json(enrollment);
}));

app.get('/api/admin/stats', protect, adminOnly, asyncHandler(async (req, res) => {
  const [users, courses, enrollments] = await Promise.all([
    User.countDocuments(),
    Course.countDocuments(),
    Enrollment.countDocuments()
  ]);

  res.json({ users, courses, enrollments });
}));

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found.' });
});

app.use((err, req, res, next) => {
  console.error(err);

  if (err.code === 11000) {
    return res.status(409).json({ message: 'An account or enrollment already exists.' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }

  res.status(500).json({ message: 'Internal server error.' });
});

async function start() {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    throw new Error('MONGO_URI and JWT_SECRET must be configured.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(`Startup failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = app;
