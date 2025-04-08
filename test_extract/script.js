/**
 * Retro Motion Detector
 * A webcam-based motion detection application with retro UI
 */

// DOM Elements
const video = document.getElementById('video');
const motionCanvas = document.getElementById('motion-canvas');
const statusText = document.getElementById('status-text');
const levelBar = document.getElementById('level-bar');
const sensitivitySlider = document.getElementById('sensitivity');
const sensitivityValue = document.getElementById('sensitivity-value');
const minPixelsSlider = document.getElementById('min-pixels');
const minPixelsValue = document.getElementById('min-pixels-value');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const soundToggle = document.getElementById('sound-toggle');
const bingSound = document.getElementById('bing-sound');
const resolutionDisplay = document.getElementById('resolution');
const fpsDisplay = document.getElementById('fps');
const noCameraMessage = document.getElementById('no-camera-message');

// Motion detection variables
let isRunning = false;
let motionDetected = false;
let lastMotionTime = 0;
let motionTimeout;
const motionResetDelay = 2000; // Time in ms to reset motion status
let ctx;
let width = 320;
let height = 240;
let lastFrameData;
let motionInterval;
let frameCount = 0;
let lastFpsUpdateTime = 0;

// Settings
let sensitivity = parseInt(sensitivitySlider.value);
let minPixels = parseInt(minPixelsSlider.value);
let soundEnabled = soundToggle.checked;

// Initialize the application
function init() {
    // Set up event listeners
    startBtn.addEventListener('click', startDetection);
    stopBtn.addEventListener('click', stopDetection);
    sensitivitySlider.addEventListener('input', updateSensitivity);
    minPixelsSlider.addEventListener('input', updateMinPixels);
    soundToggle.addEventListener('change', toggleSound);
    
    // Initialize canvas
    ctx = motionCanvas.getContext('2d');
    
    // Update UI with initial values
    updateSensitivity();
    updateMinPixels();
}

// Start webcam and motion detection
async function startDetection() {
    if (isRunning) return;
    
    try {
        // Request camera access with constraints
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });
        
        // Set video source and start playing
        video.srcObject = stream;
        await video.play();
        
        // Get actual video dimensions
        width = video.videoWidth;
        height = video.videoHeight;
        
        // Set canvas dimensions to match video
        motionCanvas.width = width;
        motionCanvas.height = height;
        
        // Update UI
        resolutionDisplay.textContent = `RESOLUTION: ${width}x${height}`;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        isRunning = true;
        
        // Start motion detection
        lastFrameData = null;
        motionInterval = setInterval(detectMotion, 100); // Check for motion 10 times per second
        
        // Hide no camera message if visible
        noCameraMessage.classList.add('hidden');
        
    } catch (err) {
        console.error('Error accessing camera:', err);
        noCameraMessage.classList.remove('hidden');
    }
}

// Stop motion detection and release camera
function stopDetection() {
    if (!isRunning) return;
    
    // Clear intervals
    clearInterval(motionInterval);
    clearTimeout(motionTimeout);
    
    // Stop video and release camera
    const stream = video.srcObject;
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    
    // Reset canvas
    ctx.clearRect(0, 0, width, height);
    
    // Update UI
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusText.textContent = 'NO MOTION';
    levelBar.style.width = '0%';
    document.body.classList.remove('motion-detected');
    resolutionDisplay.textContent = 'RESOLUTION: --';
    fpsDisplay.textContent = 'FPS: --';
    
    isRunning = false;
    motionDetected = false;
    lastFrameData = null;
}

// Core motion detection algorithm
function detectMotion() {
    if (!isRunning || !ctx) return;
    
    try {
        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, width, height);
        
        // Get image data for analysis
        const currentFrameData = ctx.getImageData(0, 0, width, height).data;
        
        // Skip first frame as we need two frames to compare
        if (!lastFrameData) {
            lastFrameData = currentFrameData;
            return;
        }
        
        // Calculate FPS
        frameCount++;
        const now = performance.now();
        if (now - lastFpsUpdateTime >= 1000) { // Update FPS once per second
            fpsDisplay.textContent = `FPS: ${frameCount}`;
            frameCount = 0;
            lastFpsUpdateTime = now;
        }
        
        // Compare frames to detect motion
        let changedPixels = 0;
        
        // Sample every 4th pixel for performance (RGBA values)
        for (let i = 0; i < currentFrameData.length; i += 16) {
            // Get RGB values (skip alpha)
            const r1 = currentFrameData[i];
            const g1 = currentFrameData[i + 1];
            const b1 = currentFrameData[i + 2];
            
            const r2 = lastFrameData[i];
            const g2 = lastFrameData[i + 1];
            const b2 = lastFrameData[i + 2];
            
            // Calculate difference
            const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
            
            // Check if pixel changed significantly
            if (diff > sensitivity) {
                changedPixels++;
                
                // Optionally visualize changed pixels
                const pixelIndex = i / 4;
                const x = pixelIndex % width;
                const y = Math.floor(pixelIndex / width);
                
                // Draw a small red dot for changed pixels (for visualization)
                ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.fillRect(x, y, 4, 4);
            }
        }
        
        // Scale up the changed pixels count since we're sampling
        const scaledChangedPixels = changedPixels * 4;
        
        // Update motion level indicator
        const motionLevel = Math.min(100, (scaledChangedPixels / minPixels) * 100);
        levelBar.style.width = `${motionLevel}%`;
        
        // Check if motion threshold is exceeded
        if (scaledChangedPixels > minPixels) {
            // Motion detected
            if (!motionDetected) {
                motionDetected = true;
                statusText.textContent = 'MOTION DETECTED';
                document.body.classList.add('motion-detected');
                
                // Play sound if enabled
                if (soundEnabled) {
                    playBingSound();
                }
            }
            
            // Reset motion timeout
            clearTimeout(motionTimeout);
            lastMotionTime = performance.now();
            
            // Set timeout to reset motion status after delay
            motionTimeout = setTimeout(() => {
                motionDetected = false;
                statusText.textContent = 'NO MOTION';
                document.body.classList.remove('motion-detected');
            }, motionResetDelay);
        }
        
        // Store current frame for next comparison
        lastFrameData = currentFrameData;
        
    } catch (err) {
        console.error('Error in motion detection:', err);
    }
}

// Play the "bing" sound
function playBingSound() {
    try {
        // Reset sound to beginning
        bingSound.currentTime = 0;
        
        // Play the sound
        bingSound.play().catch(err => {
            console.warn('Could not play sound:', err);
        });
    } catch (err) {
        console.error('Error playing sound:', err);
    }
}

// Update sensitivity value
function updateSensitivity() {
    sensitivity = parseInt(sensitivitySlider.value);
    sensitivityValue.textContent = sensitivity;
}

// Update minimum pixels value
function updateMinPixels() {
    minPixels = parseInt(minPixelsSlider.value);
    minPixelsValue.textContent = minPixels;
}

// Toggle sound on/off
function toggleSound() {
    soundEnabled = soundToggle.checked;
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Handle page visibility changes to pause detection when tab is inactive
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRunning) {
        // Pause detection when tab is not visible
        clearInterval(motionInterval);
    } else if (!document.hidden && isRunning) {
        // Resume detection when tab becomes visible again
        motionInterval = setInterval(detectMotion, 100);
    }
});