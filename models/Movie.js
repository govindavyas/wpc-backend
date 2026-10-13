const mongoose = require('mongoose');
const slugify = require('slugify');

const CastMemberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    trim: true
  },
  photoUrl: String
}, { _id: false });

const CrewMemberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    trim: true
  },
  department: String,
  photoUrl: String
}, { _id: false });

const GalleryItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['image', 'video', 'poster'],
    default: 'image'
  },
  url: {
    type: String,
    required: true
  },
  caption: String,
  thumbnail: String,
  order: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  }
}, { _id: true });

const MovieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Movie title is required'],
    trim: true
  },
  slug: {
    type: String,
    unique: true
  },
  originalTitle: {
    type: String,
    trim: true
  },
  tagline: {
    type: String,
    trim: true
  },
  year: {
    type: String,
    required: [true, 'Release year is required']
  },
  releaseDate: Date,
  runtime: String,
  duration: String,  // Display format like "2h 30m"
  language: {
    type: String,
    default: 'Marathi'
  },
  genre: String,     // Comma-separated genre string for simple display
  genres: [{
    type: String,
    trim: true
  }],
  description: {
    type: String,
    trim: true
  },
  synopsis: {
    type: String,
    trim: true
  },
  
  // Media
  posterUrl: {
    type: String,
    default: '/assets/movies/default-poster.jpg'
  },
  bannerUrl: String,
  thumbnailUrl: String, // Compressed thumbnail for fast list loading
  
  // Main Character Feature
  mainCharacter: {
    name: String,
    actor: String,
    description: String,
    imageUrl: String,
    quote: String
  },
  
  // Trailer
  trailer: {
    type: {
      type: String,
      enum: ['youtube', 'vimeo', 'local'],
      default: 'youtube'
    },
    url: String,
    thumbnail: String
  },
  
  // Credits
  credits: {
    director: String,
    producer: [String],
    producers: [CrewMemberSchema],  // New format with name/role objects
    executiveProducer: [String],
    writer: [String],
    writers: [CrewMemberSchema],    // New format with name/role objects
    directors: [CrewMemberSchema],  // New format with name/role objects
    cinematographer: String,
    editor: String,
    musicDirector: String,
    backgroundScore: String,
    lyricist: [String],
    choreographer: [String],
    playbackSingers: [String],      // Array of singer names
    
    // Production Team
    productionManager: String,
    associateDirector: String,
    artDirector: String,
    costumeDesigner: String,
    makeupArtist: String,
    
    // Cast arrays
    leadCast: [CastMemberSchema],
    supportingCast: [CastMemberSchema],
    specialAppearances: [CastMemberSchema],
    
    // Additional crew
    crew: [CrewMemberSchema]
  },
  
  // Songs/Music
  songs: [{
    title: String,
    singer: [String],
    composer: String,
    lyricist: String,
    duration: String,
    audioUrl: String
  }],
  
  // Gallery
  gallery: [GalleryItemSchema],
  
  // Social Media
  socialMedia: {
    instagram: String,
    facebook: String,
    youtube: String,
    twitter: String,
    hashtag: String
  },
  
  // Distribution
  distribution: {
    distributor: String,
    distributorLogo: String,
    platforms: [String],
    territories: [String]
  },
  
  // Awards
  awards: [{
    name: String,
    category: String,
    year: String,
    result: {
      type: String,
      enum: ['won', 'nominated'],
      default: 'nominated'
    }
  }],
  
  // Status & Display
  status: {
    type: String,
    enum: ['announced', 'pre-production', 'production', 'post-production', 'completed', 'released'],
    default: 'announced'
  },
  highlight: {
    type: Boolean,
    default: false
  },
  featured: {
    type: Boolean,
    default: false
  },
  showOnHomepage: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  
  // Display Order - controls which sections appear on movie details page and in what order
  displayOrder: {
    sections: [{
      id: { type: String },      // e.g., 'production', 'creative', 'cast', 'gallery', 'awards'
      label: { type: String },
      visible: { type: Boolean, default: true },
      order: { type: Number, default: 0 }
    }],
    // Order for items within credits sections
    creditsOrder: {
      producers: { type: Number, default: 0 },
      directors: { type: Number, default: 1 },
      writers: { type: Number, default: 2 },
      cinematographer: { type: Number, default: 3 },
      musicDirector: { type: Number, default: 4 },
      editor: { type: Number, default: 5 }
    }
  },
  
  // SEO
  seoMeta: {
    title: String,
    description: String,
    keywords: [String]
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Generate slug before saving
MovieSchema.pre('save', function(next) {
  if (this.isModified('title') || !this.slug) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

// Indexes for better query performance (slug already has unique index)
MovieSchema.index({ year: -1 });
MovieSchema.index({ status: 1 });
MovieSchema.index({ highlight: 1, featured: 1 });
MovieSchema.index({ isActive: 1, showOnHomepage: 1 });

module.exports = mongoose.model('Movie', MovieSchema);
