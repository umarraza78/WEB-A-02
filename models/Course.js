const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  department: { type: String, required: true },
  credits: { type: Number, required: true },
  description: { type: String, required: true },
  instructor: { type: String, required: true },
  days: [{ type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], required: true }],
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  room: { type: String, required: true },
  seats: { type: Number, required: true, default: 30 },
  prerequisites: [{
    type: String,
    validate: {
      validator: async function(courseCode)
       {
        if (!courseCode) return true;
        if (courseCode === this.code) {
          return false;
        }
        
        const Course = mongoose.model('Course');
        const prerequisiteCourse = await Course.findOne({ code: courseCode });
        return !!prerequisiteCourse;
      },
      message: props => `Prerequisite course ${props.value} does not exist or is invalid!`
    }
  }],
  semester: { type: String, required: true },
  level: { type: String, required: true, enum: ['BS', 'MS', 'PhD', '1', '2', '3', '4'] },
  enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }]
}, {
  timestamps: true, 
  strict: true 
});
courseSchema.pre('save', function(next) {
  console.log('Saving course:', this.code);
  console.log('Course data:', this.toObject());
  next();
});

courseSchema.pre('remove', function(next) {
  console.log('Removing course:', this.code);
  next();
});

courseSchema.pre('findOneAndUpdate', function(next) {
  console.log('Updating course with query:', this.getQuery());
  console.log('Update operation:', this.getUpdate());
  next();
});

courseSchema.methods.validatePrerequisites = async function() {
  if (!this.prerequisites || this.prerequisites.length === 0) {
    return true;
  }

  const Course = mongoose.model('Course');
  const invalidPrereqs = [];

  for (const prereqCode of this.prerequisites) {
    if (!prereqCode) continue;
    if (prereqCode === this.code) {
      invalidPrereqs.push(`${prereqCode} (self-reference not allowed)`);
      continue;
    }

    const prereqExists = await Course.findOne({ code: prereqCode });
    if (!prereqExists) {
      invalidPrereqs.push(prereqCode);
    }
  }

  return invalidPrereqs.length === 0 ? true : invalidPrereqs;
};

courseSchema.statics.findByCode = function(code) {
  return this.findOne({ code: code });
};

courseSchema.methods.getPrerequisitesDetails = async function() {
  if (!this.prerequisites || this.prerequisites.length === 0) {
    return [];
  }
  
  const prerequisiteCourses = await this.model('Course').find({
    code: { $in: this.prerequisites }
  }).select('code name');
  
  return prerequisiteCourses;
};

const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);

module.exports = Course;
