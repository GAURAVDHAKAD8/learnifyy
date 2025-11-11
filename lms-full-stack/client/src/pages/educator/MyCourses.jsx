import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import Loading from '../../components/student/Loading';

const MyCourses = () => {
    // Removed currency from context destructuring
    const { backendUrl, isEducator, getToken } = useContext(AppContext);

    const [courses, setCourses] = useState(null);

    const fetchEducatorCourses = async () => {
        try {
            const token = await getToken();
            const { data } = await axios.get(backendUrl + '/api/educator/courses', { headers: { Authorization: `Bearer ${token}` } });
            if (data.success) {
                setCourses(data.courses);
            } else {
                toast.error(data.message); // Added error toast for unsuccessful fetch
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    useEffect(() => {
        if (isEducator) {
            fetchEducatorCourses();
        }
    }, [isEducator]);

    return courses ? (
        // Changed min-h-screen to h-auto to prevent potential overflow issues, added pb-8
        <div className="flex flex-col items-start md:p-8 p-4 pt-8 pb-8">
            <div className='w-full'>
                <h2 className="pb-4 text-lg font-medium text-gray-800">My Courses</h2> {/* Added text color */}
                {/* Added overflow-x-auto for smaller screens */}
                <div className="flex flex-col items-center max-w-4xl w-full overflow-hidden rounded-md bg-white border border-gray-500/20 overflow-x-auto">
                    {/* Changed table layout for better responsiveness */}
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 text-gray-900 text-sm text-left"> {/* Added bg-gray-50 */}
                            <tr>
                                <th scope="col" className="px-4 py-3 font-semibold tracking-wider">Course</th> {/* Changed header text */}
                                {/* Removed Earnings header */}
                                <th scope="col" className="px-4 py-3 font-semibold tracking-wider">Students</th>
                                <th scope="col" className="px-4 py-3 font-semibold tracking-wider">Published On</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-sm text-gray-500"> {/* Added bg-white and divide-y */}
                            {courses.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="px-4 py-4 text-center text-gray-500">No courses found.</td>
                                </tr>
                            ) : (
                                courses.map((course) => (
                                    <tr key={course._id} className="hover:bg-gray-50"> {/* Added hover effect */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center space-x-3">
                                                <img src={course.courseThumbnail} alt={course.courseTitle || "Course Image"} className="w-16 h-9 object-cover rounded" /> {/* Added alt text, fixed height, rounded */}
                                                <span className="font-medium text-gray-900">{course.courseTitle}</span> {/* Added font-medium and text color */}
                                            </div>
                                        </td>
                                        {/* Removed Earnings data cell */}
                                        <td className="px-4 py-3 whitespace-nowrap">{course.enrolledStudents.length}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {new Date(course.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    ) : <Loading />;
};

export default MyCourses;