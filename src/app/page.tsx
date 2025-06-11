"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type TimerState = "idle" | "running" | "paused";
type SessionType = "work" | "shortBreak" | "longBreak";

const SESSION_DURATIONS = {
  work: 25 * 60, // 25 minutes
  shortBreak: 5 * 60, // 5 minutes
  longBreak: 15 * 60, // 15 minutes
};

const SESSION_LABELS = {
  work: "Work",
  shortBreak: "Short Break", 
  longBreak: "Long Break",
};

const WORK_SESSIONS_BEFORE_LONG_BREAK = 4;

export default function PomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATIONS.work);
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [sessionType, setSessionType] = useState<SessionType>("work");
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [workSessionsInCycle, setWorkSessionsInCycle] = useState(0);
  const [autoTransition, setAutoTransition] = useState(true);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create audio notification
  useEffect(() => {
    const createNotificationSound = () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const playBeep = () => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
          gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.8);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.8);
        };

        return playBeep;
      } catch (error) {
        console.warn('Audio context not available:', error);
        return () => {}; // Fallback for environments without audio support
      }
    };

    const playSound = createNotificationSound();
    audioRef.current = { play: playSound } as any;
  }, []);

  const resetTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimerState("idle");
    setTimeLeft(SESSION_DURATIONS[sessionType]);
  }, [sessionType]);

  const switchToSession = useCallback((newSessionType: SessionType) => {
    setSessionType(newSessionType);
    setTimeLeft(SESSION_DURATIONS[newSessionType]);
    setTimerState("idle");
  }, []);

  const handleSessionComplete = useCallback(() => {
    // Play notification sound
    if (audioRef.current) {
      audioRef.current.play();
    }

    if (sessionType === "work") {
      setCompletedPomodoros(prev => prev + 1);
      const newWorkSessions = workSessionsInCycle + 1;
      setWorkSessionsInCycle(newWorkSessions);

      if (autoTransition) {
        setTimeout(() => {
          if (newWorkSessions >= WORK_SESSIONS_BEFORE_LONG_BREAK) {
            switchToSession("longBreak");
            setWorkSessionsInCycle(0);
          } else {
            switchToSession("shortBreak");
          }
        }, 1000);
      }
    } else {
      // Break session completed
      if (autoTransition) {
        setTimeout(() => {
          switchToSession("work");
        }, 1000);
      }
    }
  }, [sessionType, workSessionsInCycle, autoTransition, switchToSession]);

  const startTimer = useCallback(() => {
    setTimerState("running");
    intervalRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          // Timer completed
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setTimerState("idle");
          handleSessionComplete();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  }, [handleSessionComplete]);

  const pauseTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTimerState("paused");
  }, []);

  const resumeTimer = useCallback(() => {
    startTimer();
  }, [startTimer]);

  const handleStartPause = () => {
    if (timerState === "running") {
      pauseTimer();
    } else {
      timerState === "paused" ? resumeTimer() : startTimer();
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Format duration for display
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  // Calculate progress percentage
  const totalTime = SESSION_DURATIONS[sessionType];
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  
  // Calculate stroke dash array for circular progress
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Get session type color classes
  const getSessionColors = (type: SessionType) => {
    switch (type) {
      case "work":
        return "from-purple-500 to-purple-600 text-purple-400";
      case "shortBreak":
        return "from-green-500 to-green-600 text-green-400";
      case "longBreak":
        return "from-blue-500 to-blue-600 text-blue-400";
    }
  };

  const currentColors = getSessionColors(sessionType);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-800">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Pomodoro Timer
          </h1>
          <p className="text-gray-400 text-sm">
            Stay focused and productive
          </p>
        </div>

        {/* Session Mode Selector */}
        <div className="flex justify-center gap-2 mb-8">
          {(Object.keys(SESSION_DURATIONS) as SessionType[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                if (timerState === "idle") {
                  switchToSession(type);
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                sessionType === type
                  ? `bg-gradient-to-r ${getSessionColors(type).split(' ').slice(0, 2).join(' ')} text-white shadow-lg`
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
              disabled={timerState !== "idle"}
            >
              {SESSION_LABELS[type]}
            </button>
          ))}
        </div>

        {/* Circular Progress Timer */}
        <div className="relative flex items-center justify-center mb-8">
          <svg
            className="transform -rotate-90 w-64 h-64"
            viewBox="0 0 256 256"
          >
            {/* Background circle */}
            <circle
              cx="128"
              cy="128"
              r={radius}
              stroke="currentColor"
              strokeWidth="4"
              fill="transparent"
              className="text-gray-800"
            />
            {/* Progress circle */}
            <circle
              cx="128"
              cy="128"
              r={radius}
              stroke="currentColor"
              strokeWidth="4"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={`transition-all duration-1000 ease-linear ${currentColors.split(' ')[2]}`}
            />
          </svg>
          
          {/* Timer display */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl font-mono font-bold text-white mb-2">
                {formatTime(timeLeft)}
              </div>
              <div className={`text-sm font-medium uppercase tracking-wider ${currentColors.split(' ')[2]}`}>
                {sessionType === "work" ? "Focus Time" : 
                 sessionType === "shortBreak" ? "Short Break" : "Long Break"}
              </div>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={handleStartPause}
            className={`px-8 py-3 rounded-lg font-semibold text-white transition-all transform hover:scale-105 active:scale-95 shadow-lg bg-gradient-to-r ${
              currentColors.split(' ').slice(0, 2).join(' ')
            }`}
          >
            {timerState === "running" ? "⏸ Pause" : 
             timerState === "paused" ? "▶ Resume" : "▶ Start"}
          </button>
          
          <button
            onClick={resetTimer}
            className="px-8 py-3 rounded-lg font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 transition-all transform hover:scale-105 active:scale-95"
          >
            🔄 Reset
          </button>
        </div>

        {/* Session Stats */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-semibold">Session Stats</h3>
            <span className="text-purple-400 font-bold">{completedPomodoros}</span>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-gray-400 text-xs uppercase tracking-wide">Work</div>
              <div className="text-white font-bold">{formatDuration(SESSION_DURATIONS.work)}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs uppercase tracking-wide">Short</div>
              <div className="text-white font-bold">{formatDuration(SESSION_DURATIONS.shortBreak)}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs uppercase tracking-wide">Long</div>
              <div className="text-white font-bold">{formatDuration(SESSION_DURATIONS.longBreak)}</div>
            </div>
          </div>
        </div>

        {/* Cycle Information */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
            <span className="text-gray-400 text-sm">Completed Pomodoros: {completedPomodoros}</span>
          </div>
          <p className="text-gray-500 text-xs">
            25 min work • 5 min short break • 15 min long break
          </p>
        </div>

        {/* Auto-transition toggle */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <input
            type="checkbox"
            id="autoTransition"
            checked={autoTransition}
            onChange={(e) => setAutoTransition(e.target.checked)}
            className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
          />
          <label htmlFor="autoTransition" className="text-gray-400 text-sm">
            Auto-advance sessions
          </label>
        </div>
      </div>
    </div>
  );
}
