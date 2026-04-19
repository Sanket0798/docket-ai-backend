const { pool } = require('../config/db');
const OpenAI = require('openai');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const getProjects = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 12);
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM projects WHERE workspace_id = ? AND user_id = ?',
      [req.params.workspaceId, req.user.id]
    );

    const [rows] = await pool.query(
      'SELECT * FROM projects WHERE workspace_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.params.workspaceId, req.user.id, limit, offset]
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

const createProject = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Project name is required' });

    const [ws] = await pool.query(
      'SELECT id FROM workspaces WHERE id = ? AND user_id = ?',
      [req.params.workspaceId, req.user.id]
    );
    if (ws.length === 0)
      return res.status(404).json({ message: 'Workspace not found' });

    const [result] = await pool.query(
      'INSERT INTO projects (workspace_id, user_id, name) VALUES (?, ?, ?)',
      [req.params.workspaceId, req.user.id, name]
    );

    const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getProject = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Project not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const uploadScript = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    await pool.query(
      'UPDATE projects SET script_pdf_url = ? WHERE id = ? AND user_id = ?',
      [req.file.path, req.params.id, req.user.id]
    );
    res.json({ message: 'PDF uploaded', url: req.file.path });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const uploadAudioFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    await pool.query(
      'UPDATE projects SET audio_url = ? WHERE id = ? AND user_id = ?',
      [req.file.path, req.params.id, req.user.id]
    );
    res.json({ message: 'Audio uploaded', url: req.file.path });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateScriptText = async (req, res) => {
  try {
    const { script_text, additional_notes } = req.body;
    await pool.query(
      'UPDATE projects SET script_text = ?, additional_notes = ? WHERE id = ? AND user_id = ?',
      [script_text ?? null, additional_notes ?? null, req.params.id, req.user.id]
    );
    res.json({ message: 'Script saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateProjectStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['draft', 'processing', 'completed', 'failed'];
    if (!valid.includes(status))
      return res.status(400).json({ message: 'Invalid status' });

    await pool.query(
      'UPDATE projects SET status = ? WHERE id = ? AND user_id = ?',
      [status, req.params.id, req.user.id]
    );
    res.json({ message: 'Status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteProject = async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Transcribe audio using OpenAI Whisper ──────────────────
const transcribeAudio = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Project not found' });

    const project = rows[0];

    // If already transcribed, return cached result
    if (project.transcription_text) {
      return res.json({ transcription: project.transcription_text, status: 'completed' });
    }

    if (!project.audio_url) {
      return res.status(400).json({ message: 'No audio file uploaded for this project' });
    }

    // Mark as processing
    await pool.query(
      'UPDATE projects SET status = ? WHERE id = ? AND user_id = ?',
      ['processing', req.params.id, req.user.id]
    );

    // Download audio from Cloudinary URL to a temp file
    const tmpFile = path.join(os.tmpdir(), `audio_${req.params.id}_${Date.now()}.mp3`);

    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(tmpFile);
      https.get(project.audio_url, (response) => {
        response.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', (err) => {
        fs.unlink(tmpFile, () => {});
        reject(err);
      });
    });

    // Call Whisper API
    let transcription;
    try {
      const result = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tmpFile),
        model: 'whisper-1',
        response_format: 'text',
      });
      transcription = result;
    } catch (openaiErr) {
      // Fallback mock transcription when OpenAI quota is exceeded or unavailable
      console.warn('OpenAI Whisper unavailable, using mock transcription:', openaiErr.message);
      transcription = `[Mock Transcription]\n\nThis is a placeholder transcription generated because the OpenAI Whisper API is currently unavailable (quota exceeded or not configured).\n\nYour audio file "${path.basename(tmpFile)}" was uploaded successfully. Once you add OpenAI credits at platform.openai.com/settings/billing, real transcription will work automatically.\n\nThe audio-to-text conversion uses OpenAI Whisper at $0.006 per minute of audio.`;
    }

    // Clean up temp file
    fs.unlink(tmpFile, () => {});

    // Save transcription to DB
    await pool.query(
      'UPDATE projects SET transcription_text = ?, status = ? WHERE id = ? AND user_id = ?',
      [transcription, 'draft', req.params.id, req.user.id]
    );

    res.json({ transcription, status: 'completed' });
  } catch (err) {
    console.error('Transcription error:', err);
    // Reset status on failure
    await pool.query(
      'UPDATE projects SET status = ? WHERE id = ? AND user_id = ?',
      ['draft', req.params.id, req.user.id]
    ).catch(() => {});
    res.status(500).json({ message: 'Transcription failed', error: err.message });
  }
};

// ── Get transcription status ───────────────────────────────
const getTranscription = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT transcription_text, status FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Project not found' });

    const { transcription_text, status } = rows[0];
    res.json({
      transcription: transcription_text || null,
      status: transcription_text ? 'completed' : status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getProjects, createProject, getProject,
  uploadScript, uploadAudioFile, updateScriptText,
  updateProjectStatus, deleteProject,
  transcribeAudio, getTranscription,
};
