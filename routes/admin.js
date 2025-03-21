const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');


const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.redirect('/auth/login');
    }
};


router.use(isAdmin);
router.get('/', adminController.getDashboard);
router.get('/dashboard', adminController.getDashboard);
router.get('/courses', adminController.getCourses);
router.get('/courses/new', adminController.getNewCourseForm);
router.post('/courses', adminController.createCourse);
router.get('/courses/:id/edit', adminController.getEditCourseForm);
router.put('/courses/:id', adminController.updateCourse);
router.delete('/courses/:id', adminController.deleteCourse);
router.get('/registrations', adminController.getStudentRegistrations);
router.post('/registrations/override', adminController.overrideRegistration);
router.post('/registrations/complete-course', adminController.markCourseComplete);
router.get('/reports', adminController.getReports);
router.post('/reports/generate', adminController.generateReport);

module.exports = router;
