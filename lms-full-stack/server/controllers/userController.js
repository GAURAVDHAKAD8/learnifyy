import Course from "../models/Course.js";
import { CourseProgress } from "../models/CourseProgress.js";
// Removed Purchase import
import User from "../models/User.js";
// Removed stripe import

// Get User Data
export const getUserData = async (req, res) => {
    try {
        const userId = req.auth.userId;
        const user = await User.findById(userId);

        if (!user) {
            return res.json({ success: false, message: 'User Not Found' });
        }

        res.json({ success: true, user });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Enroll Course (Replaces purchaseCourse)
export const enrollCourse = async (req, res) => {
    try {
        const { courseId } = req.body;
        const userId = req.auth.userId;

        const courseData = await Course.findById(courseId);
        const userData = await User.findById(userId);

        if (!userData || !courseData) {
            return res.json({ success: false, message: 'Data Not Found' });
        }

        // Check if already enrolled
        if (userData.enrolledCourses.includes(courseId)) {
            // You might want to return a specific message or status code
            return res.json({ success: true, message: 'Already Enrolled' });
        }

        // Add course to user's enrolled courses
        userData.enrolledCourses.push(courseData._id);
        await userData.save();

        // Add user to course's enrolled students
        courseData.enrolledStudents.push(userData._id); // Assuming the model expects IDs
        await courseData.save();

        res.json({ success: true, message: 'Enrollment Successful' });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};


// Users Enrolled Courses With Lecture Links
export const userEnrolledCourses = async (req, res) => {
    try {
        const userId = req.auth.userId;
        const userData = await User.findById(userId)
            .populate('enrolledCourses');

        res.json({ success: true, enrolledCourses: userData.enrolledCourses });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Update User Course Progress
export const updateUserCourseProgress = async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { courseId, lectureId } = req.body;
        const progressData = await CourseProgress.findOne({ userId, courseId });

        if (progressData) {
            if (progressData.lectureCompleted.includes(lectureId)) {
                return res.json({ success: true, message: 'Lecture Already Completed' });
            }
            progressData.lectureCompleted.push(lectureId);
            await progressData.save();
        } else {
            await CourseProgress.create({
                userId,
                courseId,
                lectureCompleted: [lectureId]
            });
        }
        res.json({ success: true, message: 'Progress Updated' });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// get User Course Progress
export const getUserCourseProgress = async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { courseId } = req.body;
        const progressData = await CourseProgress.findOne({ userId, courseId });

        res.json({ success: true, progressData });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Add User Ratings to Course
export const addUserRating = async (req, res) => {
    const userId = req.auth.userId;
    const { courseId, rating } = req.body;

    // Validate inputs
    if (!courseId || !userId || !rating || rating < 1 || rating > 5) {
        return res.json({ success: false, message: 'Invalid Details' });
    }

    try {
        // Find the course by ID
        const course = await Course.findById(courseId);

        if (!course) {
            return res.json({ success: false, message: 'Course not found.' });
        }

        const user = await User.findById(userId);

        // Check if the user is enrolled (using the updated logic)
        if (!user || !user.enrolledCourses.includes(courseId)) {
             // Changed message slightly as 'purchase' is removed
            return res.json({ success: false, message: 'User is not enrolled in this course.' });
        }

        // Check if user already rated
        const existingRatingIndex = course.courseRatings.findIndex(r => r.userId === userId);

        if (existingRatingIndex > -1) {
            // Update the existing rating
            course.courseRatings[existingRatingIndex].rating = rating;
        } else {
            // Add a new rating
            course.courseRatings.push({ userId, rating });
        }

        await course.save();

        return res.json({ success: true, message: 'Rating added' });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};