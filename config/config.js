require("dotenv").config();

module.exports = {
    // Database configuration
    MONGODB_URI: process.env.MONGO_URI || "mongodb://localhost:27017/course-registration",
    
    // Session configuration
    SESSION_SECRET: process.env.SESSION_SECRET || "your-secret-key",
    
    // Sample data for seeding
    Student: [
        {
            rollNumber: "22F-3625",
            name: "Umar Farooq",
            password: "password123",
            department: "Computer Science",
            level: "BS",
            semester: 6
        },
        {
            rollNumber: "22F-3626",
            name: "John Doe",
            password: "password123",
            department: "Computer Science",
            level: "BS",
            semester: 6
        }
    ],
    
    Admin: {
        username: "admin",
        password: "admin123",
        name: "Admin User"
    }
};
