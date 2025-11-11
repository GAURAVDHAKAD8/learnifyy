import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import axios from 'axios';
import { Line } from 'rc-progress';
import Footer from '../../components/student/Footer';
import { toast } from 'react-toastify'; // Import toast

const MyEnrollments = () => {
    // Added toast to useContext destructuring if it wasn't already implicitly available
    const { userData, enrolledCourses, fetchUserEnrolledCourses, navigate, backendUrl, getToken, calculateCourseDuration, calculateNoOfLectures } = useContext(AppContext);

    const [progressArray, setProgressData] = useState([]); // Initialize as empty array
    const [isLoading, setIsLoading] = useState(true); // Add loading state

    const getCourseProgress = async () => {
        if (!enrolledCourses || enrolledCourses.length === 0 || !getToken) {
            setProgressData([]); // Reset progress if no courses or token function
            setIsLoading(false); // Stop loading if no courses
            return;
        }
        setIsLoading(true); // Start loading when fetching
        try {
            const token = await getToken();
             if (!token) {
                 console.error("Failed to get auth token for progress.");
                 setProgressData([]);
                 setIsLoading(false);
                 return;
             }

            // Use Promise.allSettled to handle potential errors for individual courses
            const progressResults = await Promise.allSettled(
                enrolledCourses.map(async (course) => {
                    if (!course?._id) return { status: 'rejected', reason: 'Invalid course ID' }; // Skip if course ID is missing

                    const { data } = await axios.post(
                        `${backendUrl}/api/user/get-course-progress`,
                        { courseId: course._id },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );

                     if (!data.success && data.message !== 'Progress Not Found') {
                         throw new Error(`Failed to get progress for ${course.courseTitle}: ${data.message}`);
                     }

                    // Calculate total lectures safely
                    let totalLectures = calculateNoOfLectures(course);
                    // Ensure totalLectures is not zero to prevent division by zero
                     if (totalLectures === 0) totalLectures = 1; // Avoid division by zero, treat as 1 if no lectures found

                    const lectureCompleted = data.progressData?.lectureCompleted?.length || 0;
                    return { totalLectures, lectureCompleted };
                })
            );

            // Process results, setting defaults for failed requests
            const tempProgressArray = progressResults.map(result => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    console.error("Error fetching progress:", result.reason);
                    // Return a default state for courses where progress fetch failed
                    return { totalLectures: 1, lectureCompleted: 0 };
                }
            });


            setProgressData(tempProgressArray);
        } catch (error) {
            // General error for Promise.allSettled or token issues
            toast.error(`Error fetching course progress: ${error.message}`);
            setProgressData(enrolledCourses.map(() => ({ totalLectures: 1, lectureCompleted: 0 }))); // Set default for all on major error
        } finally {
             setIsLoading(false); // Stop loading regardless of outcome
        }
    };

    // Fetch enrolled courses only when userData is available
    useEffect(() => {
        if (userData?._id) { // Check if userData exists and has an ID
            fetchUserEnrolledCourses();
        } else {
            // If no userData, clear enrolled courses (handled in AppContext now)
            // setEnrolledCourses([]); // This might be redundant if AppContext handles it
            setIsLoading(false); // Ensure loading stops if there's no user
        }
    }, [userData]); // Rerun when userData changes


    // Fetch progress after enrolledCourses are loaded
    useEffect(() => {
        if (enrolledCourses.length > 0) {
            getCourseProgress();
        } else {
             // If enrolledCourses becomes empty (e.g., after logout), clear progress
             setProgressData([]);
             setIsLoading(false);
        }
    }, [enrolledCourses, getToken]); // Rerun if enrolledCourses or getToken changes


     // Loading state display
     if (!userData && !isLoading) {
         return (
              <>
                 <div className='md:px-36 px-8 pt-10 text-center'>
                    <h1 className='text-2xl font-semibold mb-10'>My Enrollments</h1>
                    <p className='text-gray-500'>Please log in to see your enrolled courses.</p>
                 </div>
                 <Footer />
              </>
         )
     }

     if (isLoading && enrolledCourses.length === 0 && !userData) {
         // Initial load before user data is checked
         return (
             <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
                 <div className="w-12 h-12 border-4 border-gray-300 border-t-4 border-t-blue-500 rounded-full animate-spin"></div>
             </div>
         );
     }


    return (
        <>
            <div className='md:px-36 px-8 pt-10 min-h-[calc(100vh-200px)]'> {/* Add min-height */}
                <h1 className='text-2xl font-semibold'>My Enrollments</h1>

                {isLoading && enrolledCourses.length > 0 && ( // Show loading only when fetching progress for existing courses
                     <div className="flex items-center justify-center py-10">
                         <div className="w-8 h-8 border-4 border-gray-300 border-t-4 border-t-blue-500 rounded-full animate-spin"></div>
                         <p className="ml-3 text-gray-600">Loading progress...</p>
                     </div>
                 )}

                 {!isLoading && enrolledCourses.length === 0 && userData && (
                     <p className='text-gray-500 mt-10 text-center'>You haven't enrolled in any courses yet.</p>
                 )}


                 {!isLoading && enrolledCourses.length > 0 && (
                     <div className="overflow-x-auto"> {/* Added for small screens */}
                        <table className="md:table-auto table-fixed w-full overflow-hidden border mt-10 ">
                            <thead className="text-gray-900 border-b border-gray-500/20 text-sm text-left max-sm:hidden bg-gray-50"> {/* Added bg */}
                                <tr>
                                    <th className="px-4 py-3 font-semibold truncate">Course</th>
                                    <th className="px-4 py-3 font-semibold truncate max-sm:hidden">Duration</th>
                                    <th className="px-4 py-3 font-semibold truncate max-sm:hidden">Completed</th>
                                    <th className="px-4 py-3 font-semibold truncate text-center">Status</th> {/* Centered Status */}
                                </tr>
                            </thead>
                            <tbody className="text-gray-700">
                                {enrolledCourses.map((course, index) => {
                                     // Safely calculate percentage
                                     const currentProgress = progressArray[index];
                                     const totalLectures = currentProgress?.totalLectures || 1; // Default to 1 to avoid NaN
                                     const lecturesCompleted = currentProgress?.lectureCompleted || 0;
                                     const percent = totalLectures > 0 ? (lecturesCompleted * 100) / totalLectures : 0;
                                     const isCompleted = percent === 100;

                                    return (
                                        <tr key={course?._id || index} className="border-b border-gray-500/20 hover:bg-gray-50 align-middle"> {/* Added key, hover, align-middle */}
                                            <td className="md:px-4 pl-2 md:pl-4 py-3 flex items-center space-x-3 ">
                                                {/* Added check for thumbnail */}
                                                <img src={course?.courseThumbnail || 'placeholder.png'} alt={`${course?.courseTitle || 'Course'} thumbnail`} className="w-14 sm:w-24 md:w-28 flex-shrink-0 object-cover aspect-video rounded" /> {/* Added styling */}
                                                <div className='flex-1 min-w-0'> {/* Added min-w-0 */}
                                                    <p className='mb-1 max-sm:text-sm font-medium truncate'>{course?.courseTitle || 'Course Title Missing'}</p> {/* Added truncate */}
                                                    {/* Ensure percent is calculated */}
                                                    <Line className='bg-gray-300 rounded-full h-1.5' trailWidth={6} strokeWidth={6} percent={percent} strokeColor={isCompleted ? '#10B981' : '#3B82F6'} /> {/* Adjusted size/color */}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 max-sm:hidden whitespace-nowrap">{calculateCourseDuration(course)}</td> {/* Added nowrap */}
                                            <td className="px-4 py-3 max-sm:hidden whitespace-nowrap">
                                                 {/* Check if progressArray[index] exists */}
                                                 {currentProgress ? `${lecturesCompleted} / ${totalLectures}` : '0 / 0'}
                                                <span className='text-xs ml-2'>Lectures</span>
                                            </td>
                                            <td className="px-4 py-3 text-center"> {/* Centered */}
                                                <button
                                                    onClick={() => navigate('/player/' + course?._id)} // Added optional chaining
                                                     className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-md max-sm:text-xs text-white text-xs font-medium ${isCompleted ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`} // Added rounded-md, hover
                                                     disabled={!course?._id} // Disable if no course ID
                                                >
                                                    {isCompleted ? 'Completed' : 'Go to Course'} {/* Changed 'On Going' */}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                 )}
            </div>
            <Footer />
        </>
    );
};

export default MyEnrollments;