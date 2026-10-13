const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [5000, 'Message cannot exceed 5000 characters']
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  readBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isStarred: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster queries
MessageSchema.index({ isRead: 1, createdAt: -1 });
MessageSchema.index({ isArchived: 1, createdAt: -1 });
MessageSchema.index({ email: 1 });

// Virtual for time since received
MessageSchema.virtual('timeSince').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return this.createdAt.toLocaleDateString();
});

// Ensure virtuals are included in JSON
MessageSchema.set('toJSON', { virtuals: true });
MessageSchema.set('toObject', { virtuals: true });

// Static method to get unread count
MessageSchema.statics.getUnreadCount = async function() {
  return this.countDocuments({ isRead: false, isArchived: false });
};

// Static method to get recent unread messages
MessageSchema.statics.getRecentUnread = async function(limit = 5) {
  return this.find({ isRead: false, isArchived: false })
    .sort('-createdAt')
    .limit(limit)
    .select('name email subject createdAt');
};

module.exports = mongoose.model('Message', MessageSchema);
