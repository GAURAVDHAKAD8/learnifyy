import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { assets } from '../../assets/assets';
import { useParams } from 'react-router-dom';
import humanizeDuration from 'humanize-duration';
import axios from 'axios';
import { toast } from 'react-toastify';
import Rating from '../../components/student/Rating';
import Footer from '../../components/student/Footer';
import Loading from '../../components/student/Loading';

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
  } catch (err) {
    console.error('getYouTubeVideoId error:', err, url);
    return null;
  }
};

const Player = () => {
  const {
    enrolledCourses,
    backendUrl,
    getToken,
    calculateChapterTime,
    userData,
    fetchUserEnrolledCourses
  } = useContext(AppContext);

  const { courseId } = useParams();
  const [courseData, setCourseData] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [openSections, setOpenSections] = useState({});
  const [selectedLecture, setSelectedLecture] = useState(null); // { chapterIndex, lectureIndex, lectureObj }
  const [videoId, setVideoId] = useState(null);
  const [initialRating, setInitialRating] = useState(0);
  const [loading, setLoading] = useState(true);

  // Get course from enrolledCourses (safer than mapping)
  const getCourseData = () => {
    if (!Array.isArray(enrolledCourses)) return;
    const found = enrolledCourses.find(c => (c._id && (c._id.toString() === courseId.toString())) || (c.id && (c.id.toString() === courseId.toString())));
    if (found) {
      setCourseData(found);
      // initialize rating if present
      const myRating = (found.courseRatings || []).find(r => r.userId === userData?._id);
      setInitialRating(myRating ? myRating.rating : 0);
    } else {
      setCourseData(null);
    }
  };

  useEffect(() => {
    getCourseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrolledCourses, courseId, userData]);

  // Toggle accordion sections
  const toggleSection = (index) => {
    setOpenSections(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const markLectureAsCompleted = async (lectureId) => {
    try {
      const token = await getToken();
      if (!token) throw new Error('Auth token not available');
      const { data } = await axios.post(`${backendUrl}/api/user/update-course-progress`,
        { courseId, lectureId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        toast.success(data.message);
        getCourseProgress();
      } else {
        toast.error(data.message || 'Failed to update progress');
      }
    } catch (error) {
      console.error('markLectureAsCompleted error:', error);
      toast.error(error.response?.data?.message || error.message || 'Network error');
    }
  };

  const getCourseProgress = async () => {
    try {
      const token = await getToken();
      if (!token) {
        // Not fatal; user might be unauthenticated temporarily
        setProgressData(null);
        return;
      }
      const { data } = await axios.post(`${backendUrl}/api/user/get-course-progress`,
        { courseId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setProgressData(data.progressData);
      } else {
        setProgressData(null);
        toast.error(data.message || 'Could not fetch progress');
      }
    } catch (error) {
      console.error('getCourseProgress error:', error);
      setProgressData(null);
      toast.error(error.response?.data?.message || error.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (rating) => {
    try {
      const token = await getToken();
      if (!token) throw new Error('Auth token not available');
      const { data } = await axios.post(`${backendUrl}/api/user/add-rating`,
        { courseId, rating },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        toast.success(data.message);
        fetchUserEnrolledCourses && fetchUserEnrolledCourses();
        // refresh local courseData if possible
        getCourseData();
      } else {
        toast.error(data.message || 'Failed to rate');
      }
    } catch (error) {
      console.error('handleRate error:', error);
      toast.error(error.response?.data?.message || error.message || 'Network error');
    }
  };

  useEffect(() => {
    // fetch progress when component mounts and when courseId changes
    setLoading(true);
    getCourseProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const handleWatchClick = (chapterIndex, lectureIndex) => {
    const lecture = courseData?.courseContent?.[chapterIndex]?.chapterContent?.[lectureIndex];
    if (!lecture) {
      toast.error('Lecture not found');
      return;
    }
    // Extract a robust video id
    const id = getYouTubeVideoId(lecture.lectureUrl || '');
    setSelectedLecture({ chapterIndex, lectureIndex, lectureObj: lecture });
    if (id && id.length === 11) {
      setVideoId(id);
    } else {
      setVideoId(null);
      toast.warn('Lecture preview not available or invalid video link.');
    }
  };

  if (loading && !courseData) return <Loading />;

  // if courseData not found (not enrolled) show friendly message
  if (!courseData) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center p-10">
          <div className="max-w-xl text-center">
            <h2 className="text-xl font-semibold mb-2">Course not found in your enrollments</h2>
            <p className="text-gray-600 mb-4">Make sure you are enrolled in this course. Go to the course page to enroll.</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <div className="p-4 sm:p-10 flex flex-col-reverse md:grid md:grid-cols-2 gap-10 md:px-36">
        <div className="text-gray-800">
          <h2 className="text-xl font-semibold">Course Structure</h2>
          <div className="pt-5">
            {courseData && (courseData.courseContent || []).map((chapter, index) => (
              <div key={chapter.chapterId || index} className="border border-gray-300 bg-white mb-2 rounded">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
                  onClick={() => toggleSection(index)}
                >
                  <div className="flex items-center gap-2">
                    <img src={assets.down_arrow_icon} alt="arrow icon" className={`transform transition-transform ${openSections[index] ? "rotate-180" : ""}`} />
                    <p className="font-medium md:text-base text-sm">{chapter.chapterTitle}</p>
                  </div>
                  <p className="text-sm md:text-default">{(chapter.chapterContent || []).length} lectures - {calculateChapterTime(chapter)}</p>
                </div>

                <div className={`overflow-hidden transition-all duration-300 ${openSections[index] ? "max-h-96" : "max-h-0"}`} >
                  <ul className="list-disc md:pl-10 pl-4 pr-4 py-2 text-gray-600 border-t border-gray-300">
                    {(chapter.chapterContent || []).map((lecture, i) => (
                      <li key={lecture.lectureId || i} className="flex items-start gap-2 py-1">
                        <img src={(progressData && Array.isArray(progressData.lectureCompleted) && progressData.lectureCompleted.includes(lecture.lectureId)) ? assets.blue_tick_icon : assets.play_icon} alt="bullet icon" className="w-4 h-4 mt-1" />
                        <div className="flex items-center justify-between w-full text-gray-800 text-xs md:text-default">
                          <p>{lecture.lectureTitle}</p>
                          <div className='flex gap-2'>
                            {lecture.lectureUrl && <p onClick={() => handleWatchClick(index, i)} className='text-blue-500 cursor-pointer'>Watch</p>}
                            <p>{lecture.lectureDuration ? humanizeDuration(lecture.lectureDuration * 60 * 1000, { units: ['h', 'm'] }) : 'N/A'}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 py-3 mt-10">
            <h1 className="text-xl font-bold">Rate this Course:</h1>
            <Rating initialRating={initialRating} onRate={handleRate} />
          </div>
        </div>

        <div className='md:mt-10'>
          { selectedLecture ? (
            <div>
              { videoId ? (
                <>
                  <div className="w-full aspect-video mb-2 overflow-hidden rounded">
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
                      title={selectedLecture.lectureObj?.lectureTitle || 'Lecture Player'}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className='flex justify-between items-center mt-1'>
                    <p className='text-xl '>{(selectedLecture.chapterIndex + 1) || ''}.{(selectedLecture.lectureIndex + 1) || ''} {selectedLecture.lectureObj?.lectureTitle}</p>
                    <button onClick={() => markLectureAsCompleted(selectedLecture.lectureObj?.lectureId)} className='text-blue-600'>
                      {(progressData && Array.isArray(progressData.lectureCompleted) && progressData.lectureCompleted.includes(selectedLecture.lectureObj?.lectureId)) ? 'Completed' : 'Mark Complete'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full aspect-video flex flex-col items-center justify-center bg-gray-100 rounded p-4">
                  <p className="mb-2 text-gray-700">Preview unavailable for this lecture.</p>
                  { selectedLecture.lectureObj?.lectureUrl ? (
                    <a className="text-blue-600 underline" href={selectedLecture.lectureObj.lectureUrl} target="_blank" rel="noreferrer">Open original link</a>
                  ) : (
                    <p className="text-sm text-gray-500">No preview link available.</p>
                  )}
                  <div className='flex justify-between items-center mt-4 w-full'>
                    <p className='text-xl'>{(selectedLecture.chapterIndex + 1) || ''}.{(selectedLecture.lectureIndex + 1) || ''} {selectedLecture.lectureObj?.lectureTitle}</p>
                    <button onClick={() => markLectureAsCompleted(selectedLecture.lectureObj?.lectureId)} className='text-blue-600'>
                      {(progressData && Array.isArray(progressData.lectureCompleted) && progressData.lectureCompleted.includes(selectedLecture.lectureObj?.lectureId)) ? 'Completed' : 'Mark Complete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <img src={courseData ? courseData.courseThumbnail || '' : ''} alt="" className="w-full object-cover" />
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Player;
