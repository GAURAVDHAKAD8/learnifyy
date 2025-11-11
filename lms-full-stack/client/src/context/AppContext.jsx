import axios from "axios";
import { createContext, useEffect, useState, useCallback, useRef } from "react"; // Added useRef
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth, useUser } from "@clerk/clerk-react";
import humanizeDuration from "humanize-duration";

export const AppContext = createContext();

export const AppContextProvider = (props) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    const navigate = useNavigate();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { user, isLoaded: isUserLoaded } = useUser();

    const [showLogin, setShowLogin] = useState(false);
    const [isEducator, setIsEducator] = useState(false);
    const [allCourses, setAllCourses] = useState([]);
    const [userData, setUserData] = useState(null);
    const [isUserDataLoading, setIsUserDataLoading] = useState(true);
    const [enrolledCourses, setEnrolledCourses] = useState([]);

    // --- Added Ref for retry logic ---
    const fetchUserAttempt = useRef(0); // Keep track of fetch attempts

    // Fetch All Courses
    const fetchAllCourses = useCallback(async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/course/all');
            if (data.success) {
                setAllCourses(data.courses);
            } else {
                toast.error(`Fetch Courses Error: ${data.message}`);
            }
        } catch (error) {
             toast.error(`Fetch Courses Network Error: ${error.message}`);
        }
    }, [backendUrl]);

    // Fetch UserData (with retry logic for "User Not Found")
    const fetchUserData = useCallback(async (isRetry = false) => { // Added isRetry flag
        if (!isAuthLoaded || !isUserLoaded || !user || !getToken) {
             // Reset state and stop loading if Clerk isn't ready or no Clerk user
            setIsUserDataLoading(false);
            setUserData(null);
            setIsEducator(false);
            setEnrolledCourses([]);
            fetchUserAttempt.current = 0; // Reset attempt counter
            return;
        }

        // Only set loading to true on the initial attempt
        if (!isRetry) {
             setIsUserDataLoading(true);
             fetchUserAttempt.current = 1; // Mark first attempt
        }


        try {
            const token = await getToken();
            if (!token) {
                 console.error("Fetch User Data: Failed to get auth token.");
                 throw new Error("Authentication token not available.");
            }

            const { data } = await axios.get(backendUrl + '/api/user/data', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                setUserData(data.user);
                setIsEducator(user.publicMetadata?.role === 'educator' || data.user?.role === 'educator');
                fetchUserAttempt.current = 0; // Reset on success
                setIsUserDataLoading(false); // Stop loading on success
            } else {
                 if (data.message === 'User Not Found' && fetchUserAttempt.current < 3) { // Retry up to 2 times (total 3 attempts)
                      console.warn(`User Not Found in DB (Attempt ${fetchUserAttempt.current}). Retrying in 2 seconds...`);
                      fetchUserAttempt.current += 1;
                      setTimeout(() => fetchUserData(true), 2000); // Call fetchUserData again after 2s, marking it as a retry
                      // Keep loading state true while retrying
                 } else {
                     // If it's another error OR max retries reached for "User Not Found"
                     if (data.message !== 'User Not Found') {
                         toast.error(`Fetch User Data Error: ${data.message}`);
                     } else {
                          console.error("User Not Found in DB after multiple attempts. Check webhook.");
                          toast.error("Could not load user profile. Please try refreshing."); // User-facing error after retries
                     }
                      setUserData(null);
                      setIsEducator(user.publicMetadata?.role === 'educator');
                      setIsUserDataLoading(false); // Stop loading on final failure
                      fetchUserAttempt.current = 0; // Reset attempts
                 }
            }
        } catch (error) {
             toast.error(`Fetch User Data Network Error: ${error.message}`);
             setUserData(null);
             setIsEducator(user.publicMetadata?.role === 'educator');
             setIsUserDataLoading(false); // Stop loading on catch
             fetchUserAttempt.current = 0; // Reset attempts
        }
        // Removed finally block, loading state handled within try/catch/retry logic
    }, [user, getToken, backendUrl, isAuthLoaded, isUserLoaded]); // Dependencies remain the same


    // Fetch User Enrolled Courses - only if userData exists
    const fetchUserEnrolledCourses = useCallback(async () => {
        if (!userData?._id || !getToken) {
            setEnrolledCourses([]);
            return;
        }
        try {
            const token = await getToken();
             if (!token) {
                 console.error("Fetch Enrolled Courses: Failed to get auth token.");
                 setEnrolledCourses([]);
                 return;
             }
            const { data } = await axios.get(backendUrl + '/api/user/enrolled-courses', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data.success) {
                setEnrolledCourses(Array.isArray(data.enrolledCourses) ? data.enrolledCourses.reverse() : []);
            } else {
                toast.error(`Fetch Enrolled Courses Error: ${data.message}`);
                setEnrolledCourses([]);
            }
        } catch (error) {
             toast.error(`Fetch Enrolled Courses Network Error: ${error.message}`);
             setEnrolledCourses([]);
        }
    }, [userData, getToken, backendUrl]);


    // --- Calculation Functions (Unchanged) ---
    const calculateChapterTime = (chapter) => { /* ... */ };
    const calculateCourseDuration = (course) => { /* ... */ };
    const calculateRating = (course) => { /* ... */ };
    const calculateNoOfLectures = (course) => { /* ... */ };
    // --- End Calculation Functions ---


    // Fetch all courses on initial mount
    useEffect(() => {
        fetchAllCourses();
    }, [fetchAllCourses]);

    // Fetch User's Data when Clerk user/auth state changes
    useEffect(() => {
        if (isAuthLoaded && isUserLoaded) {
            // Reset attempt counter when Clerk user changes (login/logout)
             fetchUserAttempt.current = 0;
             fetchUserData(); // Start fetch (will handle loading state internally)
        } else {
            // If Clerk is loading, ensure our loading state reflects that
            setIsUserDataLoading(true);
            setUserData(null); // Clear user data while Clerk loads
            setEnrolledCourses([]);
            setIsEducator(false);
        }
    }, [isAuthLoaded, isUserLoaded, user, fetchUserData]);


    // Fetch enrolled courses *after* userData is successfully fetched (loading is false AND userData exists)
     useEffect(() => {
        if (!isUserDataLoading && userData?._id) {
             fetchUserEnrolledCourses();
        } else if (!isUserDataLoading && !userData?._id) {
             setEnrolledCourses([]);
        }
        // Do NOT run if isUserDataLoading is true
    }, [isUserDataLoading, userData, fetchUserEnrolledCourses]);


    const value = {
        showLogin, setShowLogin,
        backendUrl, navigate,
        userData, setUserData, getToken,
        isUserDataLoading, // Expose loading state
        allCourses, fetchAllCourses,
        enrolledCourses, fetchUserEnrolledCourses,
        calculateChapterTime, calculateCourseDuration,
        calculateRating, calculateNoOfLectures,
        isEducator, setIsEducator
    };

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    );
};