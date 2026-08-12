/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Dynamic bell sound synthesizer using Web Audio API
export function playChime(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        resolve();
        return;
      }
      const ctx = new AudioContext();
      
      const playTone = (freq: number, start: number, duration: number, type: OscillatorType = 'sine') => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        
        // Volume envelope: fast attack, gradual decay
        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(0.3, start + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start(start);
        osc.stop(start + duration);
      };

      // Play traditional dual-tone "Ding-Dong" or "Bing-Bong"
      const now = ctx.currentTime;
      playTone(554.37, now, 0.8, 'sine'); // C#5
      playTone(440.00, now + 0.35, 1.0, 'sine'); // A4
      
      setTimeout(() => {
        ctx.close();
        resolve();
      }, 1500);
    } catch (e) {
      console.warn('Web Audio API not supported or blocked by browser policy:', e);
      resolve();
    }
  });
}

// Simple voice synthesiser for Indonesian queue announcement
export async function playQueueAnnouncement(queueNumber: string, loket: number) {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis is not supported in this browser.');
    return;
  }

  // Play a chime first!
  await playChime();

  // Stop current speech
  window.speechSynthesis.cancel();

  const letter = queueNumber.charAt(0);
  const numberStr = queueNumber.substring(1); // e.g. "002"
  
  // Spell out numbers and service in Indonesian
  let parsedNumber = '';
  for (let i = 0; i < numberStr.length; i++) {
    const digit = numberStr.charAt(i);
    switch (digit) {
      case '0': parsedNumber += ' kosong '; break;
      case '1': parsedNumber += ' satu '; break;
      case '2': parsedNumber += ' dua '; break;
      case '3': parsedNumber += ' tiga '; break;
      case '4': parsedNumber += ' empat '; break;
      case '5': parsedNumber += ' lima '; break;
      case '6': parsedNumber += ' enam '; break;
      case '7': parsedNumber += ' tujuh '; break;
      case '8': parsedNumber += ' delapan '; break;
      case '9': parsedNumber += ' sembilan '; break;
    }
  }

  const textToSpeak = `Nomor antrian, ${letter}, ${parsedNumber}, silakan menuju loket ${loket}`;
  
  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  
  // Try to find an Indonesian voice
  const voices = window.speechSynthesis.getVoices();
  const idVoice = voices.find(voice => voice.lang.includes('id') || voice.lang.includes('ID'));
  if (idVoice) {
    utterance.voice = idVoice;
  }
  utterance.lang = 'id-ID';
  utterance.rate = 0.85; // slightly slower for clear public announcements
  utterance.pitch = 1.05;

  window.speechSynthesis.speak(utterance);
}
