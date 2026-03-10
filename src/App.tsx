import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Calculator, 
  Languages, 
  ShieldCheck, 
  FlaskConical, 
  GraduationCap, 
  ChevronRight, 
  Send, 
  Sparkles, 
  RotateCcw,
  MessageSquare,
  Lightbulb,
  BrainCircuit,
  User,
  Bot,
  Mic,
  MicOff,
  Volume2,
  VolumeX
} from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { SUBJECTS, Grade, Subject, LearningMode, Message } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Speech Recognition Type Definitions
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [selectedGrade, setSelectedGrade] = useState<Grade>(1);
  const [selectedSubject, setSelectedSubject] = useState<Subject>(SUBJECTS[0]);
  const [mode, setMode] = useState<LearningMode>("explanation");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState<number | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Track user interaction to allow auto-play
  useEffect(() => {
    const handleInteraction = () => {
      setHasInteracted(true);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'zh-CN';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + transcript);
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const speakText = async (text: string, index: number) => {
    if (isPlaying === index) {
      audioRef.current?.pause();
      setIsPlaying(null);
      return;
    }

    setIsPlaying(index);
    try {
      // Clean markdown but KEEP basic punctuation for natural intonation and pauses
      const cleanText = text
        .replace(/[#*`_~\[\]()]/g, '') // Remove markdown structural symbols
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim()
        .slice(0, 1000);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `你是一位非常有亲和力的小学老师。请用最自然、最像真人的语气朗读这段话。注意语速适中，情感丰富，在标点符号处有自然的停顿和语调起伏：${cleanText}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' }, // Zephyr is often clearer and more professional
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        // Use audio/mpeg as Gemini TTS typically returns MP3 data
        const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
        
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }

        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => setIsPlaying(null);
        audioRef.current.onerror = (e) => {
          console.error("Audio load error:", e);
          setIsPlaying(null);
        };

        try {
          await audioRef.current.play();
        } catch (playError) {
          console.warn("Auto-play blocked or failed:", playError);
          setIsPlaying(null);
        }
      }
    } catch (error) {
      console.error("TTS error:", error);
      setIsPlaying(null);
      // Fallback to browser TTS
      const utterance = new SpeechSynthesisUtterance(text.replace(/[#*`_~\[\]()]/g, '').slice(0, 200));
      utterance.lang = 'zh-CN';
      utterance.onend = () => setIsPlaying(null);
      window.speechSynthesis.speak(utterance);
    }
  };

  const generateInitialContent = async (grade: Grade, subject: Subject, learningMode: LearningMode) => {
    setIsLoading(true);
    try {
      let modePrompt = "";
      if (learningMode === 'explanation') {
        modePrompt = `现在进入“名师讲课”模式。请针对${grade}年级${subject.name}的一个核心知识点，准备一段生动的讲课内容。
        要求：像在课堂上讲课一样，有开场白，有知识点拆解，有生动的例子。`;
      } else if (learningMode === 'exercise') {
        modePrompt = `现在进入“互动做题”模式。请为${grade}年级${subject.name}出一个练习题。
        要求：先给出一道具体的题目，并鼓励学生尝试回答。题目要符合该年级的认知水平。`;
      } else {
        modePrompt = `现在进入“你问我答”模式。
        要求：亲切地告诉学生，老师现在专门负责回答你的问题。请学生提出在学习${subject.name}过程中遇到的任何困难。`;
      }

      const prompt = `你是一位专业的小学老师。现在正在为${grade}年级的学生教学${subject.name}（教材：${subject.textbook}）。
      ${modePrompt}
      请使用亲切、鼓励的语气，并使用Markdown格式。`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ parts: [{ text: prompt }] }],
      });

      const text = response.text || "抱歉，我暂时无法生成内容。";
      setMessages([{ role: "assistant", content: text }]);
      
      // Auto-speak initial content only if user has interacted
      if (hasInteracted) {
        setTimeout(() => speakText(text, 0), 1000);
      }
    } catch (error) {
      console.error("Error generating content:", error);
      setMessages([{ role: "assistant", content: "连接AI助手失败，请检查网络或稍后再试。" }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateInitialContent(selectedGrade, selectedSubject, mode);
  }, [selectedGrade, selectedSubject, mode]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      let systemInstruction = "";
      if (mode === 'explanation') {
        systemInstruction = `你是一位正在讲课的小学老师。学生正在听你讲解${selectedGrade}年级${selectedSubject.name}。
        请继续你的讲解，或者回答学生关于当前知识点的疑问。保持课堂氛围生动活泼。`;
      } else if (mode === 'exercise') {
        systemInstruction = `你是一位正在辅导学生做题的小学老师。学生正在尝试回答你出的${selectedGrade}年级${selectedSubject.name}题目。
        如果学生答对了，请给予热烈表扬并出下一道题。
        如果学生答错了，请给出提示引导他思考，不要直接给答案。`;
      } else {
        systemInstruction = `你是一位专门负责答疑的小学老师。学生正在向你提问关于${selectedGrade}年级${selectedSubject.name}的问题。
        请耐心、详细地回答学生的问题，确保他能听懂。`;
      }

      const history = messages.map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [
          ...history,
          { parts: [{ text: input }] }
        ],
        config: {
          systemInstruction: systemInstruction,
        }
      });

      const text = response.text || "老师正在思考，请稍后再试。";
      const newMessageIndex = messages.length + 1;
      setMessages(prev => [...prev, { role: "assistant", content: text }]);
      
      // Auto-speak response
      setTimeout(() => speakText(text, newMessageIndex), 500);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: "assistant", content: "哎呀，老师走神了，请再说一遍好吗？" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "BookOpen": return <BookOpen className="w-5 h-5" />;
      case "Calculator": return <Calculator className="w-5 h-5" />;
      case "Languages": return <Languages className="w-5 h-5" />;
      case "ShieldCheck": return <ShieldCheck className="w-5 h-5" />;
      case "FlaskConical": return <FlaskConical className="w-5 h-5" />;
      default: return <BookOpen className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
        <div className="p-6 border-bottom border-slate-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">智学助手</h1>
              <p className="text-xs text-slate-400">AI 互动教学平台</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Grade Selection */}
            <section>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 block">选择年级</label>
              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 3, 4, 5, 6] as Grade[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedGrade(g)}
                    className={cn(
                      "py-2 rounded-lg text-sm font-medium transition-all border",
                      selectedGrade === g 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" 
                        : "bg-white border-slate-100 text-slate-500 hover:border-slate-300"
                    )}
                  >
                    {g}年级
                  </button>
                ))}
              </div>
            </section>

            {/* Subject Selection */}
            <section>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 block">选择科目</label>
              <div className="space-y-1">
                {SUBJECTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSubject(s)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                      selectedSubject.id === s.id
                        ? "bg-slate-900 text-white shadow-md shadow-slate-200"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                      selectedSubject.id === s.id ? "bg-white/20" : cn(s.color, "text-white")
                    )}>
                      {getIcon(s.icon)}
                    </div>
                    <span className="flex-1 text-left">{s.name}</span>
                    <ChevronRight className={cn(
                      "w-4 h-4 transition-transform",
                      selectedSubject.id === s.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                    )} />
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="mt-auto p-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">当前教材</p>
            <p className="text-xs font-medium text-slate-700 leading-relaxed">
              {selectedSubject.textbook}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setMode("explanation")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
                  mode === "explanation" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                名师讲课
              </button>
              <button
                onClick={() => setMode("exercise")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
                  mode === "exercise" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                互动做题
              </button>
              <button
                onClick={() => setMode("qa")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
                  mode === "qa" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                你问我答
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => generateInitialContent(selectedGrade, selectedSubject, mode)}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="重新生成"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <div className="h-8 w-px bg-slate-200 mx-1" />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full border border-indigo-100">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-tight">AI Tutor Active</span>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth"
        >
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={cn(
                "flex gap-4 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500",
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                msg.role === "user" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-indigo-600"
              )}>
                {msg.role === "user" ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
              </div>
              <div className={cn(
                "relative p-6 rounded-3xl shadow-sm leading-relaxed group",
                msg.role === "user" 
                  ? "bg-slate-900 text-white rounded-tr-none" 
                  : "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
              )}>
                <div className="prose prose-slate max-w-none prose-sm prose-headings:font-bold prose-headings:text-slate-900 prose-p:leading-relaxed prose-strong:text-indigo-600">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.role === "assistant" && (
                  <button
                    onClick={() => speakText(msg.content, i)}
                    className={cn(
                      "absolute -right-12 top-0 p-2 rounded-full transition-all opacity-0 group-hover:opacity-100",
                      isPlaying === i ? "bg-indigo-100 text-indigo-600" : "text-slate-300 hover:text-indigo-500"
                    )}
                  >
                    {isPlaying === i ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 mr-auto animate-pulse">
              <div className="w-10 h-10 rounded-2xl bg-slate-200" />
              <div className="h-24 w-64 bg-slate-100 rounded-3xl rounded-tl-none" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-8 pt-0">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000"></div>
            <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden focus-within:border-indigo-400 transition-colors">
              <button
                onClick={toggleListening}
                className={cn(
                  "ml-2 p-3 rounded-xl transition-all",
                  isListening ? "bg-red-50 text-red-500 animate-pulse" : "text-slate-400 hover:bg-slate-50"
                )}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={isListening ? "正在倾听..." : "跟老师说点什么吧..."}
                className="flex-1 px-4 py-4 text-sm focus:outline-none placeholder:text-slate-400"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className={cn(
                  "mr-2 p-3 rounded-xl transition-all",
                  isLoading || !input.trim() 
                    ? "text-slate-300" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200"
                )}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-4 font-medium uppercase tracking-widest">
            Powered by Gemini AI • 智学助手为您提供语音互动功能
          </p>
        </div>
      </main>
    </div>
  );
}
