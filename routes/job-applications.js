const express = require('express');
const router = express.Router();
const { JobApplication, Career } = require('../models');
const { protect } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for resume uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/resumes');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
  }
});

// Submit job application (public)
router.post('/', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Resume file is required' });
    }

    const applicationData = {
      ...req.body,
      resumeUrl: `/uploads/resumes/${req.file.filename}`,
      // Convert careerId to null for general applications or validate ObjectId
      careerId: req.body.careerId && req.body.careerId !== '0' ? req.body.careerId : null
    };

    const application = await JobApplication.create(applicationData);
    res.status(201).json(application);
  } catch (error) {
    console.error('Error submitting application:', error);
    // Delete uploaded file if application creation fails
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Get all applications (admin)
router.get('/', protect, async (req, res) => {
  try {
    const { careerId, status } = req.query;
    const query = {};
    
    if (careerId) {
      query.careerId = careerId;
    }
    if (status) {
      query.status = status;
    }

    const applications = await JobApplication.find(query)
      .populate('careerId', 'title department location')
      .sort({ createdAt: -1 });
    
    // Transform to match frontend expectations (using 'career' instead of 'careerId')
    const transformedApplications = applications.map(app => {
      const appObj = app.toObject();
      appObj.career = appObj.careerId;
      return appObj;
    });
    
    res.json(transformedApplications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get single application (admin)
router.get('/:id', protect, async (req, res) => {
  try {
    const application = await JobApplication.findById(req.params.id)
      .populate('careerId', 'title department location');
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Transform to match frontend expectations
    const appObj = application.toObject();
    appObj.career = appObj.careerId;
    
    res.json(appObj);
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// Update application status (admin)
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const application = await JobApplication.findByIdAndUpdate(
      req.params.id,
      { status, notes },
      { new: true, runValidators: true }
    );
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    res.json(application);
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ error: 'Failed to update application status' });
  }
});

// Delete application (admin)
router.delete('/:id', protect, async (req, res) => {
  try {
    const application = await JobApplication.findById(req.params.id);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Delete resume file
    if (application.resumeUrl) {
      const filePath = path.join(__dirname, '..', application.resumeUrl);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error('Error deleting resume file:', error);
      }
    }

    await JobApplication.findByIdAndDelete(req.params.id);
    res.json({ message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

module.exports = router;
