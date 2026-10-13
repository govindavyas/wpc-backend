const express = require('express');
const router = express.Router();
const Seo = require('../models/Seo');
const Movie = require('../models/Movie');

router.get('/', async (req, res) => {
    try {
        const baseUrl = 'https://whitepandacreations.com';

        // Add Cache-Control headers to ensure browsers/search engines do not cache old sitemaps
        res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.header('Pragma', 'no-cache');
        res.header('Expires', '0');

        // Get all active SEO records (static pages)
        const seoRecords = await Seo.find({ isActive: true });

        // Get all active movies for dynamic pages
        const movies = await Movie.find({ isActive: true });

        // Helper to escape URLs for XML
        const escapeXml = (unsafe) => {
            if (!unsafe) return '';
            return unsafe.replace(/[<>&'"]/g, function (c) {
                switch (c) {
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '&': return '&amp;';
                    case "'": return '&apos;';
                    case '"': return '&quot;';
                }
            });
        };

        const formatUrl = (path) => {
            if (!path) return '';
            if (path.startsWith('http')) return escapeXml(path);
            return escapeXml(baseUrl + (path.startsWith('/') ? path : '/' + path));
        };

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

        // Add static/SEO pages
        seoRecords.forEach(record => {
            // Exclude dynamically handled movie SEO pages to prevent duplicates
            if (record.pageSlug && record.pageSlug.startsWith('movie-')) return;

            const loc = record.pageSlug === 'home'
                ? formatUrl(baseUrl + '/')
                : formatUrl(baseUrl + '/' + record.pageSlug);

            xml += '  <url>\n';
            xml += `    <loc>${loc}</loc>\n`;
            xml += `    <lastmod>${record.updatedAt.toISOString().split('T')[0]}</lastmod>\n`;
            xml += `    <changefreq>${record.sitemapChangeFreq || 'weekly'}</changefreq>\n`;
            xml += `    <priority>${record.sitemapPriority || (record.pageSlug === 'home' ? '1.0' : '0.8')}</priority>\n`;

            // If there's an image
            if (record.ogImage) {
                xml += '    <image:image>\n';
                xml += `      <image:loc>${formatUrl(record.ogImage)}</image:loc>\n`;
                if (record.metaTitle) xml += `      <image:title><![CDATA[${record.metaTitle}]]></image:title>\n`;
                xml += '    </image:image>\n';
            }

            xml += '  </url>\n';
        });

        // Add movie detail pages
        movies.forEach(movie => {
            const loc = formatUrl(baseUrl + '/movie/' + movie.slug);
            const modDate = movie.updatedAt ? movie.updatedAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

            xml += '  <url>\n';
            xml += `    <loc>${loc}</loc>\n`;
            xml += `    <lastmod>${modDate}</lastmod>\n`;
            xml += '    <changefreq>weekly</changefreq>\n';
            xml += '    <priority>0.9</priority>\n';

            if (movie.posterUrl) {
                xml += '    <image:image>\n';
                xml += `      <image:loc>${formatUrl(movie.posterUrl)}</image:loc>\n`;
                if (movie.title) xml += `      <image:title><![CDATA[${movie.title}]]></image:title>\n`;
                xml += '    </image:image>\n';
            }

            xml += '  </url>\n';
        });

        xml += '</urlset>';

        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (error) {
        console.error('Error generating sitemap:', error);
        res.status(500).send('Error generating sitemap');
    }
});

module.exports = router;
