const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { sendOTPEmail } = require('../config/mailer');
require('dotenv').config();

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const generateToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const register = async (req, res) => {
  try {
    const { first_name, last_name, email, phone, company_name, password } = req.body;

    // Input validation
    if (!first_name || !last_name || !email || !password)
      return res.status(400).json({ message: 'First name, last name, email and password are required' });
    if (first_name.length > 50 || last_name.length > 50)
      return res.status(400).json({ message: 'Name must be 50 characters or less' });
    if (email.length > 150)
      return res.status(400).json({ message: 'Email must be 150 characters or less' });
    if (password.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    if (phone && phone.length > 20)
      return res.status(400).json({ message: 'Phone number must be 20 characters or less' });
    if (company_name && company_name.length > 150)
      return res.status(400).json({ message: 'Company name must be 150 characters or less' });

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (first_name, last_name, email, phone, company_name, password) VALUES (?, ?, ?, ?, ?, ?)',
      [first_name, last_name, email, phone || null, company_name || null, hashed]
    );

    const userId = result.insertId;
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'INSERT INTO otps (user_id, otp, type, expires_at) VALUES (?, ?, ?, ?)',
      [userId, otp, 'email', expiresAt]
    );

    // Try sending email — if it fails (e.g. no credentials), log OTP to console for dev
    try {
      await sendOTPEmail(email, otp);
    } catch (mailErr) {
      console.warn('Email sending failed (check .env credentials). DEV OTP:', otp);
    }

    res.status(201).json({ message: 'Registered successfully. Check your email for OTP.', userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' });

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0)
      return res.status(401).json({ message: 'Invalid credentials' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: 'Invalid credentials' });

    if (!user.is_email_verified)
      return res.status(403).json({ message: 'Please verify your email first', userId: user.id });

    const token = generateToken(user);
    const { password: _, ...userData } = user;

    // Check if onboarding is completed
    const [ob] = await pool.query(
      'SELECT completed FROM onboarding WHERE user_id = ?', [user.id]
    );
    const onboardingDone = ob.length > 0 && ob[0].completed;

    res.json({ token, user: userData, onboardingDone });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const verifyEmailOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp)
      return res.status(400).json({ message: 'userId and otp required' });

    const [rows] = await pool.query(
      'SELECT * FROM otps WHERE user_id = ? AND otp = ? AND type = ? AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [userId, otp, 'email']
    );

    if (rows.length === 0)
      return res.status(400).json({ message: 'Invalid or expired OTP' });

    await pool.query('UPDATE otps SET used = TRUE WHERE id = ?', [rows[0].id]);
    await pool.query('UPDATE users SET is_email_verified = TRUE WHERE id = ?', [userId]);

    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    const user = userRows[0];
    const token = generateToken(user);
    const { password: _, ...userData } = user;

    res.json({ message: 'Email verified successfully', token, user: userData, onboardingDone: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const resendOTP = async (req, res) => {
  try {
    const { userId } = req.body;
    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0)
      return res.status(404).json({ message: 'User not found' });

    const user = userRows[0];
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'INSERT INTO otps (user_id, otp, type, expires_at) VALUES (?, ?, ?, ?)',
      [userId, otp, 'email', expiresAt]
    );

    try {
      await sendOTPEmail(user.email, otp);
    } catch (mailErr) {
      console.warn('Email sending failed. DEV OTP:', otp);
    }
    res.json({ message: 'OTP resent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getMe = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, first_name, last_name, email, phone, company_name, credits, avatar_url, is_email_verified, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    // Always return success to prevent email enumeration
    if (rows.length === 0)
      return res.json({ message: 'If that email exists, an OTP has been sent.' });

    const userId = rows[0].id;
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'INSERT INTO otps (user_id, otp, type, expires_at) VALUES (?, ?, ?, ?)',
      [userId, otp, 'email', expiresAt]
    );

    try {
      await sendOTPEmail(email, otp);
    } catch {
      console.warn('Email sending failed. DEV Reset OTP:', otp);
    }

    res.json({ message: 'If that email exists, an OTP has been sent.', userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { userId, otp, newPassword } = req.body;
    if (!userId || !otp || !newPassword)
      return res.status(400).json({ message: 'userId, otp and newPassword are required' });

    if (newPassword.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters' });

    const [rows] = await pool.query(
      'SELECT * FROM otps WHERE user_id = ? AND otp = ? AND type = ? AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [userId, otp, 'email']
    );

    if (rows.length === 0)
      return res.status(400).json({ message: 'Invalid or expired OTP' });

    await pool.query('UPDATE otps SET used = TRUE WHERE id = ?', [rows[0].id]);
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Logout — client always clears localStorage; this endpoint exists so
// a future token blacklist (Redis) can be plugged in here without
// changing the frontend.
const logout = async (req, res) => {
  // Currently stateless — JWT will expire naturally.
  // To add a blacklist: store req.headers.authorization token in Redis with TTL = remaining JWT lifetime.
  res.json({ message: 'Logged out successfully' });
};

module.exports = { register, login, verifyEmailOTP, resendOTP, getMe, forgotPassword, resetPassword, logout };
