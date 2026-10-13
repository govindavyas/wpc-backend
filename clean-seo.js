require('dotenv').config();
const mongoose = require('mongoose');

const SeoSchema = new mongoose.Schema({}, { strict: false });
const Seo = mongoose.model('Seo', SeoSchema);

async function cleanData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // Find records with our target dummy URLs
        const query = {
            $or: [
                { ogImage: { $regex: '-og.jpg$', $options: 'i' } },
                { twitterImage: { $regex: '-og.jpg$', $options: 'i' } }
            ]
        };

        const records = await Seo.find(query);
        console.log(`Found ${records.length} SEO records to clean up.`);

        let updatedCount = 0;
        for (const record of records) {
            let needsSave = false;

            if (record.ogImage && record.ogImage.endsWith('-og.jpg')) {
                record.set('ogImage', '');
                needsSave = true;
            }

            if (record.twitterImage && record.twitterImage.endsWith('-og.jpg')) {
                record.set('twitterImage', '');
                needsSave = true;
            }

            if (needsSave) {
                await record.save();
                updatedCount++;
                console.log(`Cleaned up page: ${record.pageSlug}`);
            }
        }

        console.log(`Successfully cleaned ${updatedCount} records.`);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

cleanData();
