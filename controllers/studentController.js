const Student = require("../models/Student");
const Course = require("../models/Course");
const { Student: ConfigStudent } = require("../config/config");

exports.getSchedule = async (req, res) => {
    try {
        console.log('Fetching schedule for student:', req.session.user.username);
        
        const student = await Student.findOne({ rollNumber: req.session.user.username });
        if (!student) {
            console.log('Student not found');
            return res.status(404).json({ error: 'Student not found' });
        }
        const courses = await Course.find({ enrolledStudents: student._id });
        console.log('Found courses:', courses.length);
        const events = courses.flatMap(course => {
            const dayMap = {
                'Monday': 1,
                'Tuesday': 2,
                'Wednesday': 3,
                'Thursday': 4,
                'Friday': 5
            };

           
            return course.days.map(day => ({
                id: course._id.toString(),
                title: `${course.code} - ${course.name}`,
                daysOfWeek: [dayMap[day]],
                startTime: course.startTime,
                endTime: course.endTime,
                startRecur: '2024-01-01', // Start of semester
                endRecur: '2024-05-31',   // End of semester
                extendedProps: {
                    instructor: course.instructor,
                    room: course.room,
                    credits: course.credits
                },
                backgroundColor: '#3498db',
                borderColor: '#2980b9'
            }));
        });

        console.log('Generated events:', events.length);
        res.json(events);
    } catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ error: 'Error fetching schedule' });
    }
};

exports.updateSchedule = async (req, res) => {
    try {
        const { courseId, action } = req.body;
        const student = await Student.findOne({ rollNumber: req.session.user.rollNumber });

        if (!student) return res.status(404).json({ error: "Student not found" });

        if (action === "add") {
            const course = await Course.findById(courseId);
            if (!course) return res.status(404).json({ error: "Course not found" });

          
            if (checkConflict(student.courses, course)) {
                return res.status(400).json({ error: "Schedule conflict detected" });
            }
            if (!checkPrerequisites(student.courses, course.prerequisites)) {
                return res.status(400).json({ error: "Prerequisites not met" });
            }

            if (course.seats <= 0) {
                return res.status(400).json({ error: "No seats available" });
            }
            student.courses.push(course);
            course.seats -= 1;

            await student.save();
            await course.save();
            res.json({ success: true, message: "Course registered successfully" });

        } else if (action === "remove") {
            student.courses = student.courses.filter(course => course.toString() !== courseId);

            const course = await Course.findById(courseId);
            if (course) {
                course.seats += 1; // Increase seat count
                await course.save();
            }

            await student.save();
            res.json({ success: true, message: "Course dropped successfully" });
        }
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

exports.getCourses = async (req, res) => {
    try {
        let courses = await Course.find();
        res.json(courses);
    } catch (error) {
        res.status(500).json({ error: "Error fetching courses" });
    }
};

exports.getSeatAvailability = async (req, res) => {
    try {
        let courses = await Course.find({}, "id seats");
        res.json(courses);
    } catch (error) {
        res.status(500).json({ error: "Error fetching seat availability" });
    }
};


async function checkScheduleConflict(studentId, newCourse) {
    const enrolledCourses = await Course.find({ enrolledStudents: studentId });
    for (const existingCourse of enrolledCourses) 
        {
        const commonDays = existingCourse.days.filter(day => 
            newCourse.days.includes(day)
        );
        
        if (commonDays.length > 0) {
            const newStart = timeToMinutes(newCourse.startTime);
            const newEnd = timeToMinutes(newCourse.endTime);
            const existingStart = timeToMinutes(existingCourse.startTime);
            const existingEnd = timeToMinutes(existingCourse.endTime);
            
            if (newStart < existingEnd && newEnd > existingStart && newCourse.room === existingCourse.room) {
                return {
                    hasConflict: true,
                    conflictingCourse: existingCourse.code,
                    reason: `Schedule and room conflict with ${existingCourse.code} in room ${existingCourse.room}`
                };
            }
        }
    }
    
    return { hasConflict: false };
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

exports.registerCourse = async (req, res) => {
    try {
        const student = await Student.findOne({ rollNumber: req.session.user.username });
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const course = await Course.findById(req.body.courseId);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        
        if (course.enrolledStudents.includes(student._id)) {
            return res.status(400).json({ error: 'You are already registered for this course' });
        }

        if (course.seats <= 0) {
            return res.status(400).json({ error: 'This course is full' });
        }

        const scheduleCheck = await checkScheduleConflict(student._id, course);
        if (scheduleCheck.hasConflict) {
            return res.status(400).json({ 
                error: `Schedule conflict detected with ${scheduleCheck.conflictingCourse}` 
            });
        }

        course.enrolledStudents.push(student._id);
        course.seats -= 1;
        await course.save();

        return res.json({
            success: true,
            message: 'Successfully registered for the course'
        });
    } catch (error) {
        console.error('Error registering for course:', error);
        return res.status(500).json({ 
            error: 'Error registering for course' 
        });
    }
};

exports.dropCourse = async (req, res) => {
    try {
        const student = await Student.findOne({ rollNumber: req.session.user.username });
        if (!student) {
            return res.status(404).send('Student not found');
        }

        const course = await Course.findById(req.body.courseId);
        if (!course) {
            return res.render('student/my-courses', {
                courses: await Course.find({ enrolledStudents: student._id }),
                error: 'Course not found',
                success: null,
                student: {
                    name: student.name,
                    rollNumber: student.rollNumber
                }
            });
        }

        course.enrolledStudents = course.enrolledStudents.filter(id => !id.equals(student._id));
        course.seats += 1;
        await course.save();

        res.render('student/my-courses', {
            courses: await Course.find({ enrolledStudents: student._id }),
            error: null,
            success: 'Successfully dropped the course',
            student: {
                name: student.name,
                rollNumber: student.rollNumber
            }
        });
    } catch (error) {
        console.error('Error dropping course:', error);
        const student = await Student.findOne({ rollNumber: req.session.user.username });
        res.render('student/my-courses', {
            courses: await Course.find({ enrolledStudents: student._id }),
            error: 'Error dropping course',
            success: null,
            student: {
                name: student.name,
                rollNumber: student.rollNumber
            }
        });
    }
};

function dayToNumber(day) {
    const daysMap = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };
    return daysMap[day] || null;
}

// Check for schedule conflicts
function checkConflict(courses, currentCourse) {
    return courses.some(course => {
        if (course._id.toString() === currentCourse._id.toString()) return false;
        
       
        const sharedDays = course.days.filter(day => currentCourse.days.includes(day));
        if (sharedDays.length === 0) return false;
        const courseStart = new Date(`1970-01-01T${course.startTime}`);
        const courseEnd = new Date(`1970-01-01T${course.endTime}`);
        const currentStart = new Date(`1970-01-01T${currentCourse.startTime}`);
        const currentEnd = new Date(`1970-01-01T${currentCourse.endTime}`);

        return (currentStart < courseEnd && currentEnd > courseStart);
    });
}

function checkPrerequisites(existingCourses, prerequisites) {
    return prerequisites.every(prerequisite =>
        existingCourses.some(course => course.name === prerequisite)
    );
}

exports.getDashboard = async (req, res) => {
    try {
        const student = await Student.findOne({ rollNumber: req.session.user.rollNumber });
        if (!student) {
            console.log('Student not found:', req.session.user.rollNumber);
            return res.status(500).render('student/dashboard', {
                user: req.session.user,
                enrolledCourses: [],
                error: 'Error: Student record not found'
            });
        }
        const enrolledCourses = await Course.find({
            enrolledStudents: student._id
        }).select('code name instructor room days startTime endTime credits');

        console.log('Found enrolled courses:', enrolledCourses.length);
        const formattedCourses = enrolledCourses.map(course => {
            const courseObj = course.toObject();
            courseObj.days = Array.isArray(courseObj.days) ? courseObj.days : [];
            return {
                _id: courseObj._id,
                code: courseObj.code,
                name: courseObj.name,
                instructor: courseObj.instructor,
                room: courseObj.room,
                credits: courseObj.credits,
                days: courseObj.days,
                startTime: courseObj.startTime,
                endTime: courseObj.endTime
            };
        });

        console.log('Formatted courses for calendar:', formattedCourses);

        return res.render('student/dashboard', {
            user: req.session.user,
            enrolledCourses: formattedCourses,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Error loading student dashboard:', error);
        return res.status(500).render('student/dashboard', {
            user: req.session.user,
            enrolledCourses: [],
            error: 'Error loading dashboard'
        });
    }
};

exports.getBrowseCourses = async (req, res) => {
    res.send("Browse Courses - Coming Soon");
};

exports.getRegisteredCourses = async (req, res) => {
    res.send("My Courses - Coming Soon");
};

exports.getAvailableCourses = async (req, res) => {
    try {
        console.log('Getting available courses for student:', req.session.user.username);
        
        const student = await Student.findOne({ rollNumber: req.session.user.username });
        if (!student) {
            console.log('Student not found:', req.session.user.username);
            return res.status(404).send('Student not found');
        }
        console.log('Found student:', student.rollNumber);
        const courses = await Course.find({
            seats: { $gt: 0 }, 
            enrolledStudents: { $ne: student._id } 
        }).select('code name department level instructor credits days startTime endTime room seats enrolledStudents');

        console.log('Found available courses:', courses.length);
        
        if (courses.length === 0) {
            console.log('No available courses found');
            return res.render('student/register-courses', {
                courses: [],
                error: 'No courses available for registration at this time.',
                success: null,
                student: {
                    name: student.name,
                    rollNumber: student.rollNumber
                }
            });
        }

        const formattedCourses = courses.map(course => {
            const courseObj = course.toObject();
            let department = 'N/A';
            let level = 'N/A';
            if (courseObj.code) {
                const codeParts = courseObj.code.split('-');
                if (codeParts.length > 0) {
                    department = codeParts[0];
                }
                
                const matches = courseObj.code.match(/\d+/);
                if (matches && matches[0]) {
                    level = matches[0].charAt(0) + '00';
                }
            }

            return {
                ...courseObj,
                department,
                level,
                availableSeats: courseObj.seats
            };
        });

        console.log('Formatted courses for display:', formattedCourses.length);

        res.render('student/register-courses', {
            courses: formattedCourses,
            error: null,
            success: null,
            student: {
                name: student.name,
                rollNumber: student.rollNumber
            }
        });
    } catch (error) {
        console.error('Error fetching available courses:', error);
        res.status(500).render('student/register-courses', {
            courses: [],
            error: 'Error fetching available courses. Please try again later.',
            success: null,
            student: {
                name: req.session.user.username,
                rollNumber: req.session.user.username
            }
        });
    }
};

exports.getMyCourses = async (req, res) => {
    try {
        const student = await Student.findOne({ rollNumber: req.session.user.username });
        if (!student) {
            return res.status(404).send('Student not found');
        }
        const courses = await Course.find({ enrolledStudents: student._id });
        res.render('student/my-courses', { 
            courses, 
            error: null, 
            success: null,
            student: {
                name: student.name,
                rollNumber: student.rollNumber
            }
        });
    } catch (error) {
        console.error('Error loading my courses:', error);
        res.status(500).send('Error loading my courses');
    }
};

async function checkPrerequisites(studentId, prerequisites) {
    try {
        if (!prerequisites || prerequisites.length === 0) {
            return true;
        }

        const student = await Student.findById(studentId).populate('courses');
        if (!student) return false;
        const completedCourseCodes = student.courses.map(course => course.code);
        for (const prereqCode of prerequisites) {
            if (!completedCourseCodes.includes(prereqCode)) {
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error('Error checking prerequisites:', error);
        return false;
    }
}

exports.registerForCourse = async (req, res) => {
    try {
        const { courseId } = req.body;
        console.log('Attempting to register for course:', courseId);
        console.log('User session:', req.session.user);
        const student = await Student.findOne({ rollNumber: req.session.user.username });
        
        if (!student) {
            console.log('Student not found');
            return res.status(400).json({ 
                success: false, 
                error: "Student not found" 
            });
        }
        console.log('Found student:', student.rollNumber);
        const course = await Course.findById(courseId);
        if (!course) {
            console.log('Course not found');
            return res.status(400).json({ 
                success: false, 
                error: "Course not found" 
            });
        }
        console.log('Found course:', course.code);
        if (course.enrolledStudents.includes(student._id)) {
            console.log('Student already registered for this course');
            return res.status(400).json({ 
                success: false, 
                error: "Already registered for this course" 
            });
        }
        if (course.seats <= 0) {
            console.log('No seats available');
            return res.status(400).json({ 
                success: false, 
                error: "No seats available in this course" 
            });
        }

        if (course.prerequisites && course.prerequisites.length > 0) {
            console.log('Checking prerequisites:', course.prerequisites);
        
            const completedCourses = await Course.find({
                _id: { $in: student.completedCourses || [] }
            });
            console.log('Student completed courses:', completedCourses.map(c => c.code));
            const completedCourseCodes = completedCourses.map(c => c.code);
            const missingPrerequisites = course.prerequisites.filter(prereqCode => 
                !completedCourseCodes.includes(prereqCode)
            );

            if (missingPrerequisites.length > 0) {
                console.log('Missing prerequisites:', missingPrerequisites);
                return res.status(400).json({ 
                    success: false, 
                    error: `Prerequisites not met. Required courses: ${missingPrerequisites.join(', ')}` 
                });
            }
        }

        const enrolledCourses = await Course.find({
            enrolledStudents: student._id
        });
        for (const enrolledCourse of enrolledCourses) {
            if (enrolledCourse._id.equals(course._id)) continue;
            const commonDays = enrolledCourse.days.filter(day => 
                course.days.includes(day)
            );
            
            if (commonDays.length > 0) {
                const newStart = timeToMinutes(course.startTime);
                const newEnd = timeToMinutes(course.endTime);
                const existingStart = timeToMinutes(enrolledCourse.startTime);
                const existingEnd = timeToMinutes(enrolledCourse.endTime);
                if (newStart < existingEnd && newEnd > existingStart && course.room === enrolledCourse.room) {
                    console.log('Schedule and room conflict detected');
                    return res.status(400).json({ 
                        success: false, 
                        error: `Schedule and room conflict with ${enrolledCourse.code} in room ${enrolledCourse.room}` 
                    });
                }
            }
        }

        console.log('All checks passed, proceeding with registration');
        course.enrolledStudents.push(student._id);
        course.seats -= 1;
        await course.save();
        student.courses.push(course._id);
        await student.save();

        console.log('Registration successful');
        return res.json({ 
            success: true,
            message: "Successfully registered for the course"
        });
    } catch (error) {
        console.error('Error registering for course:', error);
        return res.status(500).json({
            success: false,
            error: "Error registering for course. Please try again." 
        });
    }
};
