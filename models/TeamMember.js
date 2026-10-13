const mongoose = require('mongoose');

const TeamMemberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Team member name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: [
      'Producer',
      'Executive Producer',
      'Co-Producer',
      'Associate Producer',
      'Line Producer',
      'Director',
      'Writer',
      'Actor',
      'Editor',
      'Cinematographer',
      'Music Director',
      'Sound Designer',
      'Art Director',
      'Costume Designer',
      'VFX Supervisor',
      'Other'
    ],
    default: 'Producer'
  },
  customRole: {
    type: String,
    trim: true,
    maxlength: [100, 'Custom role cannot exceed 100 characters'],
    default: null
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  company: {
    type: String,
    trim: true,
    maxlength: [200, 'Company cannot exceed 200 characters']
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [5000, 'Bio cannot exceed 5000 characters']
  },
  shortBio: {
    type: String,
    trim: true,
    maxlength: [500, 'Short bio cannot exceed 500 characters']
  },
  photoUrl: {
    type: String,
    default: '/assets/team/default-member.jpg'
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  social: {
    imdb: String,
    linkedin: String,
    twitter: String,
    instagram: String,
    website: String
  },
  filmography: [{
    title: String,
    year: Number,
    role: String,
    movieId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Movie'
    }
  }],
  awards: [{
    name: String,
    year: Number,
    category: String
  }],
  featured: {
    type: Boolean,
    default: false
  },
  showOnHomepage: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Auto-generate slug from name before saving
TeamMemberSchema.pre('save', function(next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

// Indexes for efficient queries
// Note: slug already has a unique index from the field definition, no need to add it again
TeamMemberSchema.index({ role: 1 });
TeamMemberSchema.index({ isActive: 1, showOnHomepage: 1 });
TeamMemberSchema.index({ order: 1 });

// Virtual to get display role (custom role if 'Other' is selected)
TeamMemberSchema.virtual('displayRole').get(function() {
  return this.role === 'Other' && this.customRole ? this.customRole : this.role;
});

// Ensure virtuals are included in JSON
TeamMemberSchema.set('toJSON', { virtuals: true });
TeamMemberSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TeamMember', TeamMemberSchema);
