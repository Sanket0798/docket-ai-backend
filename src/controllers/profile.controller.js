const { pool } = require('../config/db');
const cloudinary = require('../config/cloudinary');

const getProfile = async (req, res) => {
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

const updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, phone, company_name } = req.body;
    if (!first_name || !last_name)
      return res.status(400).json({ message: 'First name and last name are required' });
    if (first_name.length > 50 || last_name.length > 50)
      return res.status(400).json({ message: 'Name must be 50 characters or less' });
    if (phone && phone.length > 20)
      return res.status(400).json({ message: 'Phone must be 20 characters or less' });
    if (company_name && company_name.length > 150)
      return res.status(400).json({ message: 'Company name must be 150 characters or less' });

    await pool.query(
      'UPDATE users SET first_name = ?, last_name = ?, phone = ?, company_name = ? WHERE id = ?',
      [first_name, last_name, phone || null, company_name || null, req.user.id]
    );
    res.json({ message: 'Profile updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Upload avatar — accepts multipart/form-data with field "avatar"
// Uses Cloudinary upload_stream so we don't need multer storage config here
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image file provided' });

    // Upload buffer to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'docket-factory/avatars',
          transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }],
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    await pool.query(
      'UPDATE users SET avatar_url = ? WHERE id = ?',
      [result.secure_url, req.user.id]
    );

    res.json({ message: 'Avatar updated', avatar_url: result.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to upload avatar' });
  }
};

module.exports = { getProfile, updateProfile, uploadAvatar };
