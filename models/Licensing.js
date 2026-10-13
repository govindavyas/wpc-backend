const mongoose = require('mongoose');

const LicensingDocumentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  icon: String,
  downloadUrl: String,
  fileType: String,
  order: {
    type: Number,
    default: 0
  }
}, { _id: true });

const LicensingFeatureSchema = new mongoose.Schema({
  icon: String,
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  order: {
    type: Number,
    default: 0
  }
}, { _id: true });

const LicensingSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Film Licensing'
  },
  description: {
    type: String,
    trim: true
  },
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  contactPhone: String,
  
  documents: [LicensingDocumentSchema],
  features: [LicensingFeatureSchema],
  
  // Terms and conditions
  termsContent: String,
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Ensure only one licensing document exists
LicensingSchema.statics.getInfo = async function() {
  let info = await this.findOne();
  if (!info) {
    info = await this.create({});
  }
  return info;
};

module.exports = mongoose.model('Licensing', LicensingSchema);
