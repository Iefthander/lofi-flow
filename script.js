// Загрузка DOM
document.addEventListener("DOMContentLoaded", () => {
    // !ЛОГИКА WEBAUDIO API
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // !ГЕНЕРАТОР LO-FI МУЗЫКИ
    let isLofiPlaying = false;
    let lofiTimerId = null;
    const bpm = 70;
    let currentStep = 0; // Шаги от 0 до 63 (16 тактов по 4 шага)

    const chordProgression = [
        // Секция А
        { chord: [220.00, 261.63, 329.63, 392.00], scale: [440, 523.25, 659.25, 783.99] }, // Am7
        { chord: [146.83, 261.63, 293.66, 349.23], scale: [293.66, 349.23, 440, 523.25] }, // Dm7
        { chord: [174.61, 261.63, 329.63, 349.23], scale: [349.23, 392.00, 440, 659.25] }, // Fmaj7
        { chord: [164.81, 246.94, 293.66, 329.63], scale: [329.63, 392.00, 493.88, 587.33] }, // Em7
        
        // Секция Б (Вариация)
        { chord: [220.00, 261.63, 329.63, 392.00], scale: [440, 523.25, 659.25, 783.99] }, // Am7
        { chord: [130.81, 261.63, 329.63, 392.00], scale: [261.63, 329.63, 392.00, 523.25] }, // Cmaj7/G
        { chord: [174.61, 261.63, 329.63, 349.23], scale: [349.23, 440, 523.25, 659.25] }, // Fmaj7
        { chord: [196.00, 246.94, 293.66, 392.00], scale: [392.00, 493.88, 587.33, 783.99] }  // G7
    ];

    let masterFilter = null;
    let lofiGainNode = null;
    let noiseBuffer = null;
    let lofiInitialized = false;

    function initLofiAudio() {
        if (lofiInitialized) return;

        // Мастер-фильтр среза верхов (слегка приоткрыли для яркости)
        masterFilter = audioCtx.createBiquadFilter();
        masterFilter.type = 'lowpass';
        masterFilter.frequency.value = 950;

        // Компрессор для плотности и выравнивания громкости без клиппинга
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
        compressor.knee.setValueAtTime(30, audioCtx.currentTime);
        compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
        compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
        compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

        // Узел мастер-громкости (увеличен базовый уровень до 1.2)
        lofiGainNode = audioCtx.createGain();
        lofiGainNode.gain.value = 1.2;

        // Цепочка: Фильтр -> Компрессор -> Громкость -> Выход
        masterFilter.connect(compressor);
        compressor.connect(lofiGainNode);
        lofiGainNode.connect(audioCtx.destination);

        // Буфер шума
        const bufferSize = audioCtx.sampleRate * 2;
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

        // Фоновый шум винила
        const vinyl = audioCtx.createBufferSource();
        vinyl.buffer = noiseBuffer;
        vinyl.loop = true;
        const vinylGain = audioCtx.createGain();
        vinylGain.gain.value = 0.015;
        vinyl.connect(vinylGain);
        vinylGain.connect(masterFilter);
        vinyl.start();

        lofiInitialized = true;
    }

    function playKick(time) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(110, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.15);
        gain.gain.setValueAtTime(0.9, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
        osc.connect(gain); gain.connect(masterFilter);
        osc.start(time); osc.stop(time + 0.25);
    }

    function playSnare(time, isSoft = false) {
        const noise = audioCtx.createBufferSource();
        noise.buffer = noiseBuffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass'; filter.frequency.value = 1000;
        const gain = audioCtx.createGain();
        const vol = isSoft ? 0.25 : 0.5;
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);
        noise.connect(filter); filter.connect(gain); gain.connect(masterFilter);
        noise.start(time); noise.stop(time + 0.18);
    }

    function playHiHat(time, volume = 0.15) {
        const noise = audioCtx.createBufferSource();
        noise.buffer = noiseBuffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass'; filter.frequency.value = 6000;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        noise.connect(filter); filter.connect(gain); gain.connect(masterFilter);
        noise.start(time); noise.stop(time + 0.04);
    }

    function playChord(notes, time) {
        notes.forEach(freq => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);
            osc.detune.setValueAtTime((Math.random() - 0.5) * 10, time);
            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.18, time + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 2.0);
            osc.connect(gain); gain.connect(masterFilter);
            osc.start(time); osc.stop(time + 2.0);
        });
    }

    function playSoloNote(scale, time) {
        const freq = scale[Math.floor(Math.random() * scale.length)];
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc.detune.setValueAtTime((Math.random() - 0.5) * 8, time);

        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(0.1, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.8);

        osc.connect(gain); gain.connect(masterFilter);
        osc.start(time); osc.stop(time + 0.8);
    }

    function processStep() {
        const now = audioCtx.currentTime;
        const measure = Math.floor(currentStep / 4);
        const stepInMeasure = currentStep % 4;
        const currentChordObj = chordProgression[measure % chordProgression.length];

        const isIntro = measure < 2;
        const isBreak = measure === 7 || measure === 15;

        if (!isIntro) {
            playHiHat(now, stepInMeasure % 2 === 0 ? 0.18 : 0.09);

            if (stepInMeasure === 0 || (stepInMeasure === 2 && !isBreak && Math.random() > 0.5)) {
                playKick(now);
            }

            if (stepInMeasure === 2 && !isBreak) {
                playSnare(now);
            }

            if (isBreak && stepInMeasure === 3) {
                playSnare(now, true);
            }
        }

        if (stepInMeasure === 0) {
            playChord(currentChordObj.chord, now);
        }

        if (Math.random() < 0.35) {
            playSoloNote(currentChordObj.scale, now);
        }

        currentStep = (currentStep + 1) % 64;
    }

    // !ОБРАБОТКА ВСЕХ КАРТОЧЕК
    const soundCards = document.querySelectorAll(".sound-card");

    soundCards.forEach(card => {
        const playBtn = card.querySelector(".play-btn");
        const volumeSlider = card.querySelector(".volume-slider");
        const isLofiCard = card.dataset.sound === 'lofi';

        // ЛОГИКА ДЛЯ КАРТОЧКИ LO-FI ГЕНЕРАТОРА
        if (isLofiCard) {
            playBtn.addEventListener('click', () => {
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }
                initLofiAudio();

                if (!isLofiPlaying) {
                    isLofiPlaying = true;
                    card.classList.add('playing');
                    updateIcon(playBtn, 'pause');
                    currentStep = 0;
                    processStep();
                    const stepTime = (60 / bpm / 2) * 1000;
                    lofiTimerId = setInterval(processStep, stepTime);
                } else {
                    isLofiPlaying = false;
                    card.classList.remove('playing');
                    updateIcon(playBtn, 'play');
                    clearInterval(lofiTimerId);
                }
            });

            // Ползунок громкости для генератора
            volumeSlider.addEventListener('input', (e) => {
                const vol = e.target.value;
                if (lofiGainNode) {
                    lofiGainNode.gain.value = vol * 1.5;
                }
                localStorage.setItem('volume_lofi', vol);
            });

            // Загрузка сохраненной громкости
            const savedVol = localStorage.getItem('volume_lofi');
            if (savedVol !== null) {
                volumeSlider.value = savedVol;
            }

            return;
        }

        // ЛОГИКА ДЛЯ ОБЫЧНЫХ АУДИО-КАРТОЧЕК (Rain, Flame, Forest...)
        const audioPath = card.querySelector('audio').getAttribute('src');
        let audioBuffer = null;

        fetch(audioPath)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
            .then(decodedData => {
                audioBuffer = decodedData;
            });

        const gainNode = audioCtx.createGain();
        gainNode.connect(audioCtx.destination);

        const savedVolume = localStorage.getItem('volume_' + card.dataset.sound);
        if (savedVolume !== null) {
            volumeSlider.value = savedVolume;
            gainNode.gain.value = savedVolume;
        } else {
            gainNode.gain.value = volumeSlider.value;
        }

        let sourceNode = null;
        playBtn.addEventListener('click', () => {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            if (card.classList.contains('playing')) {
                if (sourceNode) {
                    sourceNode.stop();
                    sourceNode = null;
                }
                card.classList.remove('playing');
                updateIcon(playBtn, 'play');
            } else {
                if (!audioBuffer) return;
                sourceNode = audioCtx.createBufferSource();
                sourceNode.buffer = audioBuffer;
                sourceNode.loop = true;
                sourceNode.connect(gainNode);
                sourceNode.start(0);

                card.classList.add('playing');
                updateIcon(playBtn, 'pause');
            }
        });

        volumeSlider.addEventListener('input', (value) => {
            const currentVolume = value.target.value;
            gainNode.gain.value = currentVolume;
            localStorage.setItem('volume_' + card.dataset.sound, currentVolume);
        });
    });

    // Вспомогательная функция для замены иконки
    function updateIcon(button, iconName) {
        button.innerHTML = '';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', iconName);
        button.appendChild(icon);

        if (window.lucide) {
            lucide.createIcons({
                nameAttr: 'data-lucide',
                attrs: {},
                element: button
            });
        }
    }

    // !АНИМАЦИИ ЗВЕЗД
    const canvas = document.getElementById('stars-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        function realizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        realizeCanvas();
        window.addEventListener('resize', realizeCanvas);

        const stars = [];
        const numStars = 100;
        for (let i = 0; i < numStars; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: Math.random() * 2.5,
                alpha: Math.random(),
                speed: Math.random() * 0.01 + 0.005
            });
        }

        function animateStars() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            stars.forEach(star => {
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
                ctx.fill();

                star.alpha += star.speed;
                if (star.alpha > 1 || star.alpha < 0) {
                    star.speed = -star.speed;
                }
            });
            requestAnimationFrame(animateStars);
        }
        animateStars();
    }
});