require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const config = require('./config/config');
const Student = require('./models/Student');
const Admin = require('./models/Admin');
const Course = require('./models/Course');

async function seedDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(config.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');

        // Clearing existing data
        await Student.deleteMany({});
        await Admin.deleteMany({});
        await Course.deleteMany({});
        console.log('✅ Cleared existing data');

        // Create sample students
        const students = await Student.create([
            {
                name: "Omer raza",
                rollNumber: "2023001",
                department: "Computer Science",
                email: "omer@example.com",
                password: await bcrypt.hash("student123", 10),
                role: "student"
            },
            {
                name: "ali raza",
                rollNumber: "2023002",
                department: "Electrical Engineering",
                email: "aliraza@example.com",
                password: await bcrypt.hash("student123", 10),
                role: "student"
            },
            {
                name: "hanzala",
                rollNumber: "2023003",
                department: "Mechanical Engineering",
                email: "hanzala@example.com",
                password: await bcrypt.hash("student123", 10),
                role: "student"
            }
        ]);
        console.log('✅ Created students');

        // Create admin
        const hashedAdminPassword = await bcrypt.hash(config.Admin.password, 10);
        await Admin.create({
            ...config.Admin,
            password: hashedAdminPassword
        });
        console.log('✅ Created admin');

        // Creating courses in db
        const courses = [
            {
                code: "CS101",
                name: "Introduction to Programming",
                department: "Computer Science",
                credits: 3,
                description: "Basic programming concepts using Python",
                instructor: "Ahmed ijaz",
                days: ["Monday", "Wednesday"],
                startTime: "09:00",
                endTime: "10:30",
                room: "Lab 1",
                seats: 30,
                semester: "Fall 2023",
                level: "BS"
            },
            {
                code: "CS201",
                name: "Data Structures",
                department: "Computer Science",
                credits: 3,
                description: "Advanced data structures and algorithms",
                instructor: "Hamad",
                days: ["Tuesday", "Thursday"],
                startTime: "11:00",
                endTime: "12:30",
                room: "Lab 2",
                seats: 25,
                semester: "Fall 2023",
                level: "BS"
            },
            {
                code: "CS301",
                name: "Database Systems",
                department: "Computer Science",
                credits: 3,
                description: "Introduction to database management systems",
                instructor: "Haseeb",
                days: ["Monday", "Wednesday"],
                startTime: "14:00",
                endTime: "15:30",
                room: "Lab 3",
                seats: 20,
                semester: "Fall 2023",
                level: "BS"
            }
        ];

        await Course.insertMany(courses);
        console.log('✅ Created courses');

        console.log('✅ Database seeding completed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase(); 