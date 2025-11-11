import express from 'express';
// Import enrollCourse instead of purchaseCourse
import { addUserRating, getUserCourseProgress, getUserData, enrollCourse, updateUserCourseProgress, userEnrolledCourses } from '../controllers/userController.js';

const userRouter = express.Router();

// Get user Data
userRouter.get('/data', getUserData);
// Changed '/purchase' to '/enroll' and linked to enrollCourse
userRouter.post('/enroll', enrollCourse);
userRouter.get('/enrolled-courses', userEnrolledCourses);
userRouter.post('/update-course-progress', updateUserCourseProgress);
userRouter.post('/get-course-progress', getUserCourseProgress);
userRouter.post('/add-rating', addUserRating);

export default userRouter;