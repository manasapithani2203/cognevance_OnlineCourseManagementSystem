import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function call(path, method = 'GET', body, token) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: 'The server returned an invalid response.' };
  }

  if (!response.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}

export default function App() {
  const [auth, setAuth] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('auth') || 'null');
    } catch {
      localStorage.removeItem('auth');
      return null;
    }
  });
  const [view, setView] = useState('catalog');

  const saveAuth = (value) => {
    setAuth(value);
    if (value) localStorage.setItem('auth', JSON.stringify(value));
    else localStorage.removeItem('auth');
    setView('catalog');
  };

  const admin = auth?.user?.role === 'admin';

  return (
    <>
      <nav>
        <b>Course Hub</b>
        <button className="ghost" onClick={() => setView('catalog')}>Courses</button>
        {auth && !admin && (
          <button className="ghost" onClick={() => setView('mine')}>My learning</button>
        )}
        {admin && (
          <button className="ghost" onClick={() => setView('admin')}>Admin</button>
        )}
        {auth ? (
          <button onClick={() => saveAuth(null)}>Log out ({auth.user.name})</button>
        ) : (
          <button onClick={() => setView('login')}>Log in</button>
        )}
      </nav>

      <main>
        {view === 'login' && <Auth done={saveAuth} />}
        {view === 'catalog' && <Catalog token={auth?.token} />}
        {view === 'mine' && auth && !admin && <Mine token={auth.token} />}
        {view === 'admin' && admin && <Admin token={auth.token} />}
      </main>
    </>
  );
}

function Auth({ done }) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onChange = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async () => {
    setError('');
    const email = String(form.email || '').trim();
    const password = String(form.password || '');

    if (register && String(form.name || '').trim().length < 2) {
      return setError('Enter your name.');
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return setError('Enter a valid email.');
    }
    if (password.length < 6) {
      return setError('Password needs at least 6 characters.');
    }

    setBusy(true);
    try {
      const data = await call(
        `/api/auth/${register ? 'register' : 'login'}`,
        'POST',
        { ...form, email, password }
      );
      done(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form">
      <h2>{register ? 'Create account' : 'Log in'}</h2>
      {register && <input placeholder="Name" maxLength="80" onChange={onChange('name')} />}
      <input type="email" placeholder="Email" autoComplete="email" onChange={onChange('email')} />
      <input
        type="password"
        placeholder="Password"
        autoComplete={register ? 'new-password' : 'current-password'}
        onChange={onChange('password')}
      />
      {register && (
        <input
          placeholder="Admin code (optional)"
          type="password"
          autoComplete="off"
          onChange={onChange('adminCode')}
        />
      )}
      {error && <span className="err">{error}</span>}
      <button disabled={busy} onClick={submit}>
        {busy ? 'Please wait…' : register ? 'Sign up' : 'Log in'}
      </button>
      <button className="ghost" onClick={() => { setRegister(!register); setError(''); }}>
        {register ? 'I already have an account' : 'Create an account'}
      </button>
    </div>
  );
}

function Catalog({ token }) {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('');
  const [list, setList] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setMessage('');
      try {
        const params = new URLSearchParams({ search: query, level });
        setList(await call(`/api/courses?${params}`));
      } catch (err) {
        setMessage(err.message);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, level]);

  const enroll = async (courseId) => {
    if (!token) return setMessage('Log in to enroll.');
    try {
      await call('/api/enrollments', 'POST', { courseId }, token);
      setMessage('Enrolled successfully. Open My learning to start.');
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <>
      <div className="row">
        <input
          placeholder="Search courses"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select value={level} onChange={(event) => setLevel(event.target.value)}>
          <option value="">All levels</option>
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Advanced">Advanced</option>
        </select>
      </div>

      {message && <p>{message}</p>}
      {loading && <p>Loading courses…</p>}
      {!loading && !list.length && <p>No courses found.</p>}

      <div className="grid">
        {list.map((course) => (
          <div className="card" key={course._id}>
            <h3>{course.title}</h3>
            <p>{course.description || 'No description provided.'}</p>
            <small>
              {course.category || 'General'} · {course.level} · {course.lessons.length} lessons
            </small>
            <br /><br />
            <button onClick={() => enroll(course._id)}>Enroll</button>
          </div>
        ))}
      </div>
    </>
  );
}

function Mine({ token }) {
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setError('');
    try {
      setList(await call('/api/enrollments/me', 'GET', undefined, token));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleLesson = async (enrollmentId, lessonIndex) => {
    try {
      await call(
        `/api/enrollments/${enrollmentId}/progress`,
        'PATCH',
        { lessonIndex },
        token
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <h2>My learning</h2>
      {error && <p className="err">{error}</p>}
      {loading && <p>Loading your courses…</p>}
      {!loading && !list.length && <p>You have not enrolled in any course yet.</p>}

      {list.map((enrollment) => (
        <div className="card" key={enrollment._id} style={{ marginBottom: 12 }}>
          <h3>{enrollment.course?.title || 'Course unavailable'}</h3>
          {enrollment.course ? (
            <>
              <div className="bar">
                <i style={{ width: `${enrollment.progress}%` }} />
              </div>
              <small>{enrollment.progress}% complete</small>
              {enrollment.course.lessons.map((lesson, index) => (
                <div key={index}>
                  <label>
                    <input
                      type="checkbox"
                      checked={enrollment.completed.includes(index)}
                      onChange={() => toggleLesson(enrollment._id, index)}
                    />
                    {' '}{lesson.title}
                  </label>
                </div>
              ))}
            </>
          ) : (
            <p>This course is no longer available.</p>
          )}
        </div>
      ))}
    </>
  );
}

function Admin({ token }) {
  const emptyForm = { level: 'Beginner', title: '', description: '', category: '', lessons: '' };
  const [stats, setStats] = useState({});
  const [list, setList] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const [newStats, courses] = await Promise.all([
        call('/api/admin/stats', 'GET', undefined, token),
        call('/api/courses')
      ]);
      setStats(newStats);
      setList(courses);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const onChange = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const saveCourse = async () => {
    setError('');
    setMessage('');

    const lessons = String(form.lessons || '')
      .split(',')
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title) => ({ title }));

    if (!form.title.trim()) return setError('Title is required.');
    if (!lessons.length) return setError('Add at least one lesson.');

    try {
      await call(
        editingId ? `/api/courses/${editingId}` : '/api/courses',
        editingId ? 'PUT' : 'POST',
        { ...form, lessons },
        token
      );
      resetForm();
      setMessage(editingId ? 'Course updated.' : 'Course added.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const editCourse = (course) => {
    setEditingId(course._id);
    setForm({
      title: course.title,
      description: course.description || '',
      category: course.category || '',
      level: course.level,
      lessons: course.lessons.map((lesson) => lesson.title).join(', ')
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteCourse = async (id) => {
    if (!window.confirm('Delete this course and all related enrollments?')) return;
    try {
      await call(`/api/courses/${id}`, 'DELETE', undefined, token);
      setMessage('Course deleted.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <h2>Admin dashboard</h2>
      <p>
        Users: {stats.users ?? 0} · Courses: {stats.courses ?? 0} ·
        {' '}Enrollments: {stats.enrollments ?? 0}
      </p>

      <div className="form">
        <h3>{editingId ? 'Edit course' : 'Add course'}</h3>
        <input placeholder="Title" value={form.title} onChange={onChange('title')} />
        <textarea placeholder="Description" value={form.description} onChange={onChange('description')} />
        <input placeholder="Category" value={form.category} onChange={onChange('category')} />
        <select value={form.level} onChange={onChange('level')}>
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </select>
        <input
          placeholder="Lessons, separated by commas"
          value={form.lessons}
          onChange={onChange('lessons')}
        />
        {error && <span className="err">{error}</span>}
        {message && <span>{message}</span>}
        <div className="row">
          <button onClick={saveCourse}>{editingId ? 'Update course' : 'Add course'}</button>
          {editingId && <button className="ghost" onClick={resetForm}>Cancel</button>}
        </div>
      </div>

      <br />
      {list.map((course) => (
        <div className="card admin-course" key={course._id}>
          <strong>{course.title}</strong>
          <span>
            <button className="ghost" onClick={() => editCourse(course)}>Edit</button>
            <button className="danger" onClick={() => deleteCourse(course._id)}>Delete</button>
          </span>
        </div>
      ))}
    </>
  );
}
