const { pool } = require('../config/db');

const getWishlist = async (req, res) => {
  try {
    const { search, sort } = req.query;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 12);
    const offset = (page - 1) * limit;

    let countQuery = `SELECT COUNT(*) as total FROM wishlist w LEFT JOIN projects p ON w.project_id = p.id WHERE w.user_id = ?`;
    let dataQuery  = `SELECT w.*, p.name as project_name FROM wishlist w LEFT JOIN projects p ON w.project_id = p.id WHERE w.user_id = ?`;
    const params = [req.user.id];

    if (search) {
      countQuery += ' AND p.name LIKE ?';
      dataQuery  += ' AND p.name LIKE ?';
      params.push(`%${search}%`);
    }

    const [[{ total }]] = await pool.query(countQuery, params);

    dataQuery += sort === 'oldest' ? ' ORDER BY w.created_at ASC' : ' ORDER BY w.created_at DESC';
    dataQuery += ' LIMIT ? OFFSET ?';

    const [rows] = await pool.query(dataQuery, [...params, limit, offset]);

    res.json({
      data: rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/wishlist — add item to wishlist
const addToWishlist = async (req, res) => {
  try {
    const { project_id, image_url, image_index, question_id, tags } = req.body;

    if (!project_id) {
      return res.status(400).json({ message: 'project_id is required' });
    }

    const [result] = await pool.query(
      'INSERT INTO wishlist (user_id, project_id, image_url, image_index, question_id, tags) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, project_id, image_url || null, image_index || 0, question_id || null, tags || null]
    );

    const [rows] = await pool.query('SELECT * FROM wishlist WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/wishlist/:id — remove item from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM wishlist WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Removed from wishlist' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/wishlist/:id/use — add wishlist item to a project
const useWishlistItem = async (req, res) => {
  try {
    const { target_project_id } = req.body;

    if (!target_project_id) {
      return res.status(400).json({ message: 'target_project_id is required' });
    }

    // Verify wishlist item belongs to user
    const [wishlistRows] = await pool.query(
      'SELECT * FROM wishlist WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (wishlistRows.length === 0) {
      return res.status(404).json({ message: 'Wishlist item not found' });
    }

    // Verify target project belongs to user
    const [projectRows] = await pool.query(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?',
      [target_project_id, req.user.id]
    );
    if (projectRows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const project = projectRows[0];

    res.json({
      message: `Video added successfully in ${project.name}`,
      project_name: project.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getWishlist, addToWishlist, removeFromWishlist, useWishlistItem };
