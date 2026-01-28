import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Mic, MicOff, BrainCircuit, X, Info, Loader2, Activity } from 'lucide-react';

// Manual base64 encoding/decoding as required by guidelines
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const VoiceAssistant: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<string>('Stand-by');
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const startSession = async () => {
    setStatus('Conectando...');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'Você é o assistente virtual do sistema SAL (Sistema de Análise de Leitura). Seu objetivo é ajudar técnicos e gestores a interpretar dados de leitura, códigos de impedimento e performance de campo. Seja conciso, técnico e profissional. Você deve responder em Português do Brasil.',
        },
        callbacks: {
          onopen: () => {
            setStatus('Ouvindo');
            setIsListening(true);
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              
              sessionPromiseRef.current?.then((session: any) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (msg: any) => {
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const ctx = outputAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => {
                try { s.stop(); } catch(e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => stopSession(),
          onerror: (e) => {
            console.error("Live Audio Error:", e);
            stopSession();
          },
        },
      });
    } catch (err) {
      console.error("Microphone Access Error:", err);
      setStatus('Erro no Microfone');
      setIsActive(false);
    }
  };

  const stopSession = () => {
    sessionPromiseRef.current?.then((session: any) => {
      try { session.close(); } catch(e) {}
    });
    sessionPromiseRef.current = null;
    
    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();
    
    sourcesRef.current.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();
    
    setIsActive(false);
    setIsListening(false);
    setStatus('Stand-by');
  };

  return (
    <div className="fixed bottom-10 right-10 z-[100] flex flex-col items-end gap-4 print:hidden">
      {isActive && (
        <div className="w-80 bg-[#020617] rounded-[2.5rem] shadow-2xl border border-white/10 p-8 animate-in slide-in-from-bottom-10 duration-500 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><BrainCircuit size={100} className="text-white" /></div>
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <h4 className="text-white font-black text-[10px] uppercase tracking-[0.2em]">SAL AI Voice Terminal</h4>
            <button onClick={() => { setIsActive(false); stopSession(); }} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
          </div>

          <div className="flex flex-col items-center gap-6 relative z-10">
            <div className={`w-28 h-28 rounded-full flex items-center justify-center relative transition-all duration-500 ${isListening ? 'bg-indigo-600/10' : 'bg-slate-800'}`}>
              {isListening && (
                <>
                  <div className="absolute inset-0 rounded-full border-2 border-indigo-600 animate-ping opacity-30"></div>
                  <div className="absolute inset-4 rounded-full border-4 border-indigo-50/20 animate-pulse"></div>
                </>
              )}
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isListening ? 'bg-indigo-600 shadow-xl shadow-indigo-600/40' : 'bg-slate-700'}`}>
                 {isListening ? <Activity size={24} className="text-white animate-pulse" /> : <MicOff size={24} className="text-slate-400" />}
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-white font-black text-sm mb-1 tracking-tight flex items-center justify-center gap-2">
                {status === 'Conectando...' && <Loader2 size={14} className="animate-spin text-indigo-400" />}
                {status}
              </p>
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Interface de Voz em Tempo Real</p>
            </div>

            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
               <div className={`h-full bg-indigo-500 transition-all duration-700 ${isListening ? 'w-full' : 'w-0'}`}></div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
               <Info size={14} className="text-indigo-400 mt-0.5 shrink-0" />
               <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                 Use comandos de voz para solicitar suporte técnico ou analisar tendências de campo no SAL.
               </p>
            </div>
          </div>
        </div>
      )}

      <button 
        onClick={() => {
          if (!isActive) {
            setIsActive(true);
            startSession();
          } else {
            stopSession();
          }
        }}
        className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 group relative ${isActive ? 'bg-rose-600 shadow-rose-600/20' : 'bg-indigo-600 shadow-indigo-600/20'}`}
        aria-label="Ativar Assistente de Voz"
      >
        {isActive ? <MicOff size={28} className="text-white" /> : <Mic size={28} className="text-white" />}
        <div className={`absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-slate-900 transition-colors ${isActive ? 'bg-rose-400' : 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
        
        <div className="absolute right-full mr-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest pointer-events-none whitespace-nowrap border border-white/10 shadow-2xl">
          Suporte por Voz SAL
        </div>
      </button>
    </div>
  );
};

export default VoiceAssistant;