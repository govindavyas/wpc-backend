const mongoose = require('mongoose');

const CareerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  jobType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
    default: 'Full-time'
  },
  description: {
    type: String,
    required: [true, 'Job description is required']
  },
  requirements: {
    type: String,
    required: [true, 'Requirements are required']
  },
  responsibilities: {
    type: String,
    required: [true, 'Responsibilities are required']
  },
  qualifications: {
    type: String
  },
  salaryRange: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicationDeadline: {
    type: Date
  },
  displayOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient querying
CareerSchema.index({ isActive: 1, displayOrder: 1 });
CareerSchema.index({ applicationDeadline: 1 });

module.exports = mongoose.model('Career', CareerSchema);
