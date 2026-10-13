const mongoose = require('mongoose');

const CompanyInfoSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    default: 'WHITE PANDA CREATIONS'
  },
  logo: {
    type: String,
    default: '/panda-logo.png'
  },
  logoDark: {
    type: String
  },
  favicon: {
    type: String
  },
  tagline: {
    type: String,
    trim: true,
    default: 'Illuminating Stories'
  },
  description: {
    type: String,
    trim: true
  },
  foundedYear: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  mission: {
    type: String,
    trim: true
  },
  vision: {
    type: String,
    trim: true
  },
  contact: {
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      pincode: String
    },
    fullAddress: {
      type: String,
      trim: true
    }
  },
  socialLinks: {
    instagram: String,
    facebook: String,
    youtube: String,
    twitter: String,
    linkedin: String
  },
  aboutUs: {
    title: {
      type: String,
      default: 'About WHITE PANDA CREATIONS'
    },
    subtitle: String,
    tagline: String,
    description: String,
    videoUrl: String,
    imageUrl: String,
    sections: [{
      heading: String,
      content: String,
      icon: String
    }],
    stats: [{
      value: String,
      label: String,
      icon: String
    }],
    milestones: [{
      year: String,
      title: String,
      description: String
    }]
  },
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

// Ensure only one company info document exists
CompanyInfoSchema.statics.getInfo = async function() {
  let info = await this.findOne();
  if (!info) {
    info = await this.create({});
  }
  return info;
};

module.exports = mongoose.model('CompanyInfo', CompanyInfoSchema);
