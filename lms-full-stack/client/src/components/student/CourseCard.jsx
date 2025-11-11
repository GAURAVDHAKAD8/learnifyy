import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { assets } from '../../assets/assets';
import { AppContext } from '../../context/AppContext';

const CourseCard = ({ course }) => {
    // Removed currency as it might not be needed if prices are removed
    const { calculateRating } = useContext(AppContext);

    // Added safety check for course object itself
    if (!course) {
        return null; // Don't render anything if course data is missing
    }

    // Safely calculate price or set to 'Free' / empty if removing price logic
    // const displayPrice = course.coursePrice !== undefined && course.discount !== undefined
    //     ? currency + (course.coursePrice - course.discount * course.coursePrice / 100).toFixed(2)
    //     : 'N/A'; // Or set to 'Free' or ''

    const rating = calculateRating(course);

    return (
        <Link onClick={() => window.scrollTo(0, 0)} to={'/course/' + course._id} className="border border-gray-200 hover:shadow-lg transition-shadow duration-200 pb-4 overflow-hidden rounded-lg flex flex-col h-full bg-white"> {/* Added styling */}
            <img className="w-full aspect-video object-cover" src={course.courseThumbnail || 'placeholder.png'} alt={`${course.courseTitle || 'Course'} thumbnail`} /> {/* Added placeholder/alt */}
            <div className="p-3 text-left flex flex-col flex-grow"> {/* Added flex-grow */}
                {/* Use optional chaining for courseTitle */}
                <h3 className="text-base font-semibold mb-1 text-gray-800 flex-grow">{course.courseTitle || 'Untitled Course'}</h3> {/* Added flex-grow */}
                {/* Use optional chaining (?.) for educator and educator.name */}
                <p className="text-sm text-gray-500 mb-2">{course.educator?.name || 'Unknown Instructor'}</p>
                <div className="flex items-center space-x-1 mb-2"> {/* Reduced space */}
                    <p className='text-sm font-medium text-yellow-600'>{rating > 0 ? rating.toFixed(1) : 'New'}</p> {/* Show 'New' if no ratings, format rating */}
                    <div className="flex">
                        {[...Array(5)].map((_, i) => (
                            <img
                                key={i}
                                className="w-3.5 h-3.5"
                                // Ensure calculateRating handles missing ratings array
                                src={i < Math.round(rating) ? assets.star : assets.star_blank} // Use rounded rating
                                alt=""
                            />
                        ))}
                    </div>
                     {/* Added check for courseRatings array */}
                    <p className="text-xs text-gray-400">({course.courseRatings?.length || 0})</p>
                </div>
                 {/* Removed price display logic */}
                 {/* <p className="text-base font-semibold text-gray-800 mt-auto">{displayPrice}</p> */}
                 {/* You could add a 'Free' tag here if courses are free */}
                 <p className="text-sm font-semibold text-green-600 mt-auto">Free</p>
            </div>
        </Link>
    );
};

export default CourseCard;