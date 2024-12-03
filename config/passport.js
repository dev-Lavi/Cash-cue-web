const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy; // Import Twitter strategy
const User = require('../models/User'); // Adjust according to your path

// Configure Passport to use Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://cash-cue.onrender.com/user/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ email: profile.emails[0].value });
        if (!user) {
            user = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                password: '', // Google login doesn't need a password
                isVerified: true,
            });
            await user.save();
        }
        done(null, user);
    } catch (error) {
        done(error, null);
    }
}));

// Configure Passport to use Facebook OAuth
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: "https://cash-cue.onrender.com/user/auth/facebook/callback",
    profileFields: ['id', 'emails', 'name', 'displayName']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        if (!email) {
            throw new Error('Email not provided by Facebook');
        }

        let user = await User.findOne({ email });
        if (!user) {
            user = new User({
                name: `${profile.name.givenName} ${profile.name.familyName}`,
                email,
                password: '', // No password required
                isVerified: true,
            });
            await user.save();
        }
        done(null, user);
    } catch (error) {
        console.error('Error in Facebook Strategy:', error.message);
        done(error, null);
    }
}));

// Configure Passport to use Twitter OAuth
passport.use(new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY, // Twitter API key
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET, // Twitter API secret key
    callbackURL: "https://cash-cue-2.onrender.com/user/auth/twitter/callback"
}, async (token, tokenSecret, profile, done) => {
    try {
        let user = await User.findOne({ email: profile.emails[0].value });
        if (!user) {
            user = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                password: '', // No password required for Twitter login
                isVerified: true,
            });
            await user.save();
        }
        done(null, user);
    } catch (error) {
        done(error, null);
    }
}));

// Serialize user to store in session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
});