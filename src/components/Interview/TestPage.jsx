import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { startRecording, stopRecording } from './recorder';
import { fetchQuestionsBySkills } from './fetchQuestions';
import {
  AiOutlineLoading3Quarters,
  AiOutlineStop,
  AiOutlinePlayCircle,
} from 'react-icons/ai';
import { saveTestReportToFirebase } from '../../../firebaseUtils';
import UserDetailsModal from './UserDetailsModal';
import skillsContext from '../../Context/skills';
import { Bounce, toast, ToastContainer } from 'react-toastify';

const TestPage = () => {
  const [userName, setUserName] = useState(sessionStorage.getItem("mName"));
  const [userEmail, setUserEmail] = useState(sessionStorage.getItem("email"));
  const [userUID, setUserUID] = useState(sessionStorage.getItem("uid"));
  const [userDetails, setUserDetails] = useState(null);
  const [resumeData, setResumeData] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timePerQuestion, setTimePerQuestion] = useState({});
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [timer, setTimer] = useState(600); // 10 minutes in seconds
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [showModal, setShowModal] = useState(true);
  const [testStarted, setTestStarted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [textAnswers, setTextAnswers] = useState({});
  const navigate = useNavigate();
  const { skills } = useContext(skillsContext);

  const errorToast = (error) => {
    toast.error(error, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "dark",
      transition: Bounce,
    });
  };

  // Fetch questions based on resume skills
  useEffect(() => {
    const fetchQuestions = async () => {
      if (resumeData && resumeData.skills) {
        try {
          const combinedSkills = Array.from(new Set([...resumeData.skills, 'Corporate']));
          const fetchedQuestions = await fetchQuestionsBySkills(combinedSkills);
          const initializedQuestions = fetchedQuestions.map((question) => ({
            ...question,
            userAnswer: '', // For multiple-choice
            userTextAnswer: '', // For text-based answers
          }));
          setQuestions(initializedQuestions);
        } catch (error) {
          errorToast("Sorry! Questions are not available right now");
        }
      }
    };
    fetchQuestions();
  }, [resumeData]);

  // Timer logic
  useEffect(() => {
    let interval = null;
    if (isTimerActive) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleSubmitTest(); // Auto-end test when timer reaches 0
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive]);

  // Start recording when test starts
  useEffect(() => {
    if (testStarted) {
      startRecording();
      setIsRecording(true);
    }
    return () => {
      if (isRecording) {
        stopRecording(userName, userEmail, userUID);
        setIsRecording(false);
      }
    };
  }, [testStarted]);

  const handleSelectAnswer = (choice) => {
    const currentTime = Date.now();
    const questionTime = currentTime - questionStartTime;
    setTimePerQuestion((prev) => ({
      ...prev,
      [currentQuestionIndex]: questionTime,
    }));
    setQuestions((prevQuestions) =>
      prevQuestions.map((question, index) =>
        index === currentQuestionIndex
          ? { ...question, userAnswer: choice }
          : question
      )
    );
    setQuestionStartTime(currentTime);
  };

  const handleTextAnswerChange = (e) => {
    const answer = e.target.value;
    setTextAnswers({
      ...textAnswers,
      [currentQuestionIndex]: answer,
    });
    setQuestions((prevQuestions) =>
      prevQuestions.map((question, index) =>
        index === currentQuestionIndex
          ? { ...question, userTextAnswer: answer }
          : question
      )
    );
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setQuestionStartTime(Date.now());
    }
  };

  const handleSubmitTest = async () => {
    setIsSubmitting(true);
    try {
      await stopRecording(userName, userEmail, userUID);
      await saveTestReportToFirebase({ questions, timePerQuestion, textAnswers }, userName || "Unknown", userEmail, userUID);
      navigate(`/${userUID}/expectation`);
    } catch (error) {
      errorToast("Error submitting test");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const handleStartTest = () => {
    setTestStarted(true);
    setIsTimerActive(true);
    setQuestionStartTime(Date.now());
  };

  const progressPercentage = questions.length
    ? ((currentQuestionIndex + 1) / questions.length) * 100
    : 0;

  return (
    <div className="p-6 bg-[url('.\assets\image3.png')] bg-cover min-h-screen flex flex-col items-center justify-center font-poppins text-gray-100 transition duration-300">
      {showModal && (
        <UserDetailsModal
          setUserDetails={setUserDetails}
          setResumeData={setResumeData}
          onClose={() => setShowModal(false)}
        />
      )}
      {permissionDenied ? (
        <div className="bg-red-700 text-white rounded-lg p-8 max-w-md w-full text-center shadow-lg">
          <h2 className="text-3xl font-semibold mb-6">Permission Denied</h2>
          <p className="mb-6">Please ensure all required permissions are granted to continue the test.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition text-lg font-medium"
          >
            Return Home
          </button>
        </div>
      ) : testStarted ? (
        <div className="bg-gradient-to-br from-gray-50 to-white text-gray-800 rounded-lg shadow-xl p-10 max-w-3xl w-full relative shadow-gray-500">
          <div className="w-full bg-gray-700 rounded-full h-3 mb-8">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold">Time Remaining: {formatTime(timer)}</h2>
            <div className="flex items-center space-x-4">
              {isRecording ? (
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition text-lg font-medium"
                >
                  <AiOutlineStop className="w-6 h-6 mr-3" />
                  Stop Recording
                </button>
              ) : (
                <button
                  onClick={() => {
                    startRecording();
                    setIsRecording(true);
                  }}
                  className="flex items-center bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition text-lg font-medium"
                >
                  <AiOutlinePlayCircle className="w-6 h-6 mr-3" />
                  Start Recording
                </button>
              )}
            </div>
          </div>
          {questions.length > 0 ? (
            <div className="space-y-8">
              <div className="fade-in">
                <h3 className="font-semibold text-2xl mb-6">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </h3>
                <p className="text-xl mb-6 font-medium">{questions[currentQuestionIndex]?.question}</p>
                {questions[currentQuestionIndex]?.type !== 'mcq' ? (
                  <div>
                    <label htmlFor="textAnswer" className="text-lg">
                      Your Answer
                    </label>
                    <textarea
                      id="textAnswer"
                      value={textAnswers[currentQuestionIndex] || ''}
                      onChange={handleTextAnswerChange}
                      rows={5}
                      className="w-full p-4 bg-gray-100 rounded-lg text-gray-800 mt-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ) : (
                  <div>
                    <p className="mb-6">Select an answer below:</p>
                    <div className="space-y-4">
                      {questions[currentQuestionIndex].choices.map((choice, index) => (
                        <div
                          key={index}
                          onClick={() => handleSelectAnswer(choice)}
                          className={`cursor-pointer p-4 rounded-lg border transition ${
                            questions[currentQuestionIndex].userAnswer === choice
                              ? 'border-blue-500 bg-blue-100'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {choice}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-between mt-8">
                {currentQuestionIndex < questions.length - 1 ? (
                  <button
                    onClick={handleNextQuestion}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition text-lg font-medium"
                  >
                    Next Question
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitTest}
                    className={`bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition text-lg font-medium ${
                      isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={isSubmitting}
                  >
                    Submit Test
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-xl">Loading questions...</p>
          )}
        </div>
      ) : (
        <div className="bg-gradient-to-br from-gray-50 to-white text-gray-800 rounded-lg shadow-xl p-10 max-w-3xl w-full text-center shadow-gray-500">
          <h1 className="text-4xl font-semibold mb-6">Welcome to the Skill Assessment Test</h1>
          <button
            onClick={handleStartTest}
            className="mt-6 bg-green-600 text-white px-8 py-4 rounded-lg hover:bg-green-700 transition text-xl font-medium"
          >
            Start Test
          </button>
        </div>
      )}
      <ToastContainer />
    </div>
  );
};

export default TestPage;
