const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadPDF, uploadAudio, handleUploadError } = require('../middleware/upload');
const {
  getProjects,
  createProject,
  getProject,
  uploadScript,
  uploadAudioFile,
  updateScriptText,
  updateProjectStatus,
  deleteProject,
  transcribeAudio,
  getTranscription,
} = require('../controllers/project.controller');

router.get('/workspace/:workspaceId', protect, getProjects);
router.post('/workspace/:workspaceId', protect, createProject);
router.get('/:id', protect, getProject);
router.post('/:id/upload-pdf',   protect, uploadPDF.single('file'),   uploadScript,     handleUploadError);
router.post('/:id/upload-audio', protect, uploadAudio.single('file'), uploadAudioFile,  handleUploadError);
router.put('/:id/script', protect, updateScriptText);
router.put('/:id/status', protect, updateProjectStatus);
router.delete('/:id', protect, deleteProject);
router.post('/:id/transcribe', protect, transcribeAudio);
router.get('/:id/transcription', protect, getTranscription);

module.exports = router;
