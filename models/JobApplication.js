const mongoose = require('mongoose');

const JobApplicationSchema = new mongoose.Schema({
  careerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Career',
    default: null
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  resumeUrl: {
    type: String,
    required: [true, 'Resume is required']
  },
  coverLetter: {
    type: String
  },
  linkedinUrl: {
    type: String,
    trim: true
  },
  portfolioUrl: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'shortlisted', 'rejected', 'hired'],
    default: 'pending'
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
JobApplicationSchema.index({ careerId: 1, status: 1 });
JobApplicationSchema.index({ email: 1 });
JobApplicationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('JobApplication', JobApplicationSchema);
