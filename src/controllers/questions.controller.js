const { pool } = require('../config/db');

const getQuestions = async (req, res) => {
  try {
    // Verify the project belongs to the requesting user
    const [project] = await pool.query(
      'SELECT id FROM projects WHERE id = ? AND user_id = ?',
      [req.params.projectId, req.user.id]
    );
    if (project.length === 0)
      return res.status(404).json({ message: 'Project not found' });

    const [rows] = await pool.query(
      'SELECT * FROM project_questions WHERE project_id = ? ORDER BY question_order ASC',
      [req.params.projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const saveQuestion = async (req, res) => {
  try {
    const { question, answer, question_order } = req.body;
    const projectId = req.params.projectId;

    // Verify the project belongs to the requesting user
    const [project] = await pool.query(
      'SELECT id FROM projects WHERE id = ? AND user_id = ?',
      [projectId, req.user.id]
    );
    if (project.length === 0)
      return res.status(404).json({ message: 'Project not found' });

    // Upsert — update if same order exists, else insert
    const [existing] = await pool.query(
      'SELECT id FROM project_questions WHERE project_id = ? AND question_order = ?',
      [projectId, question_order]
    );

    if (existing.length > 0) {
      await pool.query(
        'UPDATE project_questions SET question = ?, answer = ? WHERE id = ?',
        [question, answer, existing[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO project_questions (project_id, question, answer, question_order) VALUES (?, ?, ?, ?)',
        [projectId, question, answer, question_order]
      );
    }

    res.json({ message: 'Question saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getQuestions, saveQuestion };
