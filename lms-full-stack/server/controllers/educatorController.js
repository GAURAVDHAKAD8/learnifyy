import { v2 as cloudinary } from 'cloudinary';
import Course from '../models/Course.js';
// Removed Purchase import
import User from '../models/User.js';
import { clerkClient } from '@clerk/express';

// update role to educator
export const updateRoleToEducator = async (req, res) => {
    try {
        const userId = req.auth.userId;

        await clerkClient.users.updateUserMetadata(userId, {
            publicMetadata: {
                role: 'educator',
            },
        });

        res.json({ success: true, message: 'You can publish a course now' });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Add New Course
export const addCourse = async (req, res) => {
    try {
        const { courseData } = req.body;
        const imageFile = req.file;
        const educatorId = req.auth.userId;

        if (!imageFile) {
            return res.json({ success: false, message: 'Thumbnail Not Attached' });
        }

        const parsedCourseData = await JSON.parse(courseData);
        parsedCourseData.educator = educatorId;

        const newCourse = await Course.create(parsedCourseData);

        const imageUpload = await cloudinary.uploader.upload(imageFile.path);
        newCourse.courseThumbnail = imageUpload.secure_url;

        await newCourse.save();

        res.json({ success: true, message: 'Course Added' });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Get Educator Courses
export const getEducatorCourses = async (req, res) => {
    try {
        const educator = req.auth.userId;
        const courses = await Course.find({ educator });
        res.json({ success: true, courses });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Get Educator Dashboard Data ( Total Earning, Enrolled Students, No. of Courses)
export const educatorDashboardData = async (req, res) => {
    try {
        const educator = req.auth.userId;

        // Fetch courses and populate enrolled students
        const courses = await Course.find({ educator }).populate('enrolledStudents', 'name imageUrl createdAt'); // Populate details here

        const totalCourses = courses.length;

        // --- Removed Purchase logic for earnings ---
        const totalEarnings = 0; // Set earnings to 0 as payments are removed

        // Collect enrolled student data directly from courses
        const enrolledStudentsData = [];
        let totalEnrollments = 0; // Use a separate counter for total enrollments

        for (const course of courses) {
            course.enrolledStudents.forEach(student => {
                 if (student) { // Check if student exists (wasn't deleted)
                    enrolledStudentsData.push({
                        courseTitle: course.courseTitle,
                        student // The populated student object
                    });
                    totalEnrollments++; // Increment count for each valid student
                 }
            });
        }

        // Sort studentsData by enrollment date (using createdAt as proxy) if needed
        enrolledStudentsData.sort((a, b) => new Date(b.student.createdAt) - new Date(a.student.createdAt));


        res.json({
            success: true,
            dashboardData: {
                totalEarnings, // Will be 0
                enrolledStudentsData: enrolledStudentsData.slice(0, 10), // Example: Send only latest 10 for dashboard display
                totalEnrollments, // Send the total count
                totalCourses
            }
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};


// Get Enrolled Students Data (Modified to not use Purchase)
export const getEnrolledStudentsData = async (req, res) => {
    try {
        const educator = req.auth.userId;

        // Fetch all courses created by the educator and populate enrolled students
        const courses = await Course.find({ educator })
                                    .populate('enrolledStudents', 'name imageUrl createdAt'); // Populate student details here

        // enrolled students data
        const enrolledStudents = [];
        courses.forEach(course => {
            course.enrolledStudents.forEach(student => {
                 if (student) { // Check if student exists
                     enrolledStudents.push({
                        student: student, // The populated student object
                        courseTitle: course.courseTitle,
                        // Using student createdAt as a proxy for enrollment/purchase date
                        // Alternatively, you could use course.createdAt if more appropriate
                        enrollmentDate: student.createdAt
                     });
                 }
            });
        });

         // Sort by date if needed (using createdAt as a proxy for purchase date)
         enrolledStudents.sort((a, b) => new Date(b.enrollmentDate) - new Date(a.enrollmentDate));

        res.json({
            success: true,
            enrolledStudents
        });

    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
};