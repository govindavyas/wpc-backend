require('dotenv').config();
const mongoose = require('mongoose');

// We simply define the Schema here instead of importing to avoid dependency issues if any
const MovieSchema = new mongoose.Schema({}, { strict: false });
const Movie = mongoose.model('Movie', MovieSchema);

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // Sort by updated to get the newest modified ones
        const movies = await Movie.find({ isActive: true }).sort({ updatedAt: -1 }).limit(10);
        console.log(`Found ${movies.length} active movies.`);

        for (const m of movies) {
            console.log(`Title: ${m.title}`);
            console.log(`Poster: ${m.posterUrl}`);
            console.log(`Thumbnail: ${m.thumbnailUrl}`);
            console.log(`Banner: ${m.bannerUrl}`);
            if (m.image) console.log(`Image: ${m.image}`);
            console.log(`UpdatedAt: ${m.updatedAt}`);
            console.log('---');
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

checkData();
