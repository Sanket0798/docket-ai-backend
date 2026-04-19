const { pool } = require('../config/db');

const getOnboarding = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM onboarding WHERE user_id = ?',
      [req.user.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const saveOnboarding = async (req, res) => {
  try {
    const { project_type, scenes_elements, ai_assistance, completed } = req.body;

    const [existing] = await pool.query(
      'SELECT id FROM onboarding WHERE user_id = ?',
      [req.user.id]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE onboarding SET project_type = ?, scenes_elements = ?, ai_assistance = ?, completed = ? WHERE user_id = ?`,
        [project_type, scenes_elements, ai_assistance, completed || false, req.user.id]
      );
    } else {
      await pool.query(
        `INSERT INTO onboarding (user_id, project_type, scenes_elements, ai_assistance, completed) VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, project_type, scenes_elements, ai_assistance, completed || false]
      );
    }

    res.json({ message: 'Onboarding saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getOnboarding, saveOnboarding };
