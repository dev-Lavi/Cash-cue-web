// Load environment variables 
require('dotenv').config();
require('./config/passport');

const express = require('express');

const session = require('express-session');
const passport = require('passport'); // Import Passport
const ExpenseRouter = require('./api/transaction');
const HomeRouter = require('./api/homepage'); // Import the Home API Router
const PredictRouter = require('./api/predict'); // Import the Predict API Router
const SettingsRouter = require('./api/settings');
const groupsRouter = require('./api/groups');
const cookieParser = require('cookie-parser'); 

// Database connection
require('./config/db'); 

// Import necessary modules
const app = express();
const port = process.env.PORT || 3002;

const cors = require('cors'); // Import CORS
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,  
}));

// Use cookie-parser to handle cookies (e.g., for refresh tokens)
app.use(cookieParser());

// Set up session middleware to handle OAuth session data
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'default_secret', // Set a session secret
        resave: false,
        saveUninitialized: false,
    })
);

// Initialize Passport and session
app.use(passport.initialize());
app.use(passport.session());

// Import User Router
const UserRouter = require('./api/User');
console.log('User routes loaded');

// Middleware for parsing JSON request bodies
app.use(express.json());

// Serve static files from the uploads directory
app.use('/uploads', express.static('uploads'));

// Set up routes
app.use('/user', UserRouter);
app.use('/transaction', ExpenseRouter); // Expense routes
app.use('/homepage', HomeRouter); // Home page-related routes
app.use('/settings', SettingsRouter); 
app.use('/predict', PredictRouter); // Prediction-related routes
app.use('/groups', groupsRouter);


// Default route for health check or debugging
app.get('/', (req, res) => {
    res.send('Authentication Server is Running');
});

// Error handling middleware for unexpected errors


// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
