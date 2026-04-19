const { pool } = require('../config/db');

const getWorkspaces = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 12);
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM workspaces WHERE user_id = ?',
      [req.user.id]
    );

    const [rows] = await pool.query(
      `SELECT w.*, COUNT(p.id) as project_count 
       FROM workspaces w 
       LEFT JOIN projects p ON p.workspace_id = w.id 
       WHERE w.user_id = ? 
       GROUP BY w.id 
       ORDER BY w.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );

    res.json({
      data: rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const createWorkspace = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Workspace name is required' });
    if (name.length > 150) return res.status(400).json({ message: 'Workspace name must be 150 characters or less' });
    if (description && description.length > 500) return res.status(400).json({ message: 'Description must be 500 characters or less' });

    const [result] = await pool.query(
      'INSERT INTO workspaces (user_id, name, description) VALUES (?, ?, ?)',
      [req.user.id, name, description || null]
    );

    const [rows] = await pool.query('SELECT * FROM workspaces WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteWorkspace = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM workspaces WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Workspace not found' });

    await pool.query('DELETE FROM workspaces WHERE id = ?', [req.params.id]);
    res.json({ message: 'Workspace deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getWorkspaces, createWorkspace, deleteWorkspace };
