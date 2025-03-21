const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const config = require("./config/config");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/admin");
const studentRoutes = require("./routes/student");
const methodOverride = require("method-override");

require("dotenv").config();

const app = express();


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method")); 


const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MongoDB URI is not defined in environment variables");
        }

        const dbUri = process.env.MONGO_URI;

        console.log('Attempting to connect to MongoDB Atlas...');
        console.log('Using Atlas URI:', dbUri.replace(/:[^@]+@/, ':****@')); // Hide password

        if (mongoose.connection.readyState === 1) {
            console.log("✅ Already connected to MongoDB Atlas");
            return;
        }

        mongoose.set('strictQuery', true);

        await mongoose.connect(dbUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log("✅ Connected to MongoDB Atlas successfully");
        console.log("Connected to database:", mongoose.connection.db.databaseName);

       
    } catch (error) {
        console.error("❌ MongoDB Atlas connection error:", error);
        console.error("Error details:", error.stack);
        console.log("Retrying Atlas connection in 5 seconds...");
        setTimeout(connectDB, 5000);
    }
};

const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "sessions",
    ttl: 24 * 60 * 60,
    autoRemove: 'native',
    touchAfter: 24 * 3600
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.use((req, res, next) => {
    console.log('Session data:', req.session);
    next();
});


app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/student", studentRoutes);

app.use((err, req, res, next) => {
    console.error('Global Error Handler:', err);

    if (res.headersSent) {
        return next(err);
    }

    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }

    if (req.session && req.session.user) {
        if (req.session.user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        } else if (req.session.user.role === 'student') {
            return res.redirect('/student/dashboard');
        }
    }

    return res.redirect('/auth/login');
});


app.use((req, res) => {
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            details: 'The requested resource was not found'
        });
    }

    if (req.session && req.session.user) {
        if (req.session.user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        } else if (req.session.user.role === 'student') {
            return res.redirect('/student/dashboard');
        }
    }

    return res.redirect('/auth/login');
});


app.get("/", (req, res) => {
    res.redirect("/auth/login");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    await connectDB();
});
