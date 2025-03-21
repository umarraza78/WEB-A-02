const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    rollNumber: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    courses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        default: []
    }],
    completedCourses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        default: []
    }],
    role: {
        type: String,
        default: 'student'
    }
}, {
    timestamps: true
});


studentSchema.pre('save', function(next) {
    if (!this.courses) {
        this.courses = [];
    }
    if (!this.completedCourses) {
        this.completedCourses = [];
    }
    console.log('Saving student:', this.rollNumber);
    next();
});

studentSchema.methods.hasCompletedPrerequisites = async function(prerequisites) {
    if (!prerequisites || prerequisites.length === 0) return true;
    
    await this.populate('courses');
    const completedCourseCodes = this.courses.map(course => course.code);
    return prerequisites.every(prereq => completedCourseCodes.includes(prereq));
};


studentSchema.methods.hasScheduleConflict = async function(newCourse) {
    await this.populate('courses');
    
    for (const existingCourse of this.courses) {
        const commonDays = existingCourse.days.filter(day => 
            newCourse.days.includes(day)
        );

        if (commonDays.length > 0) {
            const existingStart = timeToMinutes(existingCourse.startTime);
            const existingEnd = timeToMinutes(existingCourse.endTime);
            const newStart = timeToMinutes(newCourse.startTime);
            const newEnd = timeToMinutes(newCourse.endTime);
            if (!(newEnd <= existingStart || newStart >= existingEnd)) {
                return {
                    hasConflict: true,
                    conflictingCourse: existingCourse
                };
            }
        }
    }

    return { hasConflict: false };
};

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

const Student = mongoose.models.Student || mongoose.model("Student", studentSchema);

module.exports = Student;
