require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcryptjs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const app = express();

// Create SQLite database
const db = new sqlite3.Database('links.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the links database.');
});

// Create tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        order_num INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1
    )`);

    // Create default admin user if not exists
    const checkAdmin = db.prepare('SELECT * FROM users WHERE username = ?');
    checkAdmin.get('admin', async (err, row) => {
        if (!row) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
        }
    });
    checkAdmin.finalize();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

app.use(flash());

// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.isAuthenticated) {
        return next();
    }
    res.redirect('/login');
};

// Routes
app.get('/', (req, res) => {
    db.all('SELECT * FROM links WHERE active = 1 ORDER BY order_num', [], (err, links) => {
        if (err) {
            return res.status(500).send('Server Error');
        }
        res.render('home', { links });
    });
});

app.get('/login', (req, res) => {
    res.render('login', { message: req.flash('error') });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            return res.status(500).send('Server Error');
        }
        
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.isAuthenticated = true;
            res.redirect('/admin');
        } else {
            req.flash('error', 'Invalid username or password');
            res.redirect('/login');
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/admin', isAuthenticated, (req, res) => {
    db.all('SELECT * FROM links ORDER BY order_num', [], (err, links) => {
        if (err) {
            return res.status(500).send('Server Error');
        }
        res.render('admin', { links });
    });
});

app.post('/admin/links', isAuthenticated, async (req, res) => {
    const { title, url } = req.body;
    
    db.get('SELECT MAX(order_num) as maxOrder FROM links', [], (err, row) => {
        if (err) {
            return res.status(500).send('Server Error');
        }
        
        const newOrder = (row.maxOrder || 0) + 1;
        db.run('INSERT INTO links (title, url, order_num) VALUES (?, ?, ?)',
            [title, url, newOrder],
            (err) => {
                if (err) {
                    return res.status(500).send('Server Error');
                }
                res.redirect('/admin');
            }
        );
    });
});

app.put('/admin/links/:id', isAuthenticated, (req, res) => {
    const { title, url, active } = req.body;
    
    db.run('UPDATE links SET title = ?, url = ?, active = ? WHERE id = ?',
        [title, url, active === 'true' ? 1 : 0, req.params.id],
        (err) => {
            if (err) {
                return res.status(500).json({ error: 'Server Error' });
            }
            res.json({ success: true });
        }
    );
});

app.delete('/admin/links/:id', isAuthenticated, (req, res) => {
    db.run('DELETE FROM links WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Server Error' });
        }
        res.json({ success: true });
    });
});

app.post('/admin/links/reorder', isAuthenticated, (req, res) => {
    const { orders } = req.body;
    
    const stmt = db.prepare('UPDATE links SET order_num = ? WHERE id = ?');
    for (const [id, order] of Object.entries(orders)) {
        stmt.run([order, id]);
    }
    stmt.finalize();
    
    res.json({ success: true });
});

// Start server
const PORT = process.env.PORT || 3001; // Changed to 3001
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});