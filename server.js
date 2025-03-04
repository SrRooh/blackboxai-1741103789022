require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/linktree', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session configuration
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/linktree' }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

app.use(flash());

// Models
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const linkSchema = new mongoose.Schema({
    title: { type: String, required: true },
    url: { type: String, required: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true }
});

const User = mongoose.model('User', userSchema);
const Link = mongoose.model('Link', linkSchema);

// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.isAuthenticated) {
        return next();
    }
    res.redirect('/login');
};

// Routes
app.get('/', async (req, res) => {
    try {
        const links = await Link.find({ active: true }).sort('order');
        res.render('home', { links });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

app.get('/login', (req, res) => {
    res.render('login', { message: req.flash('error') });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.isAuthenticated = true;
            res.redirect('/admin');
        } else {
            req.flash('error', 'Invalid username or password');
            res.redirect('/login');
        }
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/admin', isAuthenticated, async (req, res) => {
    try {
        const links = await Link.find().sort('order');
        res.render('admin', { links });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

app.post('/admin/links', isAuthenticated, async (req, res) => {
    try {
        const { title, url } = req.body;
        const count = await Link.countDocuments();
        await Link.create({ title, url, order: count });
        res.redirect('/admin');
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

app.put('/admin/links/:id', isAuthenticated, async (req, res) => {
    try {
        const { title, url, active } = req.body;
        await Link.findByIdAndUpdate(req.params.id, {
            title,
            url,
            active: active === 'true'
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
});

app.delete('/admin/links/:id', isAuthenticated, async (req, res) => {
    try {
        await Link.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
});

app.post('/admin/links/reorder', isAuthenticated, async (req, res) => {
    try {
        const { orders } = req.body;
        for (const [id, order] of Object.entries(orders)) {
            await Link.findByIdAndUpdate(id, { order });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Initialize admin user
const initializeAdmin = async () => {
    try {
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                username: 'admin',
                password: hashedPassword
            });
            console.log('Admin user created');
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
};

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await mongoose.connection.once('open', () => {
        console.log('Connected to MongoDB');
        initializeAdmin();
    });
});