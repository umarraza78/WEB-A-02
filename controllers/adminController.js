const Admin = require('../models/Admin');
const Course = require('../models/Course');
const Student = require('../models/Student');
const mongoose = require('mongoose');


exports.login = (req, res) => {
  res.render('admin/login');
};


exports.getDashboard = async (req, res) => {
    try {
       
        const studentCount = await Student.countDocuments();
        const courseCount = await Course.countDocuments();
        const registrationCount = await Course.aggregate([
            { $group: { _id: null, total: { $sum: { $size: "$enrolledStudents" } } } }
        ]);
        const recentRegistrations = await Course.find()
            .sort({ updatedAt: -1 })
            .limit(5)
            .populate('enrolledStudents', 'name rollNumber');

        res.render('admin/dashboard', {
            studentCount,
            courseCount,
            registrationCount: registrationCount[0]?.total || 0,
            recentRegistrations
        });
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        res.status(500).send('Error loading admin dashboard');
    }
};

exports.manageCourses = async (req, res) => {
  const courses = await Course.find({});
  res.render('admin/courses', { courses });
};

exports.getCourses = async (req, res) => {
    try {
        const courses = await Course.find();
        res.render("admin/courses/index", { courses });
    } catch (error) {
        console.error("Error fetching courses:", error);
        res.status(500).send("Error loading courses");
    }
};

exports.getNewCourseForm = (req, res) => {
    res.render("admin/courses/new", {
        error: null,
        formData: null
    });
};

exports.createCourse = async (req, res) => {
    try {
        const {
            code,
            name,
            department,
            credits,
            level,
            description,
            instructor,
            days,
            startTime,
            endTime,
            room,
            seats,
            prerequisites,
            semester
        } = req.body;

       
        const daysArray = Array.isArray(days) ? days : [days];
        const prerequisitesArray = prerequisites ? 
            (Array.isArray(prerequisites) ? prerequisites : [prerequisites]) : 
            [];

        const course = new Course({
            code,
            name,
            department,
            credits: parseInt(credits),
            level: parseInt(level),
            description,
            instructor,
            days: daysArray,
            startTime,
            endTime,
            room,
            seats: parseInt(seats),
            prerequisites: prerequisitesArray,
            semester
        });

        await course.save();
        res.redirect("/admin/courses");
    } catch (error) {
        console.error("Error creating course:", error);
        res.render("admin/courses/new", { 
            error: "Error creating course. Please try again.",
            formData: req.body
        });
    }
};

exports.getEditCourseForm = async (req, res) => {
    try {
        // Find the current course
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).send("Course not found");
        }
        const availableCourses = await Course.find({
            _id: { $ne: course._id }
        }).select('code name').sort('code');

        console.log('Current course prerequisites:', course.prerequisites);
        console.log('Available courses for prerequisites:', availableCourses);

        res.render("admin/courses/edit", { 
            course,
            availableCourses,
            error: null 
        });
    } catch (error) {
        console.error("Error fetching course:", error);
        res.status(500).send("Error loading course");
    }
};

exports.updateCourse = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Database connection is not ready');
        }

        console.log('Updating course with ID:', req.params.id);
        console.log('Update data:', req.body);

        const {
            code,
            name,
            department,
            credits,
            level,
            description,
            instructor,
            days,
            startTime,
            endTime,
            room,
            seats,
            prerequisites,
            semester
        } = req.body;

       
        const daysArray = Array.isArray(days) ? days : [days];
        let prerequisitesArray = [];
        if (prerequisites) {
            prerequisitesArray = Array.isArray(prerequisites) ? prerequisites : [prerequisites];
        }

        console.log('Processing prerequisites:', prerequisitesArray);

        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).render("admin/courses/edit", {
                course: req.body,
                error: "Course not found"
            });
        }

        const hasCircular = await checkCircularPrerequisites(code, prerequisitesArray);
        if (hasCircular) {
            const availableCourses = await Course.find({
                _id: { $ne: req.params.id }
            }).select('code name');

            return res.render("admin/courses/edit", {
                course: { ...req.body, _id: req.params.id },
                availableCourses,
                error: "Circular prerequisite dependency detected. Please check your selection."
            });
        }

        const prereqValidation = await validatePrerequisites(prerequisitesArray);
        if (!prereqValidation.valid) {
            const availableCourses = await Course.find({
                _id: { $ne: req.params.id }
            }).select('code name');

            return res.render("admin/courses/edit", {
                course: { ...req.body, _id: req.params.id },
                availableCourses,
                error: `Invalid prerequisites: ${prereqValidation.invalid.join(', ')}`
            });
        }

        const updateData = {
            code,
            name,
            department,
            credits: parseInt(credits),
            level,
            description,
            instructor,
            days: daysArray,
            startTime,
            endTime,
            room,
            seats: parseInt(seats),
            prerequisites: prerequisitesArray,
            semester
        };

        console.log('Formatted update data:', updateData);

        const updatedCourse = await Course.findByIdAndUpdate(
            req.params.id,
            updateData,
            { 
                new: true, 
                runValidators: true,
                upsert: false
            }
        );

        console.log('Updated course:', updatedCourse);

        if (!updatedCourse) {
            console.log('Course not found for update');
            return res.status(404).render("admin/courses/edit", {
                course: req.body,
                error: "Course not found"
            });
        }

        const verifiedCourse = await Course.findById(req.params.id);
        console.log('Verification - Course after update:', verifiedCourse);
        console.log('Updated prerequisites:', verifiedCourse.prerequisites);

        res.redirect("/admin/courses");
    } catch (error) {
        console.error("Error updating course:", error);
        console.error("Stack trace:", error.stack);

        const availableCourses = await Course.find({
            _id: { $ne: req.params.id }
        }).select('code name');

        res.render("admin/courses/edit", { 
            course: { ...req.body, _id: req.params.id },
            availableCourses,
            error: `Error updating course: ${error.message}`
        });
    }
};

async function checkCircularPrerequisites(courseCode, prerequisites, visited = new Set()) {
    if (visited.has(courseCode)) {
        return true; // Circular dependency found
    }

    visited.add(courseCode);

    for (const prereqCode of prerequisites) {
        const prereqCourse = await Course.findOne({ code: prereqCode });
        if (prereqCourse && prereqCourse.prerequisites.length > 0) {
            if (await checkCircularPrerequisites(prereqCode, prereqCourse.prerequisites, new Set(visited))) {
                return true;
            }
        }
    }

    return false;
}

async function validatePrerequisites(prerequisites) {
    const invalid = [];
    
    for (const prereqCode of prerequisites) {
        const prereqExists = await Course.findOne({ code: prereqCode });
        if (!prereqExists) {
            invalid.push(prereqCode);
        }
    }

    return {
        valid: invalid.length === 0,
        invalid
    };
}

exports.deleteCourse = async (req, res) => {
    try {
        // Check database connection
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Database connection is not ready');
        }

        console.log('Attempting to delete course with ID:', req.params.id);

        const courseToDelete = await Course.findById(req.params.id);
        if (!courseToDelete) {
            console.log('Course not found for deletion');
            return res.status(404).send("Course not found");
        }

        console.log('Found course to delete:', courseToDelete);

        const deletedCourse = await Course.findByIdAndDelete(req.params.id);
        console.log('Delete operation result:', deletedCourse);
        const verifyDeletion = await Course.findById(req.params.id);
        if (verifyDeletion) {
            console.error('Course still exists after deletion attempt');
            throw new Error('Failed to delete course - document still exists');
        }

        console.log('Course successfully deleted');
        res.redirect("/admin/courses");
    } catch (error) {
        console.error("Error deleting course:", error);
        console.error("Stack trace:", error.stack);
        res.status(500).send(`Error deleting course: ${error.message}`);
    }
};
exports.getStudentRegistrations = async (req, res) => {
    try {
        const students = await Student.find().select('rollNumber name');
        const courses = await Course.find().populate('enrolledStudents', 'rollNumber name');
        
        res.render('admin/registrations', { 
            students,
            courses,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).send('Error loading registrations');
    }
};

exports.overrideRegistration = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    try {
        const { studentId, courseId, action } = req.body;

       
        if (!studentId || !courseId || !action) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        const student = await Student.findById(studentId);
        const course = await Course.findById(courseId);

        if (!student || !course) {
            return res.status(404).json({
                success: false,
                error: 'Student or course not found'
            });
        }

        if (action === 'add') {
            // Check if student is already enrolled
            if (course.enrolledStudents.includes(studentId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Student is already enrolled in this course'
                });
            }

           
            if (course.seats <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No seats available in this course'
                });
            }

            
            course.enrolledStudents.push(studentId);
            course.seats -= 1;
            await course.save();

            return res.status(200).json({
                success: true,
                message: 'Student successfully enrolled in course',
                newSeatCount: course.seats
            });

        } 
        else if (action === 'remove')
            
            {
            const studentIndex = course.enrolledStudents.indexOf(studentId);
            if (studentIndex === -1) {
                return res.status(400).json({
                    success: false,
                    error: 'Student is not enrolled in this course'
                });
            }

            
            course.enrolledStudents.splice(studentIndex, 1);
            course.seats += 1;
            await course.save();

            return res.status(200).json({
                success: true,
                message: 'Student successfully removed from course',
                newSeatCount: course.seats
            });
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid action'
            });
        }
    } catch (error) {
        console.error('Error in overrideRegistration:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
};


exports.getReports = async (req, res) => {
    try {
       
        const courses = await Course.find().select('code name');
        
        res.render('admin/reports', {
            courses,
            error: null,
            success: null,
            reportData: null,
            reportType: null
        });
    } catch (error) {
        console.error('Error loading reports page:', error);
        res.status(500).send('Error loading reports page');
    }
};

exports.generateReport = async (req, res) => {
    try {
        const { reportType, courseId } = req.body;
        let reportData = null;
        let reportTitle = '';
        let error = null;
        if (!reportType) {
            error = 'Please select a report type';
        } else {
            switch (reportType) {
                case 'enrollment':
                    if (!courseId) {
                        error = 'Please select a course for enrollment report';
                    } else {
                        const course = await Course.findById(courseId).populate('enrolledStudents');
                        if (!course) {
                            error = 'Course not found';
                        } else {
                            reportData = course.enrolledStudents;
                            reportTitle = `Enrollment Report for ${course.code} - ${course.name}`;
                        }
                    }
                    break;

                case 'missing-prerequisites':
                    if (!courseId) {
                        error = 'Please select a course for prerequisites report';
                    } else {
                        const targetCourse = await Course.findById(courseId);
                        if (!targetCourse) {
                            error = 'Course not found';
                        } else {
                            const students = await Student.find().populate('completedCourses');
                            if (!targetCourse.prerequisites || targetCourse.prerequisites.length === 0) {
                                reportData = [];
                                reportTitle = `Missing Prerequisites Report for ${targetCourse.code} - ${targetCourse.name}`;
                            } else {
                                reportData = students.filter(student => {
                                    const completedCourseCodes = student.completedCourses.map(c => c.code);
                                    return targetCourse.prerequisites.some(prereq => 
                                        !completedCourseCodes.includes(prereq)
                                    );
                                }).map(student => ({
                                    name: student.name,
                                    rollNumber: student.rollNumber,
                                    department: student.department,
                                    missingPrerequisites: targetCourse.prerequisites.filter(prereq => 
                                        !student.completedCourses.some(c => c.code === prereq)
                                    )
                                }));
                                reportTitle = `Missing Prerequisites Report for ${targetCourse.code} - ${targetCourse.name}`;
                            }
                        }
                    }
                    break;

                case 'seat-availability':
                    const courses = await Course.find().select('code name seats');
                    reportData = courses;
                    reportTitle = 'Course Seat Availability Report';
                    break;

                default:
                    error = 'Invalid report type';
            }
        }
        const courses = await Course.find().select('code name');

        res.render('admin/reports', {
            reportData,
            reportType,
            reportTitle,
            courses,
            error,
            success: null
        });
    } catch (error) {
        console.error('Error generating report:', error);
        res.render('admin/reports', {
            reportData: null,
            reportType: req.body.reportType,
            reportTitle: 'Error Generating Report',
            courses: await Course.find().select('code name'),
            error: 'Error generating report. Please try again.',
            success: null
        });
    }
};

exports.markCourseComplete = async (req, res) => {
    try {
        const { studentId, courseId } = req.body;
        
        const student = await Student.findById(studentId);
        const course = await Course.findById(courseId);
        
        if (!student || !course) {
            return res.status(404).json({ 
                error: 'Student or course not found' 
            });
        }

        if (!course.enrolledStudents.includes(student._id)) {
            return res.status(400).json({ 
                error: 'Student is not enrolled in this course' 
            });
        }

        if (!student.completedCourses) {
            student.completedCourses = [];
        }
        if (!student.completedCourses.includes(course._id)) {
            student.completedCourses.push(course._id);
            await student.save();
        }

        course.enrolledStudents = course.enrolledStudents.filter(
            id => !id.equals(student._id)
        );
        course.seats += 1;
        await course.save();

        return res.json({ 
            success: true, 
            message: 'Course marked as complete and student dropped from course'
        });
    } catch (error) {
        console.error('Error marking course as complete:', error);
        res.status(500).json({ 
            error: 'Error marking course as complete' 
        });
    }
};

exports.handleError = (err, req, res, next) => {
    console.error('Admin Controller Error:', err);
    
    if (res.headersSent) {
        return next(err);
    }

    
    if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: err.message
        });
    }

    
    res.status(500).render('error', {
        error: 'An error occurred',
        details: err.message
    });
};
