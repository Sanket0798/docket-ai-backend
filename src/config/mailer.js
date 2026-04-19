const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTPEmail = async (to, otp) => {
  await transporter.sendMail({
    from: `"Docket Factory" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Your Docket Factory OTP',
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px;">
        <h2 style="color:#111;">Email Verification</h2>
        <p>Your OTP code is:</p>
        <h1 style="letter-spacing:8px;color:#6366f1;">${otp}</h1>
        <p style="color:#888;font-size:13px;">This code expires in 10 minutes.</p>
      </div>
    `,
  });
};

module.exports = { sendOTPEmail };
