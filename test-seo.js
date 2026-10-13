require('dotenv').config();
const mongoose = require('mongoose');

const SeoSchema = new mongoose.Schema({}, { strict: false });
const Seo = mongoose.model('Seo', SeoSchema);

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const seoRecords = await Seo.find({ isActive: true }).sort({ updatedAt: -1 }).limit(10);
        console.log(`Found ${seoRecords.length} active SEO records.`);

        for (const record of seoRecords) {
            if (record.ogImage) {
                console.log(`Page: ${record.pageSlug}`);
                console.log(`OgImage: ${record.ogImage}`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

checkData();
