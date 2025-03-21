const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');


const isStudent = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'student') {
        next();
    } else {
        res.redirect('/auth/login');
    }
};


router.use(isStudent);
router.get('/', studentController.getDashboard);
router.get('/dashboard', studentController.getDashboard);

router.get('/schedule', studentController.getSchedule);
router.get('/register-courses', studentController.getAvailableCourses);
router.post('/register', studentController.registerForCourse);

//for courses
router.get('/my-courses', studentController.getMyCourses);
router.post('/drop-course', studentController.dropCourse);

module.exports = router; 