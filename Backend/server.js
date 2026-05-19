import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from './db/index.js';
import { users, complaints } from './db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import 'dotenv/config';
import morgan from 'morgan';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    'http://127.0.0.1:5500', 
    'http://localhost:5500', 
    'https://likbalpande.github.io',
    'https://likbalpande.github.io/Complaints-Registration-Platform-Full-Stack/Frontend/'
  ],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// Resend setup
const resend = new Resend(process.env.RESEND_API_KEY);

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Forbidden' });
    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// --- Auth Routes ---

// POST /api/auth/send-otp
app.post('/api/auth/send-otp', async (req, res) => {
  console.log('[ENTRY] POST /api/auth/send-otp - Request received');
  const { name, email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  try {
    // Check if user exists and is verified
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser && existingUser.is_verified) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    if (existingUser) {
      // Update existing unverified user
      await db.update(users)
        .set({ name, otp, otp_expiry: expiry })
        .where(eq(users.email, email));
    } else {
      // Create new unverified user
      await db.insert(users).values({
        name,
        email,
        password: '', // Will be set during registration
        otp,
        otp_expiry: expiry,
        is_verified: false,
      });
    }

    // Send OTP email
    await resend.emails.send({
      from: 'info@likhilesh-tutorials.shop',
      to: email,
      subject: 'Your Registration OTP',
      text: `Your OTP for registration is: ${otp}. It expires in 10 minutes.`,
    });

    console.log('[EXIT] POST /api/auth/send-otp - OTP sent successfully');
    res.json({ message: 'OTP sent to email' });
  } catch (error) {
    console.error('[ERROR] POST /api/auth/send-otp:', error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  console.log('[ENTRY] POST /api/auth/register - Request received');
  const { email, otp, password } = req.body;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (new Date() > user.otp_expiry) return res.status(400).json({ message: 'OTP expired' });

    await db.update(users)
      .set({
        password, // Plain text as requested
        is_verified: true,
        otp: null,
        otp_expiry: null,
      })
      .where(eq(users.email, email));

    console.log('[EXIT] POST /api/auth/register - Registration successful');
    res.json({ message: 'Registration successful' });
  } catch (error) {
    console.error('[ERROR] POST /api/auth/register:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  console.log('[ENTRY] POST /api/auth/login - Request received');
  const { email, password } = req.body;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !user.is_verified || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });

    console.log('[EXIT] POST /api/auth/login - Login successful');
    res.json({ name: user.name, email: user.email, role: user.role });
  } catch (error) {
    console.error('[ERROR] POST /api/auth/login:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  console.log('[ENTRY] POST /api/auth/logout - Request received');
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });
  console.log('[EXIT] POST /api/auth/logout - Logged out successfully');
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
app.get('/api/auth/me', authenticateToken, (req, res) => {
  console.log('[ENTRY] GET /api/auth/me - Request received');
  console.log('[EXIT] GET /api/auth/me - Returning user info');
  res.json(req.user);
});

// --- Complaint Routes ---

// POST /api/ai/question
app.post('/api/ai/question', authenticateToken, async (req, res) => {
  console.log('[ENTRY] POST /api/ai/question - Request received');
  const { complaint_text } = req.body;

  try {
    const prompt = `You are a helpful assistant for a complaint registration platform. Given the following complaint, generate exactly one short, relevant follow-up question to gather more details. Return only the question text.\n\nComplaint: ${complaint_text}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('[EXIT] POST /api/ai/question - Question generated successfully');
    res.json({ question: text.trim() });
  } catch (error) {
    console.error('[ERROR] POST /api/ai/question:', error);
    res.status(500).json({ message: 'Failed to generate AI question' });
  }
});

// POST /api/complaints
app.post('/api/complaints', authenticateToken, async (req, res) => {
  console.log('[ENTRY] POST /api/complaints - Request received');
  const { complaint_text, ai_question, ai_answer } = req.body;

  try {
    const [newComplaint] = await db.insert(complaints).values({
      userId: req.user.id,
      complaintText: complaint_text,
      aiQuestion: ai_question,
      userAnswer: ai_answer,
    }).returning();

    console.log('[EXIT] POST /api/complaints - Complaint saved successfully');
    res.json(newComplaint);
  } catch (error) {
    console.error('[ERROR] POST /api/complaints:', error);
    res.status(500).json({ message: 'Failed to save complaint' });
  }
});

// GET /api/complaints/my
app.get('/api/complaints/my', authenticateToken, async (req, res) => {
  console.log('[ENTRY] GET /api/complaints/my - Request received');
  try {
    const userComplaints = await db.query.complaints.findMany({
      where: eq(complaints.userId, req.user.id),
      orderBy: [desc(complaints.createdAt)],
    });
    console.log('[EXIT] GET /api/complaints/my - Complaints fetched successfully');
    res.json(userComplaints);
  } catch (error) {
    console.error('[ERROR] GET /api/complaints/my:', error);
    res.status(500).json({ message: 'Failed to fetch complaints' });
  }
});

// GET /api/admin/complaints
app.get('/api/admin/complaints', authenticateToken, isAdmin, async (req, res) => {
  console.log('[ENTRY] GET /api/admin/complaints - Request received');
  try {
    // Since I didn't define relations in schema.ts yet, let's do a join
    const results = await db.select({
      id: complaints.id,
      complaintText: complaints.complaintText,
      aiQuestion: complaints.aiQuestion,
      userAnswer: complaints.userAnswer,
      createdAt: complaints.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
      .from(complaints)
      .innerJoin(users, eq(complaints.userId, users.id))
      .orderBy(desc(complaints.createdAt));

    console.log('[EXIT] GET /api/admin/complaints - All complaints fetched successfully');
    res.json(results);
  } catch (error) {
    console.error('[ERROR] GET /api/admin/complaints:', error);
    res.status(500).json({ message: 'Failed to fetch all complaints' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
