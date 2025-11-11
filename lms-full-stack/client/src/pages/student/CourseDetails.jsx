import React, { useContext, useEffect, useState } from 'react';
import Footer from '../../components/student/Footer';
import { assets } from '../../assets/assets';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AppContext } from '../../context/AppContext';
import { toast } from 'react-toastify';
import humanizeDuration from 'humanize-duration';
import YouTube from 'react-youtube';
import Loading from '../../components/student/Loading'; // Keep if you restored the file

// Helper function to extract YouTube Video ID
const getYouTubeVideoId = (url) => {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    try {
        const vMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (vMatch && vMatch[1]) return vMatch[1];
        const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (shortMatch && shortMatch[1]) return shortMatch[1];
        const embedMatch = trimmed.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
        if (embedMatch && embedMatch[1]) return embedMatch[1];
        const anyMatch = trimmed.match(/([a-zA-Z0-9_-]{11})/);
        if (anyMatch && anyMatch[1]) return anyMatch[1];
        return null;
    } catch (error) {
        console.error("Error parsing YouTube URL:", url, error);
        return null;
    }
};


const CourseDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [courseData, setCourseData] = useState(null);
    const [playerData, setPlayerData] = useState(null);
    const [isAlreadyEnrolled, setIsAlreadyEnrolled] = useState(false);
    const [isLoadingCourse, setIsLoadingCourse] = useState(true); // Initialize loading to true

    const {
        backendUrl, userData, setUserData, isUserDataLoading,
        calculateChapterTime, calculateCourseDuration, calculateRating, calculateNoOfLectures, getToken
    } = useContext(AppContext);

    // Fetch Course Data Effect
    useEffect(() => {
        let isMounted = true; // Flag to prevent state update on unmounted component
        const fetchCourse = async () => {
            // Reset state for new course ID and start loading
            setCourseData(null);
            setPlayerData(null);
            setIsLoadingCourse(true);
            try {
                const { data } = await axios.get(`${backendUrl}/api/course/${id}`);
                if (isMounted) {
                    if (data.success) {
                        setCourseData(data.courseData);
                    } else {
                        toast.error(data.message);
                        navigate('/'); // Navigate home if course not found by backend
                    }
                }
            } catch (error) {
                 if (isMounted) {
                    console.error('fetchCourse error:', error.response ?? error);
                    toast.error(`Failed to load course: ${error.response?.data?.message || error.message}`);
                    navigate('/'); // Navigate home on fetch error
                 }
            } finally {
                 if (isMounted) {
                     setIsLoadingCourse(false); // Stop loading only if component is still mounted
                 }
            }
        };

        fetchCourse();

        // Cleanup function to set isMounted to false when component unmounts
        return () => {
            isMounted = false;
        };
    }, [id, backendUrl, navigate]); // Dependencies


    // Update Enrollment Status Effect
     useEffect(() => {
        // This effect runs *after* courseData might be set and *after* user data loading state changes
        if (!isLoadingCourse && !isUserDataLoading && userData && courseData) {
            setIsAlreadyEnrolled(userData.enrolledCourses?.includes(courseData._id) || false);
        } else if (!isUserDataLoading && !userData) {
             // Reset enrollment status if user logs out or data fails to load
             setIsAlreadyEnrolled(false);
        }
        // Do not run while either course or user data is loading
    }, [isLoadingCourse, isUserDataLoading, userData, courseData]);


    const [openSections, setOpenSections] = useState({});
    const toggleSection = (index) => setOpenSections(prev => ({ ...prev, [index]: !prev[index] }));

    // Enroll Course Function - implemented
    const enrollCourse = async () => {
        // Prevent action when course not loaded or user state loading
        if (!courseData?._id) { toast.error("Course data not loaded."); return; }
        if (isUserDataLoading) { toast.info("Verifying login status..."); return; }

        // If user is not logged in, prompt
        if (!userData) {
            toast.warn('Login to Enroll');
            return;
        }

        // If already enrolled, go straight to player
        if (isAlreadyEnrolled) {
            navigate(`/player/${courseData._id}`);
            return;
        }

        try {
            const token = await getToken();
            if (!token) {
                toast.error("Authentication token unavailable.");
                return;
            }

            const { data } = await axios.post(`${backendUrl}/api/user/enroll`,
                { courseId: courseData._id },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (data.success) {
                toast.success(data.message);
                // update local userData enrolledCourses (keep other fields)
                setUserData(prev => ({
                    ...prev,
                    enrolledCourses: [...(prev?.enrolledCourses || []), courseData._id]
                }));
                setIsAlreadyEnrolled(true);
                navigate(`/player/${courseData._id}`);
            } else {
                // backend may return 'Already Enrolled'
                if (data.message === 'Already Enrolled') {
                    setIsAlreadyEnrolled(true);
                    toast.info(data.message);
                    navigate(`/player/${courseData._id}`);
                } else {
                    toast.error(data.message || 'Enrollment failed.');
                }
            }

        } catch (error) {
            console.error('enrollCourse error:', error.response ?? error);
            toast.error(error.response?.data?.message || `Enrollment failed: ${error.message}`);
        }
    };

    // Preview Click Handler
    const handlePreviewClick = (lecture) => {
        if (!lecture?.lectureUrl) { toast.error("Preview video URL missing."); return; }
        const videoId = getYouTubeVideoId(lecture.lectureUrl);
        if (!videoId) { toast.error("Invalid video ID in URL."); return; }
        setPlayerData({ videoId });
    };


    // --- RENDER LOGIC ---

    // 1. Show Loading component while fetching course data
    if (isLoadingCourse) {
        return <Loading />;
    }

    // 2. Show error if fetching finished but courseData is still null
    if (!courseData) {
        return <div className="min-h-screen flex items-center justify-center text-red-500">Failed to load course details. Please try refreshing or go back home.</div>;
    }

    // 3. Render course details (now guaranteed courseData is not null)
    const ratingValue = calculateRating(courseData);
    const safeRating = Number.isFinite(ratingValue) ? ratingValue.toFixed(1) : '0.0';

    return (
        <>
            <div className="flex md:flex-row flex-col-reverse gap-10 relative items-start justify-between md:px-36 px-8 md:pt-20 pt-10 text-left min-h-screen">
                {/* Background Gradient */}
                <div className="absolute top-0 left-0 w-full h-section-height -z-1 bg-gradient-to-b from-cyan-100/70"></div>

                {/* Left Column: Course Info */}
                <div className="max-w-xl z-10 text-gray-500">
                    {/* Title */}
                    <h1 className="md:text-course-deatails-heading-large text-course-deatails-heading-small font-semibold text-gray-800">
                        {courseData.courseTitle || 'Untitled Course'}
                    </h1>
                    {/* Short Description */}
                    <p className="pt-4 md:text-base text-sm line-clamp-3" dangerouslySetInnerHTML={{ __html: courseData.courseDescription ? (courseData.courseDescription.length > 200 ? courseData.courseDescription.slice(0, 200) + '...' : courseData.courseDescription) : '' }} />

                    {/* Meta Info */}
                    <div className='flex items-center flex-wrap space-x-2 pt-3 pb-1 text-sm'>
                        <span className='font-medium text-yellow-600 mr-1'>{safeRating}</span>
                        <div className='flex mr-1'>
                            {[...Array(5)].map((_, i) => (<img key={i} src={i < Math.round(Number(safeRating)) ? assets.star : assets.star_blank} alt='' className='w-3.5 h-3.5' /> ))}
                        </div>
                        <span className='text-blue-600 mr-2'>({courseData.courseRatings?.length || 0} {courseData.courseRatings?.length === 1 ? 'rating' : 'ratings'})</span>
                        <span>{courseData.enrolledStudents?.length || 0} {courseData.enrolledStudents?.length === 1 ? 'student' : 'students'}</span>
                    </div>
                    {/* Instructor */}
                    <p className='text-sm mt-1'>Course by <span className='text-blue-600 underline'>{courseData.educator?.name || 'Instructor'}</span></p>

                    {/* Course Structure Accordion */}
                    <div className="pt-8 text-gray-800">
                        <h2 className="text-xl font-semibold">Course Structure</h2>
                        <div className="pt-5">
                            {(courseData.courseContent || []).map((chapter, index) => (
                                <div key={chapter.chapterId || index} className="border border-gray-300 bg-white mb-2 rounded">
                                    <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50" onClick={() => toggleSection(index)}>
                                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                                            <img src={assets.down_arrow_icon} alt="Toggle section" className={`w-4 h-4 transform transition-transform flex-shrink-0 ${openSections[index] ? "rotate-180" : ""}`} />
                                            <p className="font-medium md:text-base text-sm truncate">{index + 1}. {chapter.chapterTitle}</p>
                                        </div>
                                        <p className="text-xs md:text-sm text-gray-500 flex-shrink-0 whitespace-nowrap">{chapter.chapterContent?.length || 0} {(chapter.chapterContent?.length || 0) === 1 ? 'lec' : 'lecs'} - {calculateChapterTime(chapter)}</p>
                                    </div>
                                    <div className={`overflow-hidden transition-all duration-300 ${openSections[index] ? "max-h-screen border-t" : "max-h-0"}`} >
                                        <ul className="py-2 text-gray-600">
                                            {(chapter.chapterContent || []).map((lecture, i) => (
                                                <li key={lecture.lectureId || i} className="flex items-start gap-2 py-1.5 px-4 hover:bg-gray-100">
                                                    <img src={assets.play_icon} alt="Play icon" className="w-4 h-4 mt-1 flex-shrink-0" />
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full text-xs md:text-sm">
                                                        <span className='text-gray-800 mr-2'>{lecture.lectureTitle || 'Untitled Lecture'}</span>
                                                        <div className='flex gap-2 items-center flex-shrink-0 mt-1 sm:mt-0'>
                                                            {lecture.isPreviewFree && lecture.lectureUrl && (<button onClick={() => handlePreviewClick(lecture)} className='text-blue-600 hover:text-blue-800 text-xs font-medium'>Preview</button>)}
                                                            <span className='text-gray-500'>{lecture.lectureDuration ? humanizeDuration(lecture.lectureDuration * 60 * 1000, { units: ['m'], round: true }) : 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ))}
                            {(!courseData.courseContent || courseData.courseContent.length === 0) && (<p className="text-gray-500 pt-2">Course content coming soon.</p>)}
                        </div>
                    </div>

                    {/* Full Course Description */}
                    <div className="py-10 md:py-16 text-sm md:text-default">
                        <h3 className="text-xl font-semibold text-gray-800">Course Description</h3>
                        <div className="rich-text pt-3" dangerouslySetInnerHTML={{ __html: courseData.courseDescription || '<p>No description available.</p>' }} />
                    </div>
                </div>

                {/* Right Column: Video/Image Card */}
                <div className="max-w-course-card w-full md:w-auto z-10 shadow-lg rounded-lg overflow-hidden bg-white min-w-[300px] sm:min-w-[420px] self-start md:sticky md:top-10">
                    {/* Video Player or Thumbnail */}
                    <div className="aspect-video bg-gray-200">
                        {playerData
                            ? <YouTube videoId={playerData.videoId} opts={{ playerVars: { autoplay: 1 } }} iframeClassName='w-full h-full' onError={(e) => { console.error("YouTube Player Error:", e); toast.error("Error loading preview video."); setPlayerData(null); }} />
                            : <img className='w-full h-full object-cover' src={courseData.courseThumbnail || 'placeholder.png'} alt={`${courseData.courseTitle || 'Course'} thumbnail`} /> }
                    </div>
                    {/* Card Content */}
                    <div className="p-5">
                         {/* Course Stats */}
                        <div className="flex items-center justify-between text-sm md:text-default gap-4 pt-2 pb-4 text-gray-500 border-b mb-4">
                            <div className="flex items-center gap-1" title={`${safeRating} rating`}>
                                <img src={assets.star} alt="star icon" className='w-4 h-4' /><span>{safeRating}</span>
                            </div>
                            <div className="h-4 w-px bg-gray-400"></div>
                            <div className="flex items-center gap-1" title="Course duration">
                                <img src={assets.time_clock_icon} alt="clock icon" className='w-4 h-4' /><span>{calculateCourseDuration(courseData)}</span>
                            </div>
                            <div className="h-4 w-px bg-gray-400"></div>
                            <div className="flex items-center gap-1" title="Number of lessons">
                                <img src={assets.lesson_icon} alt="lesson icon" className='w-4 h-4' /><span>{calculateNoOfLectures(courseData)} {calculateNoOfLectures(courseData) === 1 ? 'lesson' : 'lessons'}</span>
                            </div>
                        </div>
                        {/* Enroll Button */}
                        <button
                            onClick={enrollCourse}
                            className={`w-full py-3 rounded text-white font-medium transition duration-200 text-center ${ isUserDataLoading || !courseData?._id ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700' }`}
                            disabled={isUserDataLoading || !courseData?._id} >
                            {isUserDataLoading ? 'Loading User...' : (isAlreadyEnrolled ? "Go to Course" : "Enroll Now")}
                        </button>
                        {/* Course Includes */}
                        <div className="pt-6">
                            <p className="md:text-lg text-base font-medium text-gray-800 mb-2">What's included?</p>
                            <ul className="space-y-1.5 text-sm text-gray-600">
                                <li className="flex items-center gap-2"><CheckIcon /> Lifetime access with free updates.</li>
                                <li className="flex items-center gap-2"><CheckIcon /> Step-by-step project guidance.</li>
                                <li className="flex items-center gap-2"><CheckIcon /> Downloadable resources & code.</li>
                                <li className="flex items-center gap-2"><CheckIcon /> Certificate of completion.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
};

// Simple Check Icon component
const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

export default CourseDetails;
