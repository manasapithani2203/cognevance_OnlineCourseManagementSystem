const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' }
  },
  { timestamps: true }
);

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000 },
    category: { type: String, trim: true, maxlength: 80 },
    level: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
      default: 'Beginner'
    },
    lessons: {
      type: [{ title: { type: String, required: true, trim: true, maxlength: 200 } }],
      validate: {
        validator: (lessons) => lessons.length > 0,
        message: 'A course must contain at least one lesson.'
      }
    }
  },
  { timestamps: true }
);

const enrollmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    completed: { type: [Number], default: [] },
    progress: { type: Number, default: 0, min: 0, max: 100 }
  },
  { timestamps: true }
);

enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);
const Enrollment =
  mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema);

module.exports = { User, Course, Enrollment };
