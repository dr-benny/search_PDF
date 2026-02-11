const express = require('express');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;
const assetsDir = path.join(__dirname, 'assets');
const indexFile = path.join(__dirname, 'search_index.json');
let searchIndex = {}; // Cache for search suggestions

// API: Suggestions
app.get('/api/suggestions', (req, res) => {
    console.log('GET /api/suggestions hit!');
    const query = req.query.q || '';
    if (!query) return res.json([]);

    // Prevent caching
    res.set('Cache-Control', 'no-store');

    const qLower = query.toLowerCase();
    const suggestions = [];

    // Filter index for matches
    for (const [number, files] of Object.entries(searchIndex)) {
        if (number.toLowerCase().includes(qLower)) {
            suggestions.push({
                text: number,
                type: `Found in ${files.length} file(s)`,
                files: files
            });
        }
    }

    // Sort suggestions: Exact > StartsWith > EndsWith > Contains
    suggestions.sort((a, b) => {
        const textA = a.text.toLowerCase();
        const textB = b.text.toLowerCase();
        const query = qLower;

        // 1. Exact match priority
        if (textA === query) return -1;
        if (textB === query) return 1;

        // 2. Starts With priority
        const startA = textA.startsWith(query);
        const startB = textB.startsWith(query);
        if (startA && !startB) return -1;
        if (!startA && startB) return 1;

        // 3. Ends With priority (Great for "last 4 digits" search)
        const endA = textA.endsWith(query);
        const endB = textB.endsWith(query);
        if (endA && !endB) return -1;
        if (!endA && endB) return 1;

        // 4. Alphabetical fallback
        return textA.localeCompare(textB);
    });

    // Return top 100
    res.json(suggestions.slice(0, 100));
});

app.use(express.static('public'));
app.use(express.json());

// Helper: Run Indexing Script
function runIndexer() {
    return new Promise((resolve, reject) => {
        console.log('Running indexing script...');
        exec('python3 extract_numbers.py assets', (error, stdout, stderr) => {
            if (error) {
                console.error(`Indexer error: ${error.message}`);
                // Don't reject, just resolve so we don't crash requests
                resolve();
                return;
            }
            if (stderr) console.error(`Indexer stderr: ${stderr}`);
            console.log(`Indexer output: ${stdout}`);
            loadIndex();
            resolve();
        });
    });
}

// Helper: Load Index
function loadIndex() {
    if (fs.existsSync(indexFile)) {
        try {
            const data = fs.readFileSync(indexFile, 'utf8');
            searchIndex = JSON.parse(data);
            console.log(`[${new Date().toISOString()}] Loaded search index with ${Object.keys(searchIndex).length} entries.`);
        } catch (err) {
            console.error('Error loading search index:', err);
        }
    }
}

// Initial Run
runIndexer();

// Helper to get all PDF files in a directory
const getPdfFiles = (dir) => {
    let results = [];
    try {
        const list = fs.readdirSync(dir);
        list.forEach((file) => {
            file = path.resolve(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory() && file.indexOf('node_modules') === -1) {
                // Recursive search, ignoring node_modules
                results = results.concat(getPdfFiles(file));
            } else {
                if (path.extname(file).toLowerCase() === '.pdf') {
                    results.push(file);
                }
            }
        });
    } catch (err) {
        console.error("Error reading directory:", err);
    }
    return results;
};

// Custom render function to track page breaks
function render_page(pageData) {
    // This render function is called for each page
    // We return the text content so it can be searched
    // But pdf-parse concatenates everything.
    // To support page finding, we can inject a special delimiter.
    return pageData.getTextContent()
        .then(textContent => {
            let lastY, text = '';
            for (let item of textContent.items) {
                if (lastY == item.transform[5] || !lastY) {
                    text += item.str;
                }
                else {
                    text += '\n' + item.str;
                }
                lastY = item.transform[5];
            }
            // Inject page delimiter
            return `\n<<PAGE_BREAK_NUM_${pageData.pageIndex + 1}>>\n` + text;
        });
}

app.get('/api/search', async (req, res) => {
    const { term, dir } = req.query;
    if (!term) {
        return res.status(400).json({ error: 'Search term is required' });
    }

    const searchDir = dir || __dirname; // Default to current directory if not provided

    if (!fs.existsSync(searchDir)) {
        return res.status(404).json({ error: 'Directory not found' });
    }

    const files = getPdfFiles(searchDir);
    const results = [];

    console.log(`Searching for "${term}" in ${files.length} files in "${searchDir}"...`);

    for (const file of files) {
        try {
            const dataBuffer = fs.readFileSync(file);
            const options = {
                pagerender: render_page
            }
            const data = await pdf(dataBuffer, options);

            // Now we split by our delimiter to look for the term per page
            const pages = data.text.split(/<<PAGE_BREAK_NUM_(\d+)>>/);

            // The split will result in [pre-text, pageNum, pageText, pageNum, pageText...]
            // Because the delimiter is capturing group (\d+).
            // Actually, split keeps separators if captured.

            for (let i = 1; i < pages.length; i += 2) {
                const pageNum = pages[i];
                const pageText = pages[i + 1];

                // standard search
                if (pageText && pageText.includes(term)) {
                    results.push({
                        file: path.basename(file),
                        path: file,
                        page: parseInt(pageNum),
                        matchType: 'exact'
                    });
                    continue;
                }

                // robust search (ignore whitespace)
                // useful for tables or numbers split across lines
                const normalizedText = pageText ? pageText.replace(/\s+/g, '') : '';
                const normalizedTerm = term.replace(/\s+/g, '');

                if (normalizedText.includes(normalizedTerm)) {
                    results.push({
                        file: path.basename(file),
                        path: file,
                        page: parseInt(pageNum),
                        matchType: 'robust'
                    });
                }
            }

        } catch (err) {
            console.error(`Error reading ${file}:`, err);
        }
    }

    res.json(results);
});

const { PDFDocument } = require('pdf-lib');

app.get('/api/download', async (req, res) => {
    const { path: filePath, page, customName } = req.query;
    if (!filePath) {
        return res.status(400).send('File path is required');
    }

    // Security check: ensure file exists and is actually a file
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) {
            return res.status(400).send('Not a file');
        }

        // If no page specified, download full file
        if (!page) {
            const fileName = path.basename(filePath);
            return res.download(filePath, fileName);
        }

        // Extract specific page
        const pageNum = parseInt(page);
        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).send('Invalid page number');
        }

        const existingPdfBytes = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        // Validation: Page number within range?
        if (pageNum > pdfDoc.getPageCount()) {
            return res.status(400).send('Page number out of range');
        }

        const newPdfDoc = await PDFDocument.create();

        // Pages are 0-indexed in pdf-lib, but our UI uses 1-based
        const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
        newPdfDoc.addPage(copiedPage);

        const pdfBytes = await newPdfDoc.save();
        let fileName = `page_${pageNum}_${path.basename(filePath)}`;

        if (customName) {
            fileName = customName.endsWith('.pdf') ? customName : `${customName}.pdf`;
        }

        res.setHeader('Content-Type', 'application/pdf');
        // Use filename* for proper non-ASCII character handling
        const encodedFileName = encodeURIComponent(fileName);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
        res.send(Buffer.from(pdfBytes));

    } catch (err) {
        console.error("Download error:", err);
        res.status(500).send("Server error during download");
    }
});


const multer = require('multer');

// Configure storage for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'assets');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir); // Uploads to 'assets' directory
    },
    filename: function (req, file, cb) {
        // Use original filename, but ensure safe handling? 
        // For simplicity, keep original.
        // Convert non-ascii to safe characters? Multer handles it somewhat, but let's just keep original.
        // Actually, preventing overwrite or weird names is good practice, but user just wants "upload and list".
        cb(null, Buffer.from(file.originalname, 'latin1').toString('utf8'));
    }
});

const upload = multer({ storage: storage });

// List all PDF files
app.get('/api/files', (req, res) => {
    // We'll list files from 'assets' directory primarily, or searchDir if flexible.
    // For management, let's stick to the 'assets' directory or a defined root.
    // Let's list files in the 'assets' folder as the primary managed location.
    const assetsDir = path.join(__dirname, 'assets');

    if (!fs.existsSync(assetsDir)) {
        return res.json([]);
    }

    try {
        const files = fs.readdirSync(assetsDir)
            .filter(file => path.extname(file).toLowerCase() === '.pdf')
            .map(file => {
                const filePath = path.join(assetsDir, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    path: filePath,
                    size: stats.size,
                    created: stats.birthtime
                };
            });
        res.json(files);
    } catch (err) {
        console.error("List files error:", err);
        res.status(500).json({ error: "Failed to list files" });
    }
});

// Upload API
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    // Run indexer after upload, WAIT for it to finish
    await runIndexer();
    res.json({ message: 'File uploaded successfully', file: req.file });
});

// Delete API
// Delete API (Single or Bulk)
app.delete('/api/files', async (req, res) => {
    const { name, names } = req.body;

    if (!name && (!names || !Array.isArray(names) || names.length === 0)) {
        return res.status(400).json({ error: 'Filename or list of filenames is required' });
    }

    const assetsDir = path.join(__dirname, 'assets');
    const filesToDelete = names ? names : [name];
    let deletedCount = 0;
    let errors = [];

    filesToDelete.forEach(fileName => {
        // Security: Prevent directory traversal
        const safeName = path.basename(fileName);
        const filePath = path.join(assetsDir, safeName);

        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                deletedCount++;
            } catch (err) {
                console.error(`Error deleting ${fileName}:`, err);
                errors.push(fileName);
            }
        } else {
            // File doesn't exist, technically "deleted", but let's note it? 
            // No, idempotency is fine.
        }
    });

    if (errors.length > 0) {
        // Partial success or failure
        return res.status(207).json({
            message: `Deleted ${deletedCount} files. Failed to delete ${errors.length} files.`,
            errors: errors
        });
    }

    // Run indexer after delete, WAIT for it to finish
    await runIndexer();
    res.json({ message: `Successfully deleted ${deletedCount} files` });
});



app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
