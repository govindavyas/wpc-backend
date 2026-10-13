const mongoose = require('mongoose');

const PartnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    trim: true,
    enum: ['Distribution', 'Marketing', 'Streaming', 'Festival', 'Equipment', 'Post-Production', 'Financial', 'Other']
  },
  logo: String,
  description: {
    type: String,
    trim: true
  },
  website: String,
  featured: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  }
}, { _id: true });

const PromoVideoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['youtube', 'vimeo', 'local'],
    default: 'youtube'
  },
  url: {
    type: String,
    required: true
  },
  thumbnail: String,
  description: String,
  order: {
    type: Number,
    default: 0
  }
}, { _id: true });

const TestimonialSchema = new mongoose.Schema({
  quote: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  company: String,
  logo: String,
  featured: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  }
}, { _id: true });

const MarketingSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Our Partners & Supporters'
  },
  description: {
    type: String,
    trim: true
  },
  tagline: String,
  
  partners: [PartnerSchema],
  promoVideos: [PromoVideoSchema],
  testimonials: [TestimonialSchema],
  
  supporterCategories: [{
    type: String,
    trim: true
  }],
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Ensure only one marketing document exists
MarketingSchema.statics.getInfo = async function() {
  let info = await this.findOne();
  if (!info) {
    info = await this.create({});
  }
  return info;
};

module.exports = mongoose.model('Marketing', MarketingSchema);
