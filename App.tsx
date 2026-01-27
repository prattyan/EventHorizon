import React, { useState, useEffect, useCallback, Suspense, lazy, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';
import {
  Users, Sparkles, MapPin, ExternalLink, QrCode, ChevronRight, Edit, Calendar, Clock, Plus, ScanLine, Filter, Download, Mail, Send, CheckCircle, XCircle,
  Menu,
  X,
  Ticket, Info, Trash2, Camera, RefreshCw, Smartphone, Shield, LogOut, Settings as Setting2, Layout, Bell, UserCircle, Search, MoreHorizontal, Check, AlertCircle, CheckSquare, MessageSquare, KeyRound, Share2, Facebook, Twitter, Linkedin, Copy, Star, CalendarPlus, Loader2, Image as ImageIcon, ChevronLeft, Link, Save, Upload, Tag
} from 'lucide-react';
import html2canvas from 'html2canvas';
import Cropper from 'react-easy-crop';
import { format } from 'date-fns';

import { Event as AppEvent, Registration, RegistrationStatus, Tab, Toast, User, Role, CustomQuestion, Review, ParticipationMode, Team, PromoCode, PaymentDetails, PaymentStatus } from './types';
import {
  getEvents, saveEvent, updateEvent, getRegistrations, addRegistration,
  updateRegistrationStatus, markAttendance, deleteRegistration, deleteEvent,
  loginUser, registerUser, subscribeToAuth, logoutUser,
  loginWithGoogle, saveUserProfile, resetUserPassword,
  createTeam, getTeamByInviteCode, joinTeam, getTeamsByEventId, getTeamById,
  getNotifications, addNotification, markNotificationRead, markAllNotificationsRead,
  getMessages, addMessage, getReviews, addReview, deleteAccount, getEventById, getEventImage, getInitialData,
  initRecaptcha, signInWithPhone, verifyPhoneOtp, checkPhoneNumberExists, getUserProfile
} from './services/storageService';
import { generateEventDescription, getEventRecommendations } from './services/geminiService';
import { sendStatusUpdateEmail, sendReminderEmail } from './services/notificationService';
import { socketService } from './services/socketService';

// Lazy load heavy components for better initial load time
const Scanner = lazy(() => import('./components/Scanner'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const LiquidChrome = lazy(() => import('./components/LiquidChrome'));
const ParticleBackground = lazy(() => import('./components/ParticleBackground'));
const EventChatBot = lazy(() => import('./components/EventChatBot'));

// --- Sub-Components ---

const ToastContainer = ({ toasts }: { toasts: Toast[] }) => (
  <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4 sm:px-0">
    <AnimatePresence>
      {toasts.map(t => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          className={`pointer-events-auto border-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-[24px] px-7 py-5 text-sm font-black flex items-center gap-4 relative overflow-hidden
            ${t.type === 'success' ? 'bg-[#020617] border-green-500/30 text-green-400' :
              t.type === 'error' ? 'bg-[#020617] border-red-500/30 text-red-400' :
                t.type === 'warning' ? 'bg-[#020617] border-amber-500/30 text-amber-400' :
                  'bg-[#020617] border-orange-500/30 text-orange-400'
            } `}
        >
          <div className={`absolute -inset-1 opacity-20 blur-xl -z-10 ${t.type === 'success' ? 'bg-green-500' :
            t.type === 'error' ? 'bg-red-500' :
              t.type === 'warning' ? 'bg-amber-500' :
                'bg-orange-500'
            } `} />

          <div className={`p-2 rounded-xl flex-shrink-0 ${t.type === 'success' ? 'bg-green-500/20' :
            t.type === 'error' ? 'bg-red-500/20' :
              t.type === 'warning' ? 'bg-amber-500/20' :
                'bg-orange-500/20'
            } `}>
            {t.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {t.type === 'error' && <XCircle className="w-5 h-5" />}
            {t.type === 'warning' && <AlertCircle className="w-5 h-5" />}
            {(t.type === 'info' || !t.type) && <Info className="w-5 h-5" />}
          </div>
          <span className="flex-1 leading-snug tracking-tight">{t.message}</span>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

const Badge = ({ status }: { status: RegistrationStatus }) => {
  const styles = {
    [RegistrationStatus.PENDING]: 'bg-amber-900/40 text-amber-500 border-amber-800',
    [RegistrationStatus.APPROVED]: 'bg-green-900/40 text-green-500 border-green-800',
    [RegistrationStatus.REJECTED]: 'bg-red-900/40 text-red-500 border-red-800',
    [RegistrationStatus.WAITLISTED]: 'bg-orange-900/40 text-orange-400 border-orange-800',
  };

  return (
    <span className={`px - 2 py - 1 rounded - md text - [11px] font - bold uppercase tracking - wider border ${styles[status]} `}>
      {status}
    </span>
  );
};

// --- Skeletons ---

const EventCardSkeleton = () => (
  <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden h-full flex flex-col">
    <div className="h-48 bg-slate-800 animate-pulse" />
    <div className="p-6 flex-1 flex flex-col space-y-4">
      <div className="flex gap-4">
        <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
        <div className="h-4 w-16 bg-slate-800 rounded animate-pulse" />
      </div>
      <div className="h-6 w-3/4 bg-slate-800 rounded animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-slate-800 rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-slate-800 rounded animate-pulse" />
      </div>
      <div className="h-12 w-full bg-slate-800 rounded-xl mt-auto animate-pulse" />
    </div>
  </div>
);

const TicketSkeleton = () => (
  <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center gap-6 animate-pulse">
    <div className="flex-1 w-full space-y-3">
      <div className="flex justify-between md:block">
        <div className="h-5 w-20 bg-slate-800 rounded" />
      </div>
      <div className="h-6 w-48 bg-slate-800 rounded" />
      <div className="flex gap-3">
        <div className="h-4 w-24 bg-slate-800 rounded" />
        <div className="h-4 w-32 bg-slate-800 rounded" />
      </div>
    </div>
    <div className="w-full md:w-32 h-12 bg-slate-800 rounded-xl" />
  </div>
);

const ListRowSkeleton = () => (
  <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4 animate-pulse">
    <div className="space-y-3 w-full sm:w-1/2">
      <div className="h-6 w-3/4 bg-slate-800 rounded" />
      <div className="h-4 w-1/2 bg-slate-800 rounded" />
    </div>
    <div className="h-10 w-full sm:w-24 bg-slate-800 rounded-lg" />
  </div>
);

// --- Helpers ---

// Helper to lazy load participant avatar if missing
const ParticipantAvatar = ({ name, avatarUrl, userId }: { name: string, avatarUrl?: string, userId: string }) => {
  const [src, setSrc] = useState(avatarUrl);

  useEffect(() => {
    if (src || !userId) return;

    let mounted = true;
    getUserProfile(userId).then(user => {
      if (mounted && user && user.avatarUrl) {
        setSrc(user.avatarUrl);
      }
    });

    return () => { mounted = false; };
  }, [userId, src]);

  return (
    <div className="flex flex-col items-center gap-2 p-2 bg-slate-800/30 rounded-xl border border-slate-800 hover:bg-slate-800/50 transition-colors group">
      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700 group-hover:border-orange-500/50 transition-colors">
        {src ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <span className="text-[10px] text-slate-300 font-medium text-center truncate w-full px-1" title={name}>
        {name.split(' ')[0]}
      </span>
    </div>
  );
};

const LazyEventImage = ({ eventId, initialSrc, alt, className }: { eventId: string, initialSrc?: string, alt: string, className?: string }) => {
  const [src, setSrc] = useState(initialSrc);
  const [loading, setLoading] = useState(!initialSrc);

  useEffect(() => {
    // If we already have a src (e.g. valid URL or cached), don't fetch
    if (initialSrc && initialSrc.length > 50) { // arbitrary length check for base64/url
      setSrc(initialSrc);
      setLoading(false);
      return;
    }

    let mounted = true;
    if (eventId) {
      getEventImage(eventId).then(url => {
        if (mounted) {
          if (url) setSrc(url);
          setLoading(false);
        }
      }).catch(() => {
        if (mounted) setLoading(false);
      });
    }
    return () => { mounted = false; };
  }, [eventId, initialSrc]);

  if (loading || !src) {
    return (
      <div className={`bg - slate - 800 flex items - center justify - center ${className} `}>
        {loading ? <Loader2 className="w-6 h-6 text-slate-600 animate-spin" /> : <ImageIcon className="w-8 h-8 text-slate-700" />}
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
};

const getCroppedImg = (imageSrc: string, pixelCrop: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No 2d context'));
        return;
      }

      // Max dimension logic to prevent massive base64 strings
      const MAX_DIMENSION = 1024;
      let targetWidth = pixelCrop.width;
      let targetHeight = pixelCrop.height;

      if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
        if (targetWidth > targetHeight) {
          targetHeight = (targetHeight / targetWidth) * MAX_DIMENSION;
          targetWidth = MAX_DIMENSION;
        } else {
          targetWidth = (targetWidth / targetHeight) * MAX_DIMENSION;
          targetHeight = MAX_DIMENSION;
        }
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Draw and resize
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        targetWidth,
        targetHeight
      );

      // Compress to 0.8 quality to further reduce size
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    image.onerror = (e) => reject(e);
  });
};



const loadRazorpay = () => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

// --- Main App Component ---

export default function App() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false); // Scroll state for header effect
  const [isAuthMode, setIsAuthMode] = useState<'signin' | 'signup' | 'forgot-password'>('signin');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'attendee' as Role });
  const [resetEmail, setResetEmail] = useState('');

  // Phone Auth State
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<'login' | 'profile' | 'deletion'>('login');



  const renderLocation = (location: string, type: 'online' | 'offline', className?: string) => {
    const isLink = type === 'online' && (location.startsWith('http') || location.includes('.') || location.toLowerCase().includes('zoom') || location.toLowerCase().includes('google.com'));

    if (isLink) {
      const isUrl = location.startsWith('http') || location.includes('.');
      if (isUrl) {
        const url = location.startsWith('http') ? location : `https://${location}`;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-orange-400 hover:text-orange-300 hover:underline transition-colors flex items-center gap-1 inline-flex ${className}`}
            onClick={(e) => e.stopPropagation()}
          >
            {location}
            <ExternalLink className="w-3 h-3" />
          </a>
        );
      }
    }
    return <span className={className}>{location}</span>;
  };

  const isPastEvent = (e: AppEvent) => {
    const now = new Date();
    const end = e.endDate ? new Date(e.endDate) : new Date(new Date(e.date).getTime() + 3600000);
    return end < now;
  };

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedEventForReg, setSelectedEventForReg] = useState<AppEvent | null>(null);
  const [selectedEventForDetails, setSelectedEventForDetails] = useState<AppEvent | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Registration | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [detailsTab, setDetailsTab] = useState<'info' | 'discussion' | 'reviews'>('info');

  // Organizer View State
  const [organizerSelectedEventId, setOrganizerSelectedEventId] = useState<string | null>(null);
  const [organizerView, setOrganizerView] = useState<'overview' | 'events'>('overview');
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | RegistrationStatus>('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT'>('ALL');
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState<string[]>([]);

  // Form States
  const [newEvent, setNewEvent] = useState<{
    title: string; date: string; endDate: string; location: string; locationType: 'online' | 'offline'; description: string; capacity: string; imageUrl: string; customQuestions: CustomQuestion[]; collaboratorEmails: string[];
    participationMode: ParticipationMode; maxTeamSize: string;
    isPaid: boolean; price: string; promoCodes: PromoCode[];
  }>({
    title: '', date: '', endDate: '', location: '', locationType: 'offline', description: '', capacity: '', imageUrl: '', customQuestions: [], collaboratorEmails: [],
    participationMode: 'individual', maxTeamSize: '5',
    isPaid: false, price: '', promoCodes: []
  });
  const [promoCodeInput, setPromoCodeInput] = useState<{ code: string; type: 'percentage' | 'fixed'; value: string }>({ code: '', type: 'percentage', value: '' });
  const [appliedPromoCode, setAppliedPromoCode] = useState<PromoCode | null>(null);
  const [userPromoCode, setUserPromoCode] = useState('');

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [registrationAnswers, setRegistrationAnswers] = useState<Record<string, string>>({});
  const [selectedRegistrationDetails, setSelectedRegistrationDetails] = useState<Registration | null>(null);
  const [teamRegistrationData, setTeamRegistrationData] = useState<{
    mode: 'individual' | 'team';
    subMode: 'create' | 'join';
    teamName: string;
    inviteCode: string;
  }>({ mode: 'individual', subMode: 'create', teamName: '', inviteCode: '' });

  // Cropper State
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [collaboratorEmailInput, setCollaboratorEmailInput] = useState('');
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentPromoCode, setPaymentPromoCode] = useState('');
  const [paymentAppliedPromo, setPaymentAppliedPromo] = useState<PromoCode | null>(null);
  const [paymentPromoMessage, setPaymentPromoMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedRegForPayment, setSelectedRegForPayment] = useState<{ reg: Registration, event: AppEvent } | null>(null);

  // --- Initialization ---

  // Auth Listener
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      if (user) {
        if (user.role === 'organizer') {
          setActiveTab('organizer');
        } else {
          setActiveTab('browse');
        }
        loadData();
      } else {
        setEvents([]);
        setRegistrations([]);
        setNotifications([]);
      }
      setAuthLoading(false);
    });

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      unsubscribe();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Socket.io Listener
  useEffect(() => {
    socketService.connect();

    const handleDataUpdate = (data: any) => {
      console.log('⚡ Real-time update:', data);

      if (data.collection === 'events') {
        loadData(true);
        if (data.action === 'insert') {
          // Check if current user is the organizer
          setCurrentUser(u => {
            if (!u || u.id !== data.document.organizerId) {
              addToast(`New event: ${data.document.title}`, 'info');
            }
            return u;
          });
        }
      } else if (data.collection === 'registrations') {
        // Just reload data, don't show "spots left" toast to avoid requiring events/registrations in deps
        loadData(true);
      }
    };

    const handleNotification = (data: any) => {
      // Use function to get latest currentUser without adding to deps
      setCurrentUser((user) => {
        if (user && data.userId === user.id) {
          addToast(data.message, data.type || 'info');
          loadData(true);
        }
        return user; // Return unchanged
      });
    };

    socketService.on('data_updated', handleDataUpdate);
    socketService.on('notification_received', handleNotification);

    return () => {
      socketService.off('data_updated', handleDataUpdate);
      socketService.off('notification_received', handleNotification);
    };
  }, []); // Empty deps - only run once on mount

  // Profile Edit State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<{ name: string; email: string; avatarUrl?: string; phoneNumber?: string; isPhoneVerified?: boolean }>({ name: '', email: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [cropPurpose, setCropPurpose] = useState<'event' | 'profile'>('event'); // Track what we are cropping

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (
      isAuthModalOpen ||
      !currentUser ||
      isCreateModalOpen ||
      isProfileModalOpen ||
      selectedEventForDetails ||
      selectedEventForReg ||
      selectedTicket ||
      selectedRegistrationDetails ||
      isScannerOpen ||
      isAnnouncementModalOpen
    ) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [
    isAuthModalOpen,
    currentUser,
    isCreateModalOpen,
    isProfileModalOpen,
    selectedEventForDetails,
    selectedEventForReg,
    selectedTicket,
    selectedRegistrationDetails,
    isScannerOpen,
    isAnnouncementModalOpen
  ]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingProfile(true);

    try {
      if (profileForm.phoneNumber && profileForm.phoneNumber !== currentUser.phoneNumber && !profileForm.isPhoneVerified) {
        addToast('Please verify your new phone number before saving', 'error');
        setIsSavingProfile(false);
        return;
      }

      const updatedUser = {
        ...currentUser,
        name: profileForm.name,
        phoneNumber: profileForm.phoneNumber,
        avatarUrl: profileForm.avatarUrl
      };
      await saveUserProfile(updatedUser);
      setCurrentUser(updatedUser);
      addToast('Profile updated', 'success');
      loadData();
    } catch (error) {
      console.error(error);
      addToast('Failed to update profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSendDeleteOtp = async () => {
    if (!currentUser?.phoneNumber) return;
    setAuthLoading(true);
    try {
      const appVerifier = initRecaptcha('persistent-profile-recaptcha');
      const confirmation = await signInWithPhone(currentUser.phoneNumber, appVerifier);
      setConfirmationResult(confirmation);
      setOtpPurpose('deletion');
      setShowOtpInput(true);
      addToast('OTP Sent for account deletion', 'info');
    } catch (e: any) {
      console.error(e);
      addToast(`Failed to send OTP: ${e.message}`, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConfirmDeletion = async () => {
    if (!currentUser || !otp) return;
    setAuthLoading(true);
    try {
      await confirmationResult.confirm(otp);
      const success = await deleteAccount(currentUser.id, currentUser.role === 'organizer');
      if (success) {
        addToast('Account deleted permanently', 'success');
        setCurrentUser(null);
        setIsProfileModalOpen(false);
      } else {
        addToast('Failed to delete some account data', 'error');
      }
    } catch (e) {
      addToast('Invalid OTP', 'error');
    } finally {
      setAuthLoading(false);
      setShowOtpInput(false);
      setOtp('');
    }
  };

  // Data Loading
  const loadData = async (isSilent = false) => {
    if (!isSilent) setDataLoading(true);
    try {
      // SECURITY: Pass both userId and userEmail for server-side role-based filtering
      const initialData = await getInitialData(
        currentUser ? currentUser.id : undefined,
        currentUser ? currentUser.email : undefined
      );
      const evts = initialData.events || [];
      const regs = initialData.registrations || [];
      const notifs = initialData.notifications || [];
      const fetchedTeams = initialData.teams || [];

      setEvents(evts);
      setRegistrations(regs);
      setNotifications(notifs);
      setTeams(fetchedTeams);

      // Legacy fallback logic removed as getInitialData now handles batch fetching for teams
      if (currentUser && fetchedTeams.length === 0 && !initialData.teams) {
        // Only run this if we are using a legacy storageService that didn't return teams (unlikely now)
        const userEventIds = regs.filter(r => r.participantEmail === currentUser.email).map(r => r.eventId);
        const organizedEventIds = currentUser.role === 'organizer' ? evts.filter(e => e.organizerId === currentUser.id).map(e => e.id) : [];
        const allEventIdsToFetchTeams = Array.from(new Set([...userEventIds, ...organizedEventIds]));

        if (allEventIdsToFetchTeams.length > 0) {
          const allTeams = await Promise.all(allEventIdsToFetchTeams.map(id => getTeamsByEventId(id)));
          setTeams(allTeams.flat());
        }
      }
    } catch (e) {
      if (!isSilent) addToast('Failed to load data', 'error');
    } finally {
      if (!isSilent) setDataLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleCancelRegistration = async (registrationId: string) => {
    if (!window.confirm('Are you sure you want to cancel your registration for this event?')) return;

    try {
      const success = await deleteRegistration(registrationId);
      if (success) {
        addToast('Registration cancelled successfully', 'success');
        loadData(true);
      } else {
        addToast('Failed to cancel registration', 'error');
      }
    } catch (error) {
      console.error('Cancellation error:', error);
      addToast('An error occurred during cancellation', 'error');
    }
  };

  useEffect(() => {
    const fetchMessages = async (isSilent = false) => {
      if (selectedEventForDetails) {
        if (!isSilent) setIsMessagesLoading(true);
        const msgs = await getMessages(selectedEventForDetails.id);
        setMessages(msgs);
        if (!isSilent) setIsMessagesLoading(false);
      } else {
        setMessages([]);
      }
    };

    fetchMessages();
    const interval = setInterval(() => fetchMessages(true), 5000);
    return () => clearInterval(interval);
  }, [selectedEventForDetails]);

  // Fetch Reviews when Event Details Open
  useEffect(() => {
    const fetchReviewsData = async (isSilent = false) => {
      if (selectedEventForDetails) {
        if (!isSilent) setIsReviewsLoading(true);
        try {
          const data = await getReviews(selectedEventForDetails.id);
          setReviews(data);
        } catch (e) {
          console.error("Failed to fetch reviews", e);
        } finally {
          if (!isSilent) setIsReviewsLoading(false);
        }
      } else {
        setReviews([]);
        setRating(5);
        setReviewComment('');
      }
    };

    fetchReviewsData();
  }, [selectedEventForDetails]);

  // Hydrate Event Details (Fetch full data if missing logic from list view optimization)
  useEffect(() => {
    const hydrateEvent = async () => {
      if (selectedEventForDetails) {
        // If description is empty or image is empty (and we expect them usually), fetch full
        // Note: Some events might legitimately have no image, but our list view forces it to empty string.
        // We can check a flag or just always fetch if we are in Mongo mode.
        // For simplicity, let's always fetch fresh details to ensure up-to-date data too.
        try {
          // Optimization: Fetch details WITHOUT massive image first to unlock UI speed.
          // The LazyEventImage component will fetch the image in parallel.
          const fullEvent = await getEventById(selectedEventForDetails.id, { excludeImage: true });

          if (fullEvent) {
            // Merge the fetched details (text) with the existing state (which might have empty image)
            // We preserved the 'imageUrl' from list view (empty) or if we had it cached.
            // But getEventById(excludeImage: true) returns null/undefined for imageUrl.

            // If we really want to update the state, we should check if description is missing.
            if (fullEvent.description.length > selectedEventForDetails.description.length) {
              // Keep existing image URL if we have one (though usually empty from list)
              // The LazyEventImage will handle the fetch.
              setSelectedEventForDetails(prev => prev ? { ...fullEvent, imageUrl: prev.imageUrl } : fullEvent);
            }
          }
        } catch (e) {
          console.error("Failed to hydrate event", e);
        }
      }

    };
    hydrateEvent();
  }, [selectedEventForDetails?.id]); // Only run if ID changes

  // Fallback: Fetch missing team details if viewing registration
  useEffect(() => {
    const fetchMissingTeam = async () => {
      if (selectedRegistrationDetails?.participationType === 'team' && selectedRegistrationDetails.teamId) {
        const isTeamLoaded = teams.some(t => t.id === selectedRegistrationDetails.teamId);

        if (!isTeamLoaded) {
          try {
            const team = await getTeamById(selectedRegistrationDetails.teamId);
            if (team) {
              setTeams(prev => {
                if (prev.some(t => t.id === team.id)) return prev;
                return [...prev, team];
              });
            }
          } catch (e) {
            console.error("Failed to fetch missing team details", e);
          }
        }
      }
    };

    fetchMissingTeam();
  }, [selectedRegistrationDetails, teams]);

  // Event Reminders Polling
  useEffect(() => {
    const checkReminders = async () => {
      if (!currentUser || registrations.length === 0 || events.length === 0) return;

      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

      const myApprovedRegs = registrations.filter(r =>
        r.participantId === currentUser.id &&
        r.status === RegistrationStatus.APPROVED
      );

      for (const reg of myApprovedRegs) {
        const event = events.find(e => e.id === reg.eventId);
        if (!event) continue;

        const eventDate = new Date(event.date);

        // Reminder Logic: Starts within 1 hour, hasn't started yet
        if (eventDate > now && eventDate <= oneHourLater) {
          const reminderKey = `reminder_1h_${event.id}_${currentUser.id}`;
          const alreadySent = localStorage.getItem(reminderKey);

          if (!alreadySent) {
            await addNotification({
              userId: currentUser.id,
              title: 'Upcoming Event',
              message: `"${event.title}" is starting in less than an hour!`,
              type: 'info',
              link: 'my-tickets',
              eventId: event.id,
            });

            localStorage.setItem(reminderKey, 'true');
            // Refresh notifs visually
            loadData(true);
            addToast(`Reminder: "${event.title}" starts soon!`, 'info');
          }
        }
      }
    };

    const timer = setInterval(checkReminders, 60000); // Check every minute
    checkReminders(); // Initial check

    return () => clearInterval(timer);
  }, [currentUser, registrations, events]);

  // Recommendations Logic
  const [recommendedEvents, setRecommendedEvents] = useState<AppEvent[]>([]);
  const [areRecommendationsLoading, setAreRecommendationsLoading] = useState(false);
  const [isAiUnavailable, setIsAiUnavailable] = useState(false);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!currentUser || currentUser.role !== 'attendee' || events.length === 0 || registrations.length === 0 || isAiUnavailable) return;

      // Avoid refetching if we already have them to save tokens, unless forced (not implemented here)
      if (recommendedEvents.length > 0) return;

      setAreRecommendationsLoading(true);
      try {
        const myRegs = registrations.filter(r => r.participantEmail === currentUser.email);
        if (myRegs.length === 0) {
          setAreRecommendationsLoading(false);
          return;
        }

        // Prepare Past Events Data
        const pastEvents = myRegs.map(r => {
          const e = events.find(ev => ev.id === r.eventId);
          return e ? { title: e.title, description: e.description, type: e.locationType || 'offline' } : null;
        }).filter(Boolean) as { title: string; description: string; type: string }[];

        // Prepare Upcoming Events Data
        const upcoming = events.filter(e =>
          !myRegs.some(r => r.eventId === e.id) &&
          new Date(e.date) > new Date()
        ).map(e => ({
          id: e.id,
          title: e.title,
          description: e.description,
          date: e.date,
          type: e.locationType || 'offline'
        }));

        if (upcoming.length < 1) {
          setAreRecommendationsLoading(false);
          return;
        }

        const recIds = await getEventRecommendations(pastEvents, upcoming);
        const recs = events.filter(e => recIds.includes(e.id));
        setRecommendedEvents(recs);
      } catch (e: any) {
        console.error("Gemini Recommendation Error:", e);
        // Disable AI if API key is invalid or quota exceeded
        if (JSON.stringify(e).includes('400') || JSON.stringify(e).includes('API key')) {
          setIsAiUnavailable(true);
          // Optional: silently fail or toast once
        }
      } finally {
        setAreRecommendationsLoading(false);
      }
    };

    fetchRecommendations();
  }, [currentUser, events, registrations, isAiUnavailable, recommendedEvents.length]);



  // Review State & Logic
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);

  useEffect(() => {
    const fetchReviews = async () => {
      if (selectedEventForDetails && detailsTab === 'reviews') {
        setIsReviewsLoading(true);
        const data = await getReviews(selectedEventForDetails.id);
        setReviews(data);
        setIsReviewsLoading(false);
      }
    };
    fetchReviews();
  }, [selectedEventForDetails, detailsTab]);

  // Autofill Name in Custom Questions
  useEffect(() => {
    if (selectedEventForReg && currentUser && selectedEventForReg.customQuestions) {
      const initialAnswers: Record<string, string> = {};
      let hasUpdates = false;

      selectedEventForReg.customQuestions.forEach(q => {
        const questionLower = q.question.toLowerCase();
        // Check triggers: "name" or "full name"
        // Exclude "team name" to avoid false positives for team info
        if (
          (questionLower.includes('name') || questionLower.includes('full name')) &&
          !questionLower.includes('team')
        ) {
          initialAnswers[q.id] = currentUser.name;
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        setRegistrationAnswers(prev => ({ ...prev, ...initialAnswers }));
      }
    }
  }, [selectedEventForReg?.id, currentUser?.id]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForDetails || !currentUser) return;

    if (reviewComment.trim().length < 5) {
      addToast('Review must be at least 5 characters', 'error');
      return;
    }

    const reviewData = {
      eventId: selectedEventForDetails.id,
      userId: currentUser.id,
      userName: currentUser.name,
      rating: rating,
      comment: reviewComment.trim()
    };

    await addReview(reviewData);
    setReviewComment('');
    setRating(5);
    addToast('Review submitted successfully!', 'success');

    // Refresh reviews
    const data = await getReviews(selectedEventForDetails.id);
    setReviews(data);
  };

  // Scroll Management for Details Modal
  useEffect(() => {
    if (scrollContainerRef.current) {
      if (detailsTab === 'discussion') {
        // Scroll to bottom for chat
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
        }, 0);
      } else {
        // Scroll to top for info/reviews
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [detailsTab]);

  // Auto-scroll chat on new messages
  useEffect(() => {
    if (detailsTab === 'discussion' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isMessagesLoading, detailsTab]);

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // --- Auth Handlers ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const user = await loginUser(authForm.email, authForm.password);
    setAuthLoading(false);

    if (user) {
      setCurrentUser(user);
      if (user.role === 'organizer') setActiveTab('organizer');
      else setActiveTab('browse');
      addToast(`Welcome back, ${user.name} !`, 'success');
    } else {
      addToast('Invalid email or password', 'error');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    const newUser = await registerUser({
      name: authForm.name,
      email: authForm.email,
      role: authForm.role
    }, authForm.password);

    setAuthLoading(false);

    if (newUser) {
      setCurrentUser(newUser);
      if (newUser.role === 'organizer') setActiveTab('organizer');
      else setActiveTab('browse');
      addToast('Account created successfully!', 'success');
    } else {
      addToast('Registration failed. Email might be in use.', 'error');
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null); // Ensure immediate local state clear
    setAuthForm({ name: '', email: '', password: '', role: 'attendee' });
    addToast('Logged out successfully', 'info');
  };

  // --- App Handlers ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, purpose: 'event' | 'profile' = 'event') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        addToast('Image size should be less than 5MB', 'error');
        return;
      }

      setCropPurpose(purpose);

      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImageSrc(reader.result as string);
        setIsCropperOpen(true);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropConfirm = async () => {
    if (!tempImageSrc || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(tempImageSrc, croppedAreaPixels);
      if (cropPurpose === 'event') {
        setNewEvent(prev => ({ ...prev, imageUrl: croppedImage }));
      } else {
        setProfileForm(prev => ({ ...prev, avatarUrl: croppedImage }));
        // If we want immediate feedback on the user object (optional, but form state is enough for preview)
      }
      setIsCropperOpen(false);
      setTempImageSrc(null);
    } catch (e) {
      console.error(e);
      addToast('Failed to crop image', 'error');
    }
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const resetEventForm = () => {
    setNewEvent({
      title: '', date: '', endDate: '', location: '', locationType: 'offline', description: '', capacity: '', imageUrl: '', customQuestions: [], collaboratorEmails: [],
      participationMode: 'individual', maxTeamSize: '5',
      isPaid: false, price: '', promoCodes: []
    });
    setIsEditMode(false);
    setEditingEventId(null);
  };

  const handleEditClick = async (event: AppEvent) => {
    // 1. Fetch text details first (Fast)
    addToast('Loading event details...', 'info');
    const fullEvent = await getEventById(event.id, { excludeImage: true });

    if (!fullEvent) {
      addToast('Failed to load full event data', 'error');
      return;
    }

    // Format date for datetime-local input (YYYY-MM-DDThh:mm)
    const d = new Date(fullEvent.date);
    const ed = fullEvent.endDate ? new Date(fullEvent.endDate) : new Date(new Date(fullEvent.date).getTime() + 3600000); // Default +1hr if missing
    const pad = (n: number) => n < 10 ? '0' + n : n;
    const dateStr = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    const endDateStr = ed.getFullYear() + '-' + pad(ed.getMonth() + 1) + '-' + pad(ed.getDate()) + 'T' + pad(ed.getHours()) + ':' + pad(ed.getMinutes());

    // 2. Open Modal Immediately with what we have (Image might be empty initially)
    setNewEvent({
      title: fullEvent.title,
      date: dateStr,
      endDate: endDateStr,
      location: fullEvent.location,
      locationType: fullEvent.locationType || 'offline',
      description: fullEvent.description,
      capacity: fullEvent.capacity.toString(),
      imageUrl: fullEvent.imageUrl || '', // Likely empty string here if excluded
      customQuestions: fullEvent.customQuestions || [],
      collaboratorEmails: fullEvent.collaboratorEmails || [],
      participationMode: fullEvent.participationMode || 'individual',
      maxTeamSize: fullEvent.maxTeamSize?.toString() || '',
      isPaid: Boolean(fullEvent.isPaid),
      price: fullEvent.price?.toString() || '',
      promoCodes: fullEvent.promoCodes || []
    });
    setEditingEventId(fullEvent.id);
    setIsEditMode(true);
    setIsCreateModalOpen(true);

    // 3. Fetch Image in Background (Slow part)
    // We only fetch if we didn't get it (which we intentionally didn't)
    try {
      const imageStr = await getEventImage(fullEvent.id);
      if (imageStr) {
        setNewEvent(prev => ({ ...prev, imageUrl: imageStr }));
      }
    } catch (e) {
      console.error("Background image fetch failed", e);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date || !currentUser || !newEvent.capacity) return;

    try {
      const evtDataCommon = {
        title: newEvent.title,
        date: newEvent.date,
        endDate: newEvent.endDate,
        location: newEvent.location,
        locationType: newEvent.locationType,
        description: newEvent.description,
        capacity: parseInt(newEvent.capacity) || 0,
        imageUrl: newEvent.imageUrl || `https://picsum.photos/800/400?random=${Math.floor(Math.random() * 100)}`,
        customQuestions: newEvent.customQuestions || [],
        collaboratorEmails: newEvent.collaboratorEmails || [],
        organizerId: currentUser.id,
        isRegistrationOpen: true,
        participationMode: newEvent.participationMode,
        maxTeamSize: parseInt(newEvent.maxTeamSize) || 0,
        isPaid: newEvent.isPaid,
        price: newEvent.isPaid ? parseFloat(newEvent.price) : 0,
        promoCodes: newEvent.promoCodes
      };

      if (new Date(evtDataCommon.endDate) <= new Date(evtDataCommon.date)) {
        addToast('End date must be after start date', 'error');
        return;
      }

      let success = false;

      if (isEditMode && editingEventId) {
        success = await updateEvent({ id: editingEventId, ...evtDataCommon });
        if (success) addToast('Event updated successfully', 'success');
      } else {
        const created = await saveEvent(evtDataCommon);
        success = !!created;
        if (success) addToast('Event created successfully', 'success');
      }

      if (success) {
        await loadData();
        setIsCreateModalOpen(false);
        resetEventForm();
      }
    } catch (err: any) {
      console.error('Event save failed:', err);
      addToast(err.message || (isEditMode ? 'Failed to update event' : 'Failed to create event'), 'error');
    }
  };

  const handleGenerateDescription = async () => {
    if (!newEvent.title || !newEvent.date) {
      addToast('Please enter a title and date first', 'error');
      return;
    }
    setIsGeneratingAI(true);
    const result = await generateEventDescription(newEvent.title, newEvent.date, newEvent.location);
    if (result && !result.startsWith('Error:')) {
      setNewEvent(prev => ({ ...prev, description: result }));
      addToast('Description generated!', 'success');
    } else {
      addToast(`AI Error: ${result?.replace('Error:', '').trim() || 'Service unavailable'}`, 'error');
    }
    setIsGeneratingAI(false);
  };

  const [isRegistering, setIsRegistering] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      addToast('Please enter your email', 'error');
      return;
    }

    setAuthLoading(true);
    const result = await resetUserPassword(resetEmail);
    setAuthLoading(false);

    if (result.success) {
      addToast(result.message, 'success');
      // If it's a success, go locally back to signin.
      if (!result.message.includes('DEMO MODE')) {
        setIsAuthMode('signin');
        setResetEmail('');
      }
    } else {
      addToast(result.message, 'error');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForReg || !currentUser || isRegistering) return;

    setIsRegistering(true);

    try {
      // Re-fetch event to check if status changed (e.g. organizer closed it while modal was open)
      const allEvents = await getEvents();
      const latestEvent = allEvents.find(e => e.id === selectedEventForReg.id);

      if (!latestEvent || latestEvent.isRegistrationOpen === false) {
        addToast('Registration is no longer open for this event', 'error');
        setSelectedEventForReg(null);
        setIsRegistering(false);
        return;
      }

      const now = new Date();
      if (now >= new Date(latestEvent.date)) {
        addToast('This event has already started or ended', 'error');
        setSelectedEventForReg(null);
        setIsRegistering(false);
        return;
      }

      // Use current user's email
      const email = currentUser.email;

      // Check existing
      const exists = registrations.find(r =>
        r.eventId === selectedEventForReg.id && r.participantEmail === email
      );

      if (exists) {
        addToast('You are already registered for this event', 'error');
        setIsRegistering(false);
        return;
      }

      // Check for required custom questions
      if (selectedEventForReg.customQuestions) {
        const missingRequired = selectedEventForReg.customQuestions.find(
          q => q.required && (!registrationAnswers[q.id] || registrationAnswers[q.id].trim() === '')
        );

        if (missingRequired) {
          addToast(`Please answer the required question: "${missingRequired.question}"`, 'error');
          setIsRegistering(false);
          return;
        }
      }

      const currentRegCount = registrations.filter(r =>
        r.eventId === selectedEventForReg.id &&
        (r.status === RegistrationStatus.APPROVED || r.status === RegistrationStatus.PENDING)
      ).length;

      const isCapacityFull = currentRegCount >= (selectedEventForReg.capacity as number);
      const initialStatus = isCapacityFull ? RegistrationStatus.WAITLISTED : RegistrationStatus.PENDING;

      let finalRegData: any = {
        eventId: selectedEventForReg.id,
        participantId: currentUser.id,
        participantName: currentUser.name,
        participantEmail: email,
        status: initialStatus,
        attendance: false,
        registeredAt: new Date().toISOString(),
        answers: registrationAnswers,
        participantAvatarUrl: currentUser.avatarUrl
      };

      // Payment Logic has been moved to after approval
      // Default to PENDING for all paid events unless waitlisted

      if (selectedEventForReg.isPaid || (selectedEventForReg.price && Number(selectedEventForReg.price) > 0)) {
        // Even if promo code makes it free, we might still want approval first?
        // For SIMPLICITY: Only full paying users need approval->payment flow.
        // If price becomes 0 due to promo code, maybe auto-approve?
        // Let's stick to: All paid events go to PENDING first.

        // We don't do anything special here, just ensure we don't trigger razorpay.
        // finalRegData.status is already set to initialStatus (PENDING or WAITLISTED)
      }

      if (teamRegistrationData.mode === 'team') {
        if (teamRegistrationData.subMode === 'create') {
          if (!teamRegistrationData.teamName.trim()) {
            addToast('Please enter a team name', 'error');
            setIsRegistering(false);
            return;
          }
          const team = await createTeam({
            name: teamRegistrationData.teamName,
            eventId: selectedEventForReg.id,
            leaderId: currentUser.id,
            members: [{ userId: currentUser.id, userName: currentUser.name, email: currentUser.email }],
            createdAt: new Date().toISOString(),
            inviteCode: '' // filled by service
          });
          if (team) {
            setTeams(prev => [...prev, team]);
            finalRegData.teamId = team.id;
            finalRegData.teamName = team.name;
            finalRegData.isTeamLeader = true;
            finalRegData.participationType = 'team';
            addToast(`Team "${team.name}" created! Invite Code: ${team.inviteCode}`, 'success');
          } else {
            throw new Error("Failed to create team");
          }
        } else {
          if (!teamRegistrationData.inviteCode.trim()) {
            addToast('Please enter an invite code', 'error');
            setIsRegistering(false);
            return;
          }
          const team = await getTeamByInviteCode(teamRegistrationData.inviteCode);
          if (!team) {
            addToast("Invalid invite code", "error");
            setIsRegistering(false);
            return;
          }
          if (team.eventId !== selectedEventForReg.id) {
            addToast("This invite code is for a different event", "error");
            setIsRegistering(false);
            return;
          }
          if (team.members.length >= (selectedEventForReg.maxTeamSize || 99)) {
            addToast("Team is already full", "error");
            setIsRegistering(false);
            return;
          }
          await joinTeam(team.id, { userId: currentUser.id, userName: currentUser.name, email: currentUser.email });
          finalRegData.teamId = team.id;
          finalRegData.teamName = team.name;
          finalRegData.isTeamLeader = false;
          finalRegData.participationType = 'team';
        }
      } else {
        finalRegData.participationType = 'individual';
      }

      const created = await addRegistration(finalRegData);

      if (created) {
        await loadData();
        setSelectedEventForReg(null);
        setRegistrationAnswers({});
        setAppliedPromoCode(null);
        setTeamRegistrationData({ mode: 'individual', subMode: 'create', teamName: '', inviteCode: '' });

        if (created.status === RegistrationStatus.WAITLISTED) {
          addToast('Event is full. You have been added to the waitlist.', 'info');
        } else if (selectedEventForReg.isPaid || (selectedEventForReg.price && Number(selectedEventForReg.price) > 0)) {
          addToast('Registration submitted! Please wait for organizer approval to proceed with payment.', 'success');
        } else {
          addToast(teamRegistrationData.mode === 'team' ? 'Team registration submitted!' : 'Registration submitted! Waiting for approval.', 'success');
        }
      } else {
        addToast('Registration failed or event is closed', 'error');
      }
    } catch (error: any) {
      console.error("Registration Error:", error);
      addToast(`Error: ${error.message || 'An error occurred during registration'}`, 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleStatusUpdate = async (regId: string, status: RegistrationStatus) => {
    // Check if this is a paid event and we are trying to approve it without payment
    const reg = registrations.find(r => r.id === regId);
    const event = events.find(e => e.id === reg?.eventId);

    let finalStatus = status;
    const isPaidEvent = event && (event.isPaid || (event.price && Number(event.price) > 0));

    if (status === RegistrationStatus.APPROVED && isPaidEvent) {
      // If event is paid, check if payment is already done (which shouldn't happen in this flow usually, but safe to check)
      // If payment pending, set to AWAITING_PAYMENT instead
      // Note: We need to check if paymentDetails exists and is COMPLETED.
      const isPaid = reg?.paymentDetails?.status === PaymentStatus.COMPLETED;
      if (!isPaid) {
        finalStatus = RegistrationStatus.AWAITING_PAYMENT;
      }
    }

    // 1. Update Database
    await updateRegistrationStatus(regId, finalStatus);

    // 2. Send Notification
    if (reg && event) {
      addToast(`Updating status and notifying user...`, 'info');

      // Determine message based on FINAL status
      let title = 'Registration Update';
      let message = `Your registration status for "${event.title}" has been updated to ${finalStatus}.`;
      let type: 'info' | 'success' | 'warning' = 'info';

      if (finalStatus === RegistrationStatus.APPROVED) {
        title = 'Registration Approved!';
        message = `You're in! Your registration for "${event.title}" was approved.`;
        type = 'success';
      } else if (finalStatus === RegistrationStatus.AWAITING_PAYMENT) {
        title = 'Action Required: Payment';
        message = `Your registration for "${event.title}" is tentatively approved. Please proceed to payment to confirm your spot.`;
        type = 'warning';
      }

      await sendStatusUpdateEmail(reg.participantEmail, reg.participantName, event.title, finalStatus);

      // Add In-App Notification
      await addNotification({
        userId: reg.participantId,
        title: title,
        message: message,
        type: type,
        link: 'my-tickets'
      });
    }

    // 3. Refresh Data
    await loadData();
    addToast(`Participant status updated to ${finalStatus}`, 'success');
  };

  const handleLatePayment = (reg: Registration, event: AppEvent) => {
    setSelectedRegForPayment({ reg, event });
    // Reset payment promo state
    setPaymentPromoCode('');
    setPaymentAppliedPromo(null);
    setPaymentPromoMessage(null);
    setIsPaymentModalOpen(true);
  };

  const handleProceedToPayment = async () => {
    if (!selectedRegForPayment) return;
    const { reg, event } = selectedRegForPayment;

    // Calculate Final Amount
    let amount = Number(event.price || 0);

    if (paymentAppliedPromo) {
      if (paymentAppliedPromo.type === 'percentage') {
        amount = amount - ((amount * paymentAppliedPromo.value) / 100);
      } else {
        amount = amount - paymentAppliedPromo.value;
      }
      amount = Math.max(0, amount);
    }

    if (amount <= 0) {
      // Free due to promo?
      await updateRegistrationStatus(reg.id, RegistrationStatus.APPROVED);
      addToast("Promo code covered entire cost! Ticket confirmed.", "success");
      await loadData();
      setIsPaymentModalOpen(false);
      return;
    }

    try {
      const loaded = await loadRazorpay();
      if (!loaded) {
        addToast('Razorpay SDK failed to load', 'error');
        return;
      }

      // Create Order
      const orderRes = await fetch('/api/create-payment-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          currency: 'INR',
          receipt: `rcpt_late_${Date.now()}`,
          notes: {
            eventId: event.id,
            userId: currentUser?.id,
            registrationId: reg.id,
            promoCode: paymentAppliedPromo?.code
          }
        })
      });

      const orderData = await orderRes.json();
      if (!orderData.success) {
        addToast('Payment order creation failed', 'error');
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_YourKeyIdPlaceholder',
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: event.title,
        description: 'Event Ticket Confirmation',
        image: event.imageUrl,
        order_id: orderData.order.id,
        handler: async function (response: any) {
          // Success
          await updateRegistrationStatus(reg.id, RegistrationStatus.APPROVED, {
            paymentDetails: {
              status: PaymentStatus.COMPLETED,
              amount: amount,
              currency: 'INR',
              transactionId: response.razorpay_payment_id || response.razorpay_order_id,
              orderId: response.razorpay_order_id,
              promocodeApplied: paymentAppliedPromo?.code
            }
          });
          addToast("Payment successful! Ticket confirmed.", "success");
          loadData();
          setIsPaymentModalOpen(false);
        },
        prefill: {
          name: currentUser?.name || reg.participantName,
          email: currentUser?.email || reg.participantEmail,
          contact: currentUser?.phoneNumber
        },
        theme: {
          color: '#ea580c'
        },
        modal: {
          ondismiss: function () {
            addToast('Payment cancelled', 'warning');
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();

    } catch (e: any) {
      console.error("Payment Error", e);
      addToast(`Payment Error: ${e.message}`, 'error');
    }
  };

  const handleSendReminders = async (event: AppEvent) => {
    if (!confirm(`Send email reminders to all approved attendees for "${event.title}"?`)) return;

    setIsSendingReminders(true);

    const approvedRegs = registrations.filter(
      r => r.eventId === event.id && r.status === RegistrationStatus.APPROVED
    );

    if (approvedRegs.length === 0) {
      addToast('No approved attendees to notify.', 'info');
      setIsSendingReminders(false);
      return;
    }

    let count = 0;
    // Send in parallel (or sequential if avoiding rate limits, but parallel is fine for simulation)
    await Promise.all(approvedRegs.map(async (reg) => {
      await sendReminderEmail(
        reg.participantEmail,
        reg.participantName,
        event.title,
        event.date,
        event.location
      );
      count++;
    }));

    setIsSendingReminders(false);
    addToast(`Sent reminders to ${count} attendees.`, 'success');
  };

  const handleBroadcastAnnouncement = async () => {
    if (!organizerSelectedEventId || !announcementText.trim()) {
      addToast('Please enter a message to broadcast.', 'error');
      return;
    }
    const event = events.find(e => e.id === organizerSelectedEventId);
    if (!event) return;

    setIsBroadcasting(true);
    try {
      const approvedParticipants = registrations.filter(r =>
        r.eventId === event.id &&
        r.status === RegistrationStatus.APPROVED
      );

      if (approvedParticipants.length === 0) {
        addToast('No approved participants to notify.', 'info');
        return;
      }

      await Promise.all(approvedParticipants.map(participant =>
        addNotification({
          userId: participant.participantId,
          title: `Announcement: ${event.title}`,
          message: announcementText.trim(),
          type: 'info',
          link: 'my-tickets'
        })
      ));

      addToast(`Announcement broadcasted to ${approvedParticipants.length} participants!`, 'success');
      setAnnouncementText('');
      setIsAnnouncementModalOpen(false);
    } catch (e) {
      console.error(e);
      addToast('Failed to broadcast announcement.', 'error');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleExportCSV = (event: AppEvent) => {
    const eventRegs = registrations.filter(r => r.eventId === event.id);
    if (eventRegs.length === 0) {
      addToast('No participants to export.', 'info');
      return;
    }

    // Header
    const headers = ['Participant Name', 'Email', 'Status', 'Attendance', 'Attendance Time', 'Registered At'];

    // Add custom questions to headers
    const customQuestions = event.customQuestions || [];
    customQuestions.forEach(q => headers.push(q.question));

    const csvRows = [headers.join(',')];

    eventRegs.forEach(reg => {
      const row = [
        `"${reg.participantName.replace(/"/g, '""')}"`,
        `"${reg.participantEmail.replace(/"/g, '""')}"`,
        `"${reg.status}"`,
        `"${reg.attended ? 'Present' : 'Absent'}"`,
        `"${reg.attendanceTime ? format(new Date(reg.attendanceTime), 'yyyy-MM-dd HH:mm:ss') : '-'}"`,
        `"${format(new Date(reg.registeredAt), 'yyyy-MM-dd HH:mm:ss')}"`
      ];

      // Add answers for custom questions
      customQuestions.forEach(q => {
        const answer = reg.answers ? reg.answers[q.id] || '' : '';
        row.push(`"${String(answer).replace(/"/g, '""')}"`);
      });

      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}_participants.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('CSV exported successfully', 'success');
  };

  const [newMessageText, setNewMessageText] = useState('');
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForDetails || !currentUser || !newMessageText.trim()) return;

    const messageData = {
      eventId: selectedEventForDetails.id,
      userId: currentUser.id,
      userName: currentUser.name,
      content: newMessageText.trim()
    };

    await addMessage(messageData);
    setNewMessageText('');
    const msgs = await getMessages(selectedEventForDetails.id);
    setMessages(msgs);

    // Send notifications to OTHER participants
    const otherParticipants = registrations.filter(r =>
      r.eventId === selectedEventForDetails.id &&
      r.participantId !== currentUser.id &&
      r.status === RegistrationStatus.APPROVED
    );

    // Avoid blocking UI for notifications
    Promise.all(otherParticipants.map(participant =>
      addNotification({
        userId: participant.participantId,
        title: `New message in "${selectedEventForDetails.title}"`,
        message: `${currentUser.name} says: ${newMessageText.trim().substring(0, 50)}${newMessageText.trim().length > 50 ? '...' : ''}`,
        type: 'info',
        link: 'browse' // Or specific link to discussion if supported
      })
    ));
  };

  const handleManualAttendance = async (regId: string) => {
    // Security Check: Verify Organizer Ownership or Collaborative Rights
    const reg = registrations.find(r => r.id === regId);
    if (reg) {
      const event = events.find(e => e.id === reg.eventId);
      if (event) {
        const isOrganizer = currentUser?.role === 'organizer' && event.organizerId === currentUser?.id;
        const isCollaborator = event.collaboratorEmails?.includes(currentUser?.email || '');

        if (!isOrganizer && !isCollaborator) {
          addToast('Permission Denied: Only the event organizer or co-organizers can mark attendance.', 'error');
          return;
        }
      }
    }

    if (!confirm('Mark this participant as present?')) return;

    const success = await markAttendance(regId);

    if (success) {
      addToast('Attendance marked manually', 'success');
      await loadData();
    } else {
      addToast('Failed to mark attendance. Ensure participant is approved.', 'error');
    }
  };

  const handleScan = async (data: string) => {
    // Prevent multiple scans while processing or showing result
    if (scanResult) return;

    try {
      const payload = JSON.parse(data);
      if (!payload.id) throw new Error('Invalid QR Code');

      // Security Check: Verify Organizer Ownership or Collaborative Rights
      const reg = registrations.find(r => r.id === payload.id);
      if (!reg) {
        setScanResult({ type: 'error', message: 'Ticket not recognized' });
        setTimeout(() => setScanResult(null), 3000);
        return;
      }

      const event = events.find(e => e.id === reg.eventId);
      if (!event) {
        setScanResult({ type: 'error', message: 'Event not found' });
        setTimeout(() => setScanResult(null), 3000);
        return;
      }

      const isOrganizer = currentUser?.role === 'organizer' && event.organizerId === currentUser?.id;
      const isCollaborator = event.collaboratorEmails?.includes(currentUser?.email || '');

      if (!isOrganizer && !isCollaborator) {
        setScanResult({ type: 'error', message: 'Permission Denied' });
        setTimeout(() => setScanResult(null), 3000);
        return;
      }

      if (reg.status !== RegistrationStatus.APPROVED) {
        setScanResult({ type: 'error', message: 'Participant Pending/Rejected' });
        setTimeout(() => setScanResult(null), 3000);
        return;
      }

      if (reg.attended) {
        setScanResult({ type: 'error', message: 'Ticket Already Used' });
        setTimeout(() => setScanResult(null), 3000);
        return;
      }

      const success = await markAttendance(payload.id);

      if (success) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setScanResult({ type: 'success', message: `${reg.participantName} • ${timestamp}` });
        await loadData();
      } else {
        setScanResult({ type: 'error', message: 'Check-in Failed / Already Used' });
      }
    } catch (e) {
      setScanResult({ type: 'error', message: 'Invalid QR Format' });
    }

    // Auto-clear result to resume scanning
    setTimeout(() => setScanResult(null), 3000);
  };

  const downloadTicket = async () => {
    const element = document.getElementById('digital-ticket-card');
    if (!element) return;

    try {
      addToast("Preparing ticket...", "info");

      const canvas = await html2canvas(element, {
        backgroundColor: null,
        scale: 3,
        logging: false,
        useCORS: true,
      });

      const pngFile = canvas.toDataURL("image/png", 1.0);
      const downloadLink = document.createElement("a");
      downloadLink.download = `Eventron-Ticket-${selectedTicket?.id.slice(0, 8) || 'Pass'}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();

      addToast("Ticket saved to gallery!", "success");
    } catch (err) {
      console.error("Ticket download failed", err);
      addToast("Failed to save ticket", "error");
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phoneNumber) {
      addToast('Please enter a valid phone number', 'error');
      return;
    }

    setAuthLoading(true);
    try {
      const appVerifier = initRecaptcha('persistent-recaptcha-container');
      const confirmationResult = await signInWithPhone(phoneNumber, appVerifier);
      setConfirmationResult(confirmationResult);
      setOtpPurpose('login');
      setShowOtpInput(true);
      addToast('OTP Sent!', 'success');
    } catch (error) {
      console.error(error);
      addToast('Failed to send OTP. Try again.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otp) {
      addToast('Please enter the OTP', 'error');
      return;
    }

    setAuthLoading(true);
    try {
      const user = await verifyPhoneOtp(confirmationResult, otp);
      if (user) {
        setCurrentUser(user);
        addToast('Logged in successfully!', 'success');
        setAuthForm({ name: '', email: '', password: '', role: 'attendee' });
        setPhoneNumber('');
        setOtp('');
        setShowOtpInput(false);
        setLoginMethod('email');
      } else {
        addToast('Verification failed', 'error');
      }
    } catch (error) {
      console.error(error);
      addToast('Invalid OTP', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  // --- Views ---

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  const renderAuthModal = () => {
    if (!isAuthModalOpen && currentUser) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden bg-slate-950">
        {/* Galaxy Background */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-80 animate-galaxy"
          style={{ backgroundImage: "url('/galaxy.png')" }}
        ></div>

        <div className="absolute inset-0 z-0 bg-black/40"></div> {/* Overlay for contrast */}

        <div className="absolute inset-0 z-0">
          <Suspense fallback={null}>
            <ParticleBackground />
          </Suspense>
        </div>

        {/* Modal Container */}
        <div className="bg-zinc-950 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden w-full max-w-lg md:max-w-5xl flex flex-col md:flex-row border border-white/5 relative z-10 mx-4 md:mx-auto min-h-0 md:min-h-[600px] my-auto">


          {/* Left Panel - Hero/Promo */}
          <div className="hidden md:flex md:w-[45%] bg-gradient-to-br from-slate-900 to-zinc-900 relative p-8 flex-col items-center justify-center text-center overflow-hidden border-r border-white/5">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>

            {/* Decorative Cosmic Elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full animate-[spin_20s_linear_infinite]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] border border-white/5 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>

            {/* Floating Title */}
            <div className="relative z-10 mb-12">
              <h1 className="text-4xl font-black font-outfit text-slate-200 tracking-tight mb-2">Eventron</h1>
              <p className="text-slate-400 text-sm font-medium tracking-widest uppercase opacity-60">Premium Experiences</p>
            </div>

            {/* Floating Feature Cards (Mimicking Reference) */}
            <div className="relative w-full max-w-xs aspect-square">
              {/* Center Image/Icon */}


              {/* Orbital Cards */}
              <div className="absolute top-0 right-0 animate-bounce delay-700">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 text-slate-300 px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2 transform rotate-6">
                  <Sparkles className="w-4 h-4 text-orange-400/80" />
                  <span className="text-xs font-bold">AI Planner</span>
                </div>
              </div>

              <div className="absolute bottom-8 left-0 animate-bounce delay-1000">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 text-slate-300 px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2 transform -rotate-3">
                  <Ticket className="w-4 h-4 text-rose-400/80" />
                  <span className="text-xs font-bold">Instant Tix</span>
                </div>
              </div>

              <div className="absolute top-1/2 -right-8 animate-bounce delay-300">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 text-slate-300 px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2 transform rotate-2">
                  <QrCode className="w-4 h-4 text-indigo-400/80" />
                  <span className="text-xs font-bold">Smart Check-in</span>
                </div>
              </div>
            </div>

            <div className="mt-16 relative z-10 flex flex-col items-center">
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6"></div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">Host & Attend</p>
              <p className="text-transparent bg-clip-text bg-gradient-to-r from-slate-200 to-slate-400 text-sm font-medium">Join the community of 10,000+ organizers</p>
            </div>
          </div>

          {/* Right Panel - Auth Methods */}
          <div className="w-full md:w-[55%] p-8 md:p-12 bg-zinc-950 flex flex-col justify-center items-center relative">
            <div className="w-full max-w-sm">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 font-outfit">
                  {isAuthMode === 'signin' ? 'Welcome Back' : isAuthMode === 'forgot-password' ? 'Reset Password' : 'Welcome to Eventron'}
                </h2>
                <p className="text-zinc-500 text-sm">
                  {isAuthMode === 'signin' ? 'Access your dashboard using your preferred method.' : 'Enter your details to get started.'}
                </p>
              </div>

              {/* Social Login - TOP Priority (Like Reference) */}
              {isAuthMode !== 'forgot-password' && (
                <button
                  onClick={async () => {
                    setAuthLoading(true);
                    try {
                      const role = isAuthMode === 'signup' ? authForm.role : 'attendee';
                      const user = await loginWithGoogle(role);
                      if (user) {
                        setCurrentUser(user);
                        addToast('Welcome back!', 'success');
                      } else {
                        addToast('Google Sign In failed', 'error');
                      }
                    } catch (e) {
                      console.error(e);
                      addToast('Something went wrong', 'error');
                    } finally {
                      setAuthLoading(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-3 bg-white text-black py-3.5 rounded-full font-bold hover:bg-zinc-200 transition-all active:scale-[0.98] border border-zinc-200 shadow-sm mb-6"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                  <span>Continue with Google</span>
                </button>
              )}

              {/* Divider */}
              {isAuthMode !== 'forgot-password' && (
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
                    <span className="px-3 bg-zinc-950 text-zinc-600">Or continue with email/ phone</span>
                  </div>
                </div>
              )}

              {/* Main Form */}
              {isAuthMode === 'forgot-password' ? (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div className="group text-left">
                    <label htmlFor="reset-email" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Email Address</label>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      placeholder="name@example.com"
                      className="w-full px-5 py-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all placeholder:text-zinc-700"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3.5 rounded-full transition-all shadow-lg shadow-orange-900/20 mt-4"
                  >
                    {authLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Send Reset Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAuthMode('signin')}
                    className="w-full text-zinc-500 text-sm font-medium hover:text-white transition-colors py-2"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  {/* Email/Phone Toggle */}
                  {isAuthMode === 'signin' && (
                    <div className="flex p-1 bg-zinc-900 rounded-full border border-zinc-800 mb-6 relative">
                      <button
                        onClick={() => { setLoginMethod('email'); setShowOtpInput(false); }}
                        className={`flex-1 py-1.5 rounded-full text-xs font-bold uppercase transition-all relative z-10 ${loginMethod === 'email' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Email
                      </button>
                      <button
                        onClick={() => setLoginMethod('phone')}
                        className={`flex-1 py-1.5 rounded-full text-xs font-bold uppercase transition-all relative z-10 ${loginMethod === 'phone' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Phone
                      </button>
                      <div
                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-zinc-800 rounded-full transition-all duration-300 shadow-md ${loginMethod === 'phone' ? 'left-[50%]' : 'left-1'}`}
                      ></div>
                    </div>
                  )}

                  {isAuthMode === 'signup' && (
                    <div className="text-left">
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        className="w-full px-5 py-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all placeholder:text-zinc-700"
                        value={authForm.name}
                        onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                      />
                    </div>
                  )}

                  {(loginMethod === 'email' || isAuthMode === 'signup') ? (
                    <>
                      <div className="text-left">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Email</label>
                        <input
                          type="email"
                          required
                          placeholder="name@work.com"
                          className="w-full px-5 py-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all placeholder:text-zinc-700"
                          value={authForm.email}
                          onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                        />
                      </div>
                      <div className="text-left">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Password</label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          className="w-full px-5 py-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all placeholder:text-zinc-700"
                          value={authForm.password}
                          onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-left">
                      {!showOtpInput ? (
                        <>
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Phone Number</label>
                          <input
                            type="tel"
                            required
                            placeholder="+1 555 000 0000"
                            className="w-full px-5 py-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all placeholder:text-zinc-700"
                            value={phoneNumber}
                            onChange={e => setPhoneNumber(e.target.value)}
                          />
                        </>
                      ) : (
                        <>
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">One-Time Password</label>
                          <input
                            type="text"
                            required
                            placeholder="******"
                            className="w-full px-5 py-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all text-center tracking-[0.5em] font-bold text-lg"
                            value={otp}
                            onChange={e => setOtp(e.target.value)}
                          />
                        </>
                      )}
                    </div>
                  )}

                  {isAuthMode === 'signup' && (
                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => setAuthForm({ ...authForm, role: 'attendee' })}
                        className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${authForm.role === 'attendee' ? 'bg-orange-600/20 border-orange-600 text-orange-500' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                      >
                        Participant
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthForm({ ...authForm, role: 'organizer' })}
                        className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${authForm.role === 'organizer' ? 'bg-orange-600/20 border-orange-600 text-orange-500' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                      >
                        Organizer
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={(e) => {
                      if (isAuthMode === 'signup') {
                        handleSignup(e);
                      } else if (loginMethod === 'phone') {
                        showOtpInput ? handleVerifyOtp(e) : handleSendOtp(e);
                      } else {
                        handleLogin(e);
                      }
                    }}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3.5 rounded-full transition-all shadow-lg shadow-orange-900/20 mt-4 active:scale-[0.98]"
                  >
                    {authLoading ? 'Processing...' : (
                      isAuthMode === 'signup'
                        ? 'Sign Up'
                        : (loginMethod === 'phone'
                          ? (showOtpInput ? 'Verify & Login' : 'Send Code')
                          : 'Sign In')
                    )}
                  </button>
                </div>
              )}

              <div className="mt-8 text-center text-xs text-zinc-500">
                {isAuthMode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => setIsAuthMode(isAuthMode === 'signin' ? 'signup' : 'signin')}
                  className="font-bold text-orange-500 hover:text-orange-400"
                >
                  {isAuthMode === 'signin' ? 'Sign up' : 'Login'}
                </button>
              </div>

              <div className="mt-8 border-t border-zinc-900 pt-6">
                <p className="text-[10px] text-zinc-600 text-center leading-relaxed">
                  By signing in, you agree to our <span className="text-zinc-500 underline cursor-pointer">Terms of Service</span> and acknowledge our <span className="text-zinc-500 underline cursor-pointer">Privacy Policy</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div >
    );
  };

  // --- Authenticated Views ---

  const renderHeader = () => (
    <header className="fixed top-6 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 pointer-events-none">
      <div className="max-w-7xl mx-auto pointer-events-auto">
        <div className={`liquid-glass rounded-full border px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between shadow-2xl animate-in slide-in-from-top-4 duration-1000 transition-all ${isScrolled ? 'bg-white/[0.02] backdrop-blur-[12px] border-white/20 shadow-sm' : 'border-white/10 backdrop-blur-xl'}`}>
          <div className="flex items-center group cursor-pointer" onClick={() => setActiveTab('browse')}>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black font-outfit tracking-tighter text-refraction drop-shadow-lg">
                Eventron
              </span>
              <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] font-bold text-orange-400 -mt-0.5 sm:-mt-1 pl-0.5">Premium Events</span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5 relative">
            {[
              { id: 'browse', label: 'Explore' },
              { id: 'organizer', label: 'Dashboard', show: currentUser?.role === 'organizer' },
              { id: 'my-tickets', label: 'My Tickets', show: currentUser?.role === 'attendee' }
            ].filter(item => item.show !== false).map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={`relative px-6 py-2 rounded-xl text-sm font-black font-outfit transition-all duration-300 whitespace-nowrap z-10 ${activeTab === item.id ? 'text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <span className="relative z-10">{item.label}</span>
                {activeTab === item.id && (
                  <motion.div
                    layoutId="header-pill"
                    className="absolute inset-0 bg-orange-600 rounded-xl shadow-lg shadow-orange-600/30"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.6 }}
                  />
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-3 rounded-xl bg-white/5 text-slate-400 hover:text-orange-400 transition-all border border-white/5"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
            </button>

            <AnimatePresence>
              {isMobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-[88px] left-4 right-4 liquid-glass rounded-3xl border border-white/10 p-4 z-50 lg:hidden flex flex-col gap-2 shadow-2xl"
                >
                  {[
                    { id: 'browse', label: 'Explore', icon: Sparkles },
                    { id: 'organizer', label: 'Dashboard', show: currentUser?.role === 'organizer', icon: Layout },
                    { id: 'my-tickets', label: 'My Tickets', show: currentUser?.role === 'attendee', icon: QrCode }
                  ].filter(item => item.show !== false).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as Tab);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold font-outfit transition-all ${activeTab === item.id ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-orange-500'}`} />
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`p-3 rounded-xl transition-all relative ${isNotificationsOpen ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'bg-white/5 text-slate-400 hover:text-orange-400 hover:bg-white/10'}`}
              >
                <Bell className="w-5 h-5" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
                )}
              </button>

              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsNotificationsOpen(false)}></div>
                  <div className="absolute right-0 mt-4 w-80 xs:w-96 liquid-glass rounded-3xl shadow-2xl border border-white/10 py-0 z-20 animate-in fade-in zoom-in-95 origin-top-right overflow-hidden flex flex-col max-h-[500px]">
                    <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                      <h3 className="text-lg font-bold text-white font-outfit">Notifications</h3>
                      <span className="px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase tracking-wider border border-orange-500/20">{notifications.length} New</span>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                      {notifications.length > 0 ? (
                        notifications.slice(0, 10).map(notif => (
                          <div
                            key={notif.id}
                            onClick={async () => {
                              if (!notif.read) {
                                await markNotificationRead(notif.id);
                                loadData();
                              }
                              if (notif.eventId) {
                                const relatedEvent = events.find(e => e.id === notif.eventId);
                                if (relatedEvent) {
                                  setSelectedEventForDetails(relatedEvent);
                                  setIsNotificationsOpen(false);
                                  return;
                                }
                              }
                              if (notif.link) {
                                setActiveTab(notif.link as Tab);
                                setIsNotificationsOpen(false);
                              }
                            }}
                            className={`px-6 py-4 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-all relative group ${!notif.read ? 'bg-orange-500/5' : ''}`}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 shadow-sm ${notif.type === 'success' ? 'bg-emerald-400 shadow-emerald-500/50' : notif.type === 'warning' ? 'bg-amber-400 shadow-amber-500/50' : 'bg-orange-400 shadow-orange-500/50'} ${notif.read ? 'opacity-20' : ''}`}></div>
                              <div className="flex-1">
                                <p className={`text-sm ${notif.read ? 'text-slate-400' : 'text-white font-bold font-outfit'}`}>{notif.title}</p>
                                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{notif.message}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{format(new Date(notif.createdAt), 'MMM d, h:mm a')}</p>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-orange-400 group-hover:translate-x-1 transition-all mt-1" />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-20 text-center flex flex-col items-center">
                          <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                            <Bell className="w-8 h-8 text-slate-600" />
                          </div>
                          <p className="text-slate-400 text-sm font-medium">No notifications yet</p>
                          <p className="text-slate-500 text-xs mt-1">We'll alert you when something happens</p>
                        </div>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02]">
                        <button
                          onClick={async () => {
                            if (currentUser) {
                              // Optimistic update for instant UI feedback
                              setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                              setIsNotificationsOpen(false);

                              await markAllNotificationsRead(currentUser.id);
                              loadData(true); // Silent reload to sync ensure consistency
                            }
                          }}
                          className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-400 hover:text-orange-300 w-full text-center py-2 rounded-xl"
                        >
                          Dismiss All
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {currentUser ? (
              <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-black font-outfit text-white tracking-tight leading-none">{currentUser.name}</span>
                  <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mt-1 opacity-80">{currentUser.role}</span>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="w-11 h-11 bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-2xl flex items-center justify-center border border-white/10 hover:border-orange-500/50 transition-all group overflow-hidden"
                  >
                    {currentUser.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle className="w-7 h-7 text-slate-300 group-hover:text-white group-hover:scale-110 transition-all" />
                    )}
                  </button>

                  {isProfileMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setIsProfileMenuOpen(false)}
                      ></div>
                      <div className="absolute right-0 mt-4 w-64 liquid-glass rounded-3xl shadow-2xl border border-white/10 py-3 z-20 animate-in fade-in zoom-in-95 origin-top-right">
                        <div className="px-6 py-4 border-b border-white/5 md:hidden mb-2">
                          <p className="text-sm font-bold text-white font-outfit">{currentUser.name}</p>
                          <p className="text-xs text-slate-400 truncate opacity-60 tracking-tight">{currentUser.email}</p>
                        </div>
                        <div className="px-3 space-y-1">
                          <button
                            onClick={() => {
                              setProfileForm({
                                name: currentUser.name,
                                email: currentUser.email,
                                phoneNumber: currentUser.phoneNumber || '',
                                isPhoneVerified: !!currentUser.phoneNumber,
                                avatarUrl: currentUser.avatarUrl
                              });
                              setOtp('');
                              setOtpPurpose('profile');
                              setShowOtpInput(false);
                              setConfirmationResult(null);
                              setIsProfileModalOpen(true);
                              setIsProfileMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm font-bold font-outfit text-slate-300 hover:bg-orange-600 hover:text-white rounded-xl transition-all flex items-center gap-3 group"
                          >
                            <UserCircle className="w-5 h-5 text-orange-400 group-hover:text-white" /> Edit Profile
                          </button>
                          <button
                            onClick={() => {
                              handleLogout();
                              setIsProfileMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm font-bold font-outfit text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all flex items-center gap-3 group"
                          >
                            <LogOut className="w-5 h-5 group-hover:text-white" /> Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-5 sm:px-8 py-3 bg-orange-600 text-white rounded-2xl text-xs sm:text-sm font-black font-outfit hover:bg-orange-700 transition-all shadow-xl shadow-orange-600/30 active:scale-95 uppercase tracking-wider"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );

  const renderEvents = () => {
    const visibleEvents = currentUser?.role === 'organizer'
      ? events.filter(e => e.organizerId === currentUser.id)
      : events;

    const now = new Date();
    const upcomingEvents = visibleEvents
      .filter(e => !isPastEvent(e))
      .filter(e => !recommendedEvents.some(rec => rec.id === e.id))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const pastEvents = visibleEvents.filter(e => isPastEvent(e)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const renderEventCard = (event: AppEvent, index: number) => {
      const isPast = isPastEvent(event);
      const currentRegs = registrations.filter(r => r.eventId === event.id && r.status !== RegistrationStatus.REJECTED).length;
      const remainingSpots = Math.max(0, Number(event.capacity) - currentRegs);
      return (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className={`group glass-card rounded-[32px] overflow-hidden transition-all duration-500 flex flex-col h-full bg-[#0f172a]/40 border-orange-500/5 hover:border-orange-500/20 ${isPast ? 'opacity-50 grayscale' : ''}`}
        >
          <div className="relative h-56 overflow-hidden">
            <LazyEventImage eventId={event.id} initialSrc={event.imageUrl} alt={event.title} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className={`absolute top-4 right-4 backdrop-blur-md px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl z-10 ${event.locationType === 'online' ? 'bg-orange-600/90 text-white border border-orange-400/30' : 'bg-slate-900/90 text-white border border-white/10'}`}>
              {event.locationType === 'online' ? 'Online' : 'Offline'}
            </div>

            <div className={`absolute top-4 left-4 backdrop-blur-md px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl z-10 ${event.isPaid ? 'bg-orange-600/90 text-white border border-orange-400/30' : 'bg-green-600/90 text-white border border-green-400/30'}`}>
              {event.isPaid ? `₹${event.price}` : 'Free'}
            </div>

            <div className="absolute bottom-4 left-4 z-10 flex gap-2">
              <span className={`px-3 py-1 backdrop-blur-md rounded-lg text-[10px] font-bold border transition-colors ${remainingSpots === 0 ? 'bg-red-500/20 text-red-300 border-red-500/30' : remainingSpots <= 5 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-white/10 text-white border-white/10 group-hover:bg-orange-600/50'}`}>
                {remainingSpots === 0 ? 'Sold Out' : `${remainingSpots} Spots Left`}
              </span>
            </div>
          </div>

          <div className="p-8 flex-1 flex flex-col">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-6 bg-orange-500/5 w-fit px-4 py-1.5 rounded-full border border-orange-500/10">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              {format(new Date(event.date), 'MMMM d, yyyy')}
            </div>

            <h3
              onClick={() => setSelectedEventForDetails(event)}
              className="text-2xl font-black text-white mb-3 font-outfit decoration-orange-500/50 decoration-2 underline-offset-8 cursor-pointer group-hover:text-orange-300 group-hover:translate-x-1 transition-all"
            >
              {event.title}
            </h3>

            <div className="flex items-center gap-2 text-slate-400 text-xs mb-5 font-medium opacity-80">
              <MapPin className="w-4 h-4 text-orange-400" />
              {renderLocation(event.location, event.locationType, "truncate max-w-[200px]")}
            </div>

            <p className="text-slate-400 text-sm line-clamp-2 mb-8 flex-1 leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">{event.description}</p>

            {(!currentUser || currentUser.role === 'attendee') && (
              (() => {
                const isRegistered = currentUser ? registrations.some(r => r.eventId === event.id && r.participantEmail === currentUser.email) : false;
                const currentRegistrations = registrations.filter(r => r.eventId === event.id && r.status !== RegistrationStatus.REJECTED).length;
                const isFull = currentRegistrations >= event.capacity;
                const startDate = new Date(event.date);
                const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 3600000);

                const isLive = now >= startDate && now <= endDate;
                const isPastBadge = now > endDate;
                const isClosed = event.isRegistrationOpen === false || now >= startDate;

                return (
                  <div className="flex flex-col gap-4 mt-auto">
                    <div className="flex items-center justify-between">
                      {isLive && (
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-500 animate-pulse bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                          <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div>
                          Live Now
                        </div>
                      )}
                      {isFull && !isRegistered && !isPastBadge && (
                        <div className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                          Event Full
                        </div>
                      )}
                      {isPastBadge && (
                        <div className="text-[10px] font-black text-slate-500 bg-slate-500/10 border border-slate-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                          Inactive
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isRegistered ? (
                        <button
                          onClick={() => {
                            const reg = registrations.find(r => r.eventId === event.id && r.participantEmail === currentUser?.email);
                            if (reg) setSelectedRegistrationDetails(reg);
                          }}
                          className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold font-outfit py-3 rounded-2xl transition-all flex items-center justify-center gap-2 group/btn"
                        >
                          <CheckCircle className="w-5 h-5 text-orange-400 group-hover/btn:scale-110 transition-transform" />
                          View Registration
                        </button>
                      ) : (
                        currentUser ? (
                          <button
                            disabled={isFull || isClosed}
                            onClick={async () => {
                              const fullEvent = await getEventById(event.id, { excludeImage: true });
                              setSelectedEventForReg(fullEvent || event);
                            }}
                            className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold font-outfit py-3 rounded-2xl transition-all shadow-lg shadow-orange-600/20 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                          >
                            {isFull ? 'Waitlisted' : (isClosed ? 'Registration Closed' : 'Secure Your Spot')}
                          </button>
                        ) : (
                          <button
                            onClick={() => setIsAuthModalOpen(true)}
                            className="flex-1 bg-white/5 border border-white/10 hover:border-orange-500/50 hover:bg-orange-500/5 text-white font-bold font-outfit py-3 rounded-2xl transition-all flex items-center justify-center gap-2 group/btn"
                          >
                            Sign In to Register
                            <ChevronRight className="w-4 h-4 text-orange-400 group-hover/btn:translate-x-1 transition-transform" />
                          </button>
                        )
                      )}

                      <button
                        onClick={() => setSelectedEventForDetails(event)}
                        className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all"
                        title="View Details"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })()
            )}

            {currentUser?.role === 'organizer' && (
              <div className="mt-auto pt-6 border-t border-white/5 flex gap-2">
                <button
                  onClick={() => {
                    setOrganizerSelectedEventId(event.id);
                    setOrganizerView('events');
                    setActiveTab('organizer');
                  }}
                  className="flex-1 bg-orange-600/10 text-orange-400 font-bold font-outfit py-3 rounded-2xl border border-orange-500/20 hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                >
                  Manage
                </button>
                <button
                  onClick={() => setSelectedEventForDetails(event)}
                  className="px-4 bg-white/5 text-slate-400 rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
                >
                  <Edit className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      );
    };

    return (
      <div className="animate-in fade-in duration-700">
        {/* Modern Premium Hero Section */}
        {activeTab === 'browse' && !currentUser && (
          <div className="relative overflow-hidden mb-8 sm:mb-16 pt-32 pb-20 md:pt-40 md:pb-32 transition-all">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-600/20 blur-[150px] rounded-full pointer-events-none -z-10 animate-pulse"></div>

            <div className="max-w-5xl mx-auto text-center px-6 relative z-10">
              <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full liquid-glass text-orange-300 border-orange-500/20 text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] mb-10 animate-float shadow-[0_0_30px_rgba(234,88,12,0.2)]">
                <Sparkles className="w-3.5 h-3.5" />
                Experience the Extraordinary
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-8xl font-black font-outfit text-white mb-10 tracking-tighter leading-[1] md:leading-[0.9] drop-shadow-2xl">
                Where Every Moment <br className="hidden sm:block" />
                <span className="text-refraction relative inline-block">
                  Becomes a Legacy
                  <svg className="absolute w-full h-3 -bottom-1 left-0 text-orange-500 opacity-50" viewBox="0 0 200 9" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.00025 6.99997C25.7509 9.37523 78.9113 9.00003 160.004 2.00001" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                </span>
              </h1>

              <p className="text-lg sm:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed font-medium drop-shadow-md">
                Connect with the world's most exclusive tech, design, and cultural events. Your next core memory is just a click away.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="w-full sm:w-auto px-12 py-5 button-glow text-white rounded-[24px] text-sm md:text-lg font-black font-outfit uppercase tracking-[0.15em] hover:scale-105 active:scale-95 transition-all"
                >
                  Start Your Journey
                </button>
                <div className="flex items-center gap-3 text-slate-400 font-bold text-xs sm:text-sm bg-white/5 px-6 py-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => <div key={i} className={`w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-700/50`}></div>)}
                  </div>
                  Join 10,000+ members
                </div>
              </div>
            </div>
          </div>
        )}



        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 ${!currentUser ? '' : 'pt-32'}`}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-12">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em]">Satellite Feed</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black font-outfit text-white tracking-tight">
                {currentUser?.role === 'organizer' ? 'Hosted Nexus' : 'Upcoming Experiences'}
              </h2>
            </div>


          </div>

          {!dataLoading && upcomingEvents.length === 0 ? (
            <div className="text-center py-32 glass-card rounded-[40px] border-dashed border-2 border-white/5">
              <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-12 h-12 text-orange-500 opacity-50" />
              </div>
              <h3 className="text-2xl font-black font-outfit text-white mb-2">No upcoming events yet</h3>
              <p className="text-slate-400 max-w-xs mx-auto mb-8">Stay tuned! We're preparing incredible experiences for you.</p>
              {currentUser?.role === 'organizer' && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="button-glow text-white px-10 py-5 rounded-[24px] font-black font-outfit transition-all uppercase tracking-widest active:scale-95"
                >
                  Create Your First Event
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
              {dataLoading ? (
                Array(6).fill(0).map((_, i) => <EventCardSkeleton key={i} />)
              ) : (
                upcomingEvents.map((event, idx) => renderEventCard(event, idx))
              )}
            </div>
          )}
          {/* AI-Powered Recommendations Section */}
          {currentUser && currentUser.role === 'attendee' && !isAiUnavailable && (recommendedEvents.length > 0 || areRecommendationsLoading) && (
            <div className="mt-32">
              {/* Section Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-12">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(251,146,60,0.8)]"></div>
                    <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em]">AI Curated</span>
                    <span className="text-[10px] font-medium text-slate-500 ml-2">Powered by Gemini</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-black font-outfit text-white tracking-tight">
                    Recommended <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">For You</span>
                  </h2>
                  <p className="text-slate-400 text-sm mt-2 max-w-md">Based on your past registrations, we think you'll love these events</p>
                </div>
              </div>

              {/* Loading State */}
              {areRecommendationsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-6">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-slate-800" />
                    <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-t-orange-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-orange-400 animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white font-outfit mb-1">Analyzing Your Preferences</p>
                    <p className="text-sm text-slate-500">Our AI is finding the perfect events for you...</p>
                  </div>
                </div>
              ) : (
                /* Cards Grid - Same style as Upcoming Experiences */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                  {recommendedEvents.slice(0, 3).map((event, idx) => {
                    const isPast = isPastEvent(event);
                    const isRegistered = registrations.some(r => r.eventId === event.id && r.participantEmail === currentUser?.email);
                    const currentRegistrations = registrations.filter(r => r.eventId === event.id && r.status !== RegistrationStatus.REJECTED).length;
                    const isFull = currentRegistrations >= event.capacity;
                    const now = new Date();
                    const startDate = new Date(event.date);
                    const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 3600000);
                    const isLive = now >= startDate && now <= endDate;
                    const isPastBadge = now > endDate;
                    const isClosed = event.isRegistrationOpen === false || now >= startDate;

                    const remainingSpots = Math.max(0, Number(event.capacity) - currentRegistrations);

                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: idx * 0.1 }}
                        className={`group glass-card rounded-[32px] overflow-hidden transition-all duration-500 flex flex-col h-full bg-[#0f172a]/40 border-orange-500/5 hover:border-orange-500/20 ${isPast ? 'opacity-50 grayscale' : ''}`}
                      >
                        <div className="relative h-56 overflow-hidden">
                          <LazyEventImage eventId={event.id} initialSrc={event.imageUrl} alt={event.title} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                          {/* AI Pick Badge */}
                          <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-600 to-amber-500 text-[10px] font-black text-white uppercase tracking-wider shadow-xl shadow-orange-600/30">
                            <Sparkles className="w-3 h-3" />
                            AI Pick
                          </div>

                          <div className={`absolute top-4 right-4 backdrop-blur-md px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl z-10 ${event.locationType === 'online' ? 'bg-orange-600/90 text-white border border-orange-400/30' : 'bg-slate-900/90 text-white border border-white/10'}`}>
                            {event.locationType === 'online' ? 'Online' : 'Offline'}
                          </div>

                          <div className="absolute bottom-4 left-4 z-10 flex gap-2">
                            <span className={`px-3 py-1 backdrop-blur-md rounded-lg text-[10px] font-bold border transition-colors ${remainingSpots === 0 ? 'bg-red-500/20 text-red-300 border-red-500/30' : remainingSpots <= 5 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-white/10 text-white border-white/10 group-hover:bg-orange-600/50'}`}>
                              {remainingSpots === 0 ? 'Sold Out' : `${remainingSpots} Spots Left`}
                            </span>
                          </div>
                        </div>

                        <div className="p-8 flex-1 flex flex-col">
                          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-6 bg-orange-500/5 w-fit px-4 py-1.5 rounded-full border border-orange-500/10">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(event.date), 'MMMM d, yyyy')}
                          </div>

                          <h3
                            onClick={() => setSelectedEventForDetails(event)}
                            className="text-2xl font-black text-white mb-3 font-outfit decoration-orange-500/50 decoration-2 underline-offset-8 cursor-pointer group-hover:text-orange-300 group-hover:translate-x-1 transition-all"
                          >
                            {event.title}
                          </h3>

                          <div className="flex items-center gap-2 text-slate-400 text-xs mb-5 font-medium opacity-80">
                            <MapPin className="w-4 h-4 text-orange-400" />
                            {renderLocation(event.location, event.locationType, "truncate max-w-[200px]")}
                          </div>

                          <p className="text-slate-400 text-sm line-clamp-2 mb-8 flex-1 leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">{event.description}</p>

                          <div className="flex flex-col gap-4 mt-auto">
                            <div className="flex items-center justify-between">
                              {isLive && (
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-500 animate-pulse bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                                  <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div>
                                  Live Now
                                </div>
                              )}
                              {isFull && !isRegistered && !isPastBadge && (
                                <div className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                                  Event Full
                                </div>
                              )}
                              {isPastBadge && (
                                <div className="text-[10px] font-black text-slate-500 bg-slate-500/10 border border-slate-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                                  Inactive
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {isRegistered ? (
                                <button
                                  onClick={() => {
                                    const reg = registrations.find(r => r.eventId === event.id && r.participantEmail === currentUser?.email);
                                    if (reg) setSelectedRegistrationDetails(reg);
                                  }}
                                  className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold font-outfit py-3 rounded-2xl transition-all flex items-center justify-center gap-2 group/btn"
                                >
                                  <CheckCircle className="w-5 h-5 text-orange-400 group-hover/btn:scale-110 transition-transform" />
                                  View Registration
                                </button>
                              ) : (
                                <button
                                  disabled={isFull || isClosed}
                                  onClick={async () => {
                                    const fullEvent = await getEventById(event.id, { excludeImage: true });
                                    setSelectedEventForReg(fullEvent || event);
                                  }}
                                  className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold font-outfit py-3 rounded-2xl transition-all shadow-lg shadow-orange-600/20 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                                >
                                  {isFull ? 'Waitlisted' : (isClosed ? 'Registration Closed' : 'Secure Your Spot')}
                                </button>
                              )}

                              <button
                                onClick={() => setSelectedEventForDetails(event)}
                                className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all"
                                title="View Details"
                              >
                                <ExternalLink className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {pastEvents.length > 0 && (
            <div className="mt-32">
              <div className="flex items-center gap-6 mb-12">
                <h3 className="text-3xl font-black font-outfit text-white tracking-tight whitespace-nowrap">Past Memories</h3>
                <div className="flex-1 h-px bg-white/5"></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {pastEvents.map((event, idx) => renderEventCard(event, idx + upcomingEvents.length))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMyTickets = () => {
    if (!currentUser) return null;

    // Filter registrations for this logged in user
    const myRegs = registrations.filter(r => r.participantEmail === currentUser.email);

    // Split into Active and Past
    const activeRegs = myRegs.filter(reg => {
      const event = events.find(e => e.id === reg.eventId);
      return event && !isPastEvent(event) && (reg.status === RegistrationStatus.APPROVED || reg.status === RegistrationStatus.PENDING || reg.status === RegistrationStatus.WAITLISTED || reg.status === RegistrationStatus.AWAITING_PAYMENT);
    });

    const pastRegs = myRegs.filter(reg => {
      const event = events.find(e => e.id === reg.eventId);
      return event && isPastEvent(event);
    });

    const activeTicketsCount = activeRegs.filter(r => r.status === RegistrationStatus.APPROVED || r.status === RegistrationStatus.PENDING).length;

    const renderTicketCard = (reg: Registration) => {
      const event = events.find(e => e.id === reg.eventId);
      if (!event) return null;
      const isPast = isPastEvent(event);

      return (
        <div key={reg.id} className={`group glass-card rounded-[32px] p-6 lg:p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden transition-all duration-500 hover:border-orange-500/30 ${isPast ? 'opacity-60 grayscale' : ''}`}>
          <div className="absolute top-0 right-0 w-32 h-64 bg-orange-600/5 -rotate-45 translate-x-16 -translate-y-16 pointer-events-none"></div>

          <div className="w-full md:w-32 h-32 rounded-2xl overflow-hidden flex-shrink-0 border border-white/5 shadow-2xl">
            <LazyEventImage eventId={event.id} initialSrc={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
          </div>

          <div className="flex-1 w-full text-center md:text-left">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60">ID: {reg.id.slice(0, 8)}</span>
            <h3 className="text-2xl font-black text-white mt-1 mb-3 font-outfit line-clamp-1 group-hover:text-orange-400 transition-colors uppercase tracking-tight">{event.title}</h3>
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-x-6 gap-y-3 mt-4 text-slate-400 text-sm font-medium">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-400" />
                {format(new Date(event.date), 'MMM d, yyyy')}
                {event.endDate && new Date(event.date).toDateString() !== new Date(event.endDate).toDateString()
                  ? ` - ${format(new Date(event.endDate), 'MMM d, yyyy')}`
                  : ''}
              </div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-orange-400" /> {format(new Date(event.date), 'h:mm a')} {event.endDate ? `- ${format(new Date(event.endDate), 'h:mm a')}` : ''}</div>
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-orange-400" /> {renderLocation(event.location, event.locationType, "truncate max-w-[150px]")}</div>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end gap-4 min-w-[200px] w-full md:w-auto">
            <Badge status={reg.status} />
            {!isPast && (reg.status === RegistrationStatus.APPROVED) && (
              <button
                onClick={() => setSelectedTicket(reg)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white border border-transparent px-8 py-3.5 rounded-2xl text-xs font-black font-outfit transition-all uppercase tracking-widest shadow-xl shadow-orange-600/20 active:scale-95 flex items-center justify-center gap-3"
              >
                <QrCode className="w-4 h-4" /> View Digital Ticket
              </button>
            )}
            <button
              onClick={() => setSelectedEventForDetails(event)}
              className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-[0.3em] transition-colors"
            >
              Event Details
            </button>
            {reg.status === RegistrationStatus.AWAITING_PAYMENT && !isPast && (
              <button
                onClick={() => handleLatePayment(reg, event)}
                className="mt-3 w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-orange-600/20"
              >
                Pay to Confirm
              </button>
            )}
            {!isPast && (
              <button
                onClick={() => handleCancelRegistration(reg.id)}
                className="text-[10px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-[0.3em] transition-colors flex items-center gap-2 group/cancel mt-4"
              >
                <Trash2 className="w-3 h-3 group-hover/cancel:scale-110 transition-transform" />
                Cancel Registration
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="max-w-4xl mx-auto px-4 pt-32 pb-16 md:pb-20 animate-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
              <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em]">Personal Node</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black font-outfit text-white tracking-tight">Your Passport</h2>
            <p className="text-slate-400 text-sm font-medium opacity-80 mt-1">Manage your upcoming experiences and digital tickets.</p>
          </div>
          <div className="bg-orange-600/10 border border-orange-500/20 px-6 py-3 rounded-2xl flex items-center gap-3 w-fit">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
            <span className="text-xs font-black text-orange-400 uppercase tracking-widest">{activeTicketsCount} Active {activeTicketsCount !== 1 ? 'Permits' : 'Permit'}</span>
          </div>
        </div>

        {dataLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => <TicketSkeleton key={i} />)}
          </div>
        ) : myRegs.length === 0 ? (
          <div className="text-center py-24 glass-card rounded-[40px] border-dashed border-2 border-white/5">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <QrCode className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-2xl font-black font-outfit text-white mb-2">No tickets yet</h3>
            <p className="text-slate-400 mb-8 max-w-xs mx-auto">Your journey begins when you register for your first event.</p>
            <button
              onClick={() => setActiveTab('browse')}
              className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black font-outfit hover:bg-orange-700 transition-all uppercase tracking-widest shadow-xl shadow-orange-600/20"
            >
              Explore Events
            </button>
          </div>
        ) : (
          <div className="space-y-16">
            {activeRegs.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Upcoming Expeditions</h3>
                  <div className="flex-1 h-px bg-white/5"></div>
                </div>
                {activeRegs.map(renderTicketCard)}
              </div>
            )}

            {pastRegs.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Journey Log</h3>
                  <div className="flex-1 h-px bg-white/5"></div>
                </div>
                {pastRegs.map(renderTicketCard)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderOrganizer = () => {
    // Only show events created by this organizer OR where they are a collaborator
    const myEvents = events.filter(e => e.organizerId === currentUser.id || (e.collaboratorEmails && e.collaboratorEmails.includes(currentUser.email)));

    // If no event selected, show Dashboard or List
    if (!organizerSelectedEventId) {
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 animate-in fade-in duration-700">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
            <div>
              <h2 className="text-4xl font-black font-outfit text-white tracking-tight">Command Center</h2>
              <p className="text-slate-400 font-medium opacity-80 mt-1">Orchestrate your experiences and manage your community.</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => { resetEventForm(); setIsCreateModalOpen(true); }}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 text-white border border-white/10 px-6 py-3.5 rounded-2xl hover:bg-white/10 font-bold font-outfit transition-all uppercase tracking-wider text-xs"
              >
                <Plus className="w-4 h-4 text-orange-400" /> New Venture
              </button>
              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-orange-600 text-white px-8 py-3.5 rounded-2xl hover:bg-orange-700 shadow-xl shadow-orange-600/30 transition-all active:scale-95 font-black font-outfit uppercase tracking-wider text-xs"
              >
                <ScanLine className="w-4 h-4" /> Scan Entrance
              </button>
            </div>
          </div>

          <div className="inline-flex p-1.5 bg-white/5 rounded-2xl border border-white/5 mb-10">
            <button
              onClick={() => setOrganizerView('overview')}
              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${organizerView === 'overview' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'text-slate-400 hover:text-white'}`}
            >
              Intelligence
            </button>
            <button
              onClick={() => setOrganizerView('events')}
              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${organizerView === 'events' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'text-slate-400 hover:text-white'}`}
            >
              Expeditions
            </button>
          </div>

          {organizerView === 'overview' ? (
            <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-orange-500 animate-spin" /></div>}>
              <AnalyticsDashboard
                events={myEvents}
                registrations={registrations.filter(r => myEvents.some(e => e.id === r.eventId))}
              />
            </Suspense>
          ) : (
            dataLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map(i => <EventCardSkeleton key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {myEvents.map(event => {
                  const eventRegs = registrations.filter(r => r.eventId === event.id);
                  const pendingCount = eventRegs.filter(r => r.status === RegistrationStatus.PENDING).length;
                  return (
                    <div
                      key={event.id}
                      onClick={() => { setOrganizerSelectedEventId(event.id); setStatusFilter('ALL'); setAttendanceFilter('ALL'); }}
                      className="group glass-card rounded-3xl p-6 cursor-pointer border border-white/5 hover:border-orange-500/30 transition-all duration-500 flex flex-col h-full"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20 group-hover:scale-110 transition-transform duration-500">
                          <Calendar className="w-6 h-6 text-orange-400" />
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60">Status</span>
                          {isPastEvent(event) ? (
                            <span className="text-xs font-bold text-slate-400 mt-1">Inactive</span>
                          ) : (
                            <span className="text-xs font-bold text-emerald-400 mt-1">Active</span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-xl font-black font-outfit text-white mb-2 tracking-tight group-hover:text-orange-400 transition-colors line-clamp-1">{event.title}</h3>
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-medium opacity-80 mb-6">
                        <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-orange-400" /> {format(new Date(event.date), 'MMM d, h:mm a')}</div>
                      </div>

                      <div className="mt-auto space-y-4">
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enlisted</span>
                            <span className="text-sm font-black font-outfit text-white">{eventRegs.length} / {event.capacity}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-orange-500 to-amber-600 transition-all duration-1000"
                              style={{ width: `${Math.min(100, (eventRegs.length / event.capacity) * 100)}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          {pendingCount > 0 ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] font-black text-amber-500 uppercase tracking-widest">
                              <AlertCircle className="w-3 h-3" /> {pendingCount} Pending Approval
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                              <CheckSquare className="w-3 h-3" /> Fully Vetted
                            </div>
                          )}
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-orange-600 transition-colors">
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {myEvents.length === 0 && (
                  <div className="text-center py-24 glass-card rounded-[40px] border-dashed border-2 border-white/5 col-span-full">
                    <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Calendar className="w-10 h-10 text-slate-600" />
                    </div>
                    <h3 className="text-2xl font-black font-outfit text-white mb-2">No expeditions yet</h3>
                    <p className="text-slate-400 mb-8 max-w-xs mx-auto">Launch your first event and begin your legacy.</p>
                    <button
                      onClick={() => { resetEventForm(); setIsCreateModalOpen(true); }}
                      className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black font-outfit hover:bg-orange-700 transition-all uppercase tracking-widest shadow-xl shadow-orange-600/20"
                    >
                      Create Your First Event
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      );
    }

    // Details for specific event
    const event = events.find(e => e.id === organizerSelectedEventId);
    let eventRegs = registrations.filter(r => r.eventId === organizerSelectedEventId);

    // Filter Logic
    if (statusFilter !== 'ALL') {
      eventRegs = eventRegs.filter(r => r.status === statusFilter);
    }
    if (attendanceFilter !== 'ALL') {
      eventRegs = eventRegs.filter(r => attendanceFilter === 'PRESENT' ? r.attended : !r.attended);
    }

    return (
      <div className="max-w-7xl mx-auto px-4 pt-32 pb-16">
        <button
          onClick={() => { setOrganizerSelectedEventId(null); setSelectedRegistrationIds([]); }}
          className="mb-4 text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          ← Back to Events
        </button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">{event?.title}</h2>
            <p className="text-slate-400">Manage participants and approvals</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={() => event && handleEditClick(event)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-orange-400 border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-700 font-medium transition-colors"
            >
              <Edit className="w-4 h-4" /> Edit Event
            </button>
            <button
              onClick={() => event && handleSendReminders(event)}
              disabled={isSendingReminders}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-orange-400 border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-700 font-medium disabled:opacity-50 transition-colors"
            >
              {isSendingReminders ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              Send Reminders
            </button>
            <button
              onClick={async () => {
                if (event && confirm(`Are you sure you want to delete "${event.title}"? This action cannot be undone and all registrations will be lost.`)) {
                  const success = await deleteEvent(event.id);
                  if (success) {
                    addToast('Event deleted successfully', 'success');
                    setOrganizerSelectedEventId(null);
                    loadData();
                  } else {
                    addToast('Failed to delete event', 'error');
                  }
                }
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-900/40 text-red-400 border border-red-800 px-4 py-2 rounded-lg hover:bg-red-900/60 font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete Event
            </button>
            <button
              onClick={() => setIsAnnouncementModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-orange-400 border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-700 font-medium transition-colors"
            >
              <Send className="w-4 h-4" /> Broadcast
            </button>
            <button
              onClick={() => event && handleExportCSV(event)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-orange-400 border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-700 font-medium transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 shadow-lg shadow-orange-900/20 transition-all active:scale-95"
            >
              <ScanLine className="w-4 h-4" /> Scan Ticket
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-slate-400 text-sm font-medium mr-2">
            <Filter className="w-4 h-4" /> Filters:
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium uppercase">Status</label>
            <select
              className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2 outline-none appearance-none pr-8 cursor-pointer hover:border-slate-600"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2394a3b8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="ALL">All Statuses</option>
              <option value={RegistrationStatus.PENDING}>Pending</option>
              <option value={RegistrationStatus.APPROVED}>Approved</option>
              <option value={RegistrationStatus.REJECTED}>Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium uppercase">Attendance</label>
            <select
              className="bg-slate-900 border border-slate-700 text-slate-100 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2 outline-none"
              value={attendanceFilter}
              onChange={(e) => setAttendanceFilter(e.target.value as any)}
            >
              <option value="ALL">All Attendance</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent / Not Scanned</option>
            </select>
          </div>

          <div className="ml-auto text-sm text-slate-400">
            Showing {eventRegs.length} result{eventRegs.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedRegistrationIds.length > 0 && (
          <div className="bg-orange-600/10 border border-orange-500/30 p-3 rounded-xl mb-6 flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <span className="text-orange-400 font-bold text-sm px-2 py-1 bg-orange-900/40 rounded-lg">{selectedRegistrationIds.length}</span>
              <span className="text-orange-200 text-sm font-medium">Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (confirm(`Approve ${selectedRegistrationIds.length} registrations?`)) {
                    await Promise.all(selectedRegistrationIds.map(id => updateRegistrationStatus(id, RegistrationStatus.APPROVED)));
                    addToast(`Approved ${selectedRegistrationIds.length} participants`, 'success');
                    setSelectedRegistrationIds([]);
                    loadData();
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={async () => {
                  if (confirm(`Reject ${selectedRegistrationIds.length} registrations?`)) {
                    await Promise.all(selectedRegistrationIds.map(id => updateRegistrationStatus(id, RegistrationStatus.REJECTED)));
                    addToast(`Rejected ${selectedRegistrationIds.length} participants`, 'info');
                    setSelectedRegistrationIds([]);
                    loadData();
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Reject
              </button>
              <button
                onClick={async () => {
                  if (confirm(`Mark ${selectedRegistrationIds.length} participants as present?`)) {
                    await Promise.all(selectedRegistrationIds.map(id => markAttendance(id)));
                    addToast(`Marked ${selectedRegistrationIds.length} participants as present`, 'success');
                    setSelectedRegistrationIds([]);
                    loadData();
                  }
                }}
                className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Mark Present
              </button>
              <button
                onClick={() => setSelectedRegistrationIds([])}
                className="text-slate-400 hover:text-white text-xs font-medium ml-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {dataLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => <ListRowSkeleton key={i} />)}
          </div>
        ) : (
          <>
            {/* Mobile View: Participant Cards */}
            <div className="block md:hidden space-y-4">
              {eventRegs.map(reg => (
                <div key={reg.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="overflow-hidden">
                      <div className="font-medium text-slate-200 truncate">{reg.participantName}</div>
                      <div className="text-xs text-slate-400 truncate">{reg.participantEmail}</div>
                      {event?.isPaid && reg.paymentDetails?.transactionId && (
                        <div className="text-[10px] text-orange-400/80 mt-1 font-mono truncate">
                          Txn: {reg.paymentDetails.transactionId} | ₹{reg.paymentDetails.amount}
                        </div>
                      )}
                    </div>
                    <Badge status={reg.status} />
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                    <div className="text-sm">
                      {reg.attended ? (
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle className="w-4 h-4" /> Present</span>
                          {reg.attendanceTime && (
                            <span className="text-xs text-slate-400">
                              {format(new Date(reg.attendanceTime), 'h:mm a')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Not Scanned</span>
                      )}
                    </div>

                    {reg.status === RegistrationStatus.PENDING && (
                      <div className="flex gap-2">
                        <button onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.APPROVED)} className="p-1.5 bg-green-900/30 text-green-400 rounded-lg border border-green-800" title="Approve"><CheckCircle className="w-5 h-5" /></button>
                        <button onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.REJECTED)} className="p-1.5 bg-red-900/30 text-red-400 rounded-lg border border-red-800" title="Reject"><XCircle className="w-5 h-5" /></button>
                      </div>
                    )}

                    {reg.status === RegistrationStatus.APPROVED && !reg.attended && (
                      <button
                        onClick={() => handleManualAttendance(reg.id)}
                        className="px-3 py-1.5 bg-orange-900/40 text-orange-400 text-xs font-medium rounded-lg border border-orange-800 hover:bg-orange-900/60 transition-colors"
                      >
                        Mark Present
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {eventRegs.length === 0 && (
                <div className="text-center text-slate-400 py-8 bg-slate-900 rounded-xl border border-dashed border-slate-700">
                  No registrations found matching criteria.
                </div>
              )}
            </div>

            {/* Desktop View: Participant Table */}
            <div className="hidden md:block bg-slate-900 rounded-xl shadow-sm border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 w-10">
                      <input
                        type="checkbox"
                        checked={eventRegs.length > 0 && selectedRegistrationIds.length === eventRegs.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRegistrationIds(eventRegs.map(r => r.id));
                          } else {
                            setSelectedRegistrationIds([]);
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-orange-600 focus:ring-orange-500 focus:ring-offset-slate-900"
                      />
                    </th>
                    <th className="px-6 py-4 font-semibold text-slate-300">Participant</th>
                    <th className="px-6 py-4 font-semibold text-slate-300">Email</th>
                    <th className="px-6 py-4 font-semibold text-slate-300">Status</th>
                    {event?.isPaid && (
                      <>
                        <th className="px-6 py-4 font-semibold text-slate-300">Amount</th>
                        <th className="px-6 py-4 font-semibold text-slate-300">Txn ID</th>
                      </>
                    )}
                    <th className="px-6 py-4 font-semibold text-slate-300">Attendance</th>
                    <th className="px-6 py-4 font-semibold text-slate-300">Time</th>
                    <th className="px-6 py-4 font-semibold text-slate-300 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {eventRegs.map(reg => (
                    <tr key={reg.id} className={`hover:bg-slate-800/50 transition-colors ${selectedRegistrationIds.includes(reg.id) ? 'bg-orange-900/10' : ''}`}>
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedRegistrationIds.includes(reg.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRegistrationIds(prev => [...prev, reg.id]);
                            } else {
                              setSelectedRegistrationIds(prev => prev.filter(id => id !== reg.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-orange-600 focus:ring-orange-500 focus:ring-offset-slate-900"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-200">{reg.participantName}</div>
                        {reg.participationType === 'team' && (
                          <div className="text-[10px] text-orange-400 mt-0.5 flex items-center gap-1.5 font-semibold">
                            <span>{reg.teamName}</span>
                            <span className="text-slate-600 font-normal">|</span>
                            <span className="font-mono bg-orange-500/10 px-1 rounded border border-orange-500/20">
                              {teams.find(t => t.id === reg.teamId)?.inviteCode || 'N/A'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400">{reg.participantEmail}</td>
                      <td className="px-6 py-4"><Badge status={reg.status} /></td>
                      {event?.isPaid && (
                        <>
                          <td className="px-6 py-4 text-slate-300 font-medium">
                            {reg.paymentDetails?.amount ? `₹${reg.paymentDetails.amount}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-[10px] max-w-[120px] truncate" title={reg.paymentDetails?.transactionId}>
                            {reg.paymentDetails?.transactionId || '-'}
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4">
                        {reg.attended ? (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle className="w-4 h-4" /> Present
                          </span>
                        ) : (
                          <span className="text-slate-400">Not yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {reg.attendanceTime ? format(new Date(reg.attendanceTime), 'h:mm a') : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {reg.status === RegistrationStatus.PENDING && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.APPROVED)}
                              className="p-1.5 text-green-400 hover:bg-green-900/30 rounded-md"
                              title="Approve"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.REJECTED)}
                              className="p-1.5 text-red-400 hover:bg-red-900/30 rounded-md"
                              title="Reject"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                        {reg.status === RegistrationStatus.APPROVED && !reg.attended && (
                          <button
                            onClick={() => handleManualAttendance(reg.id)}
                            className="text-orange-400 hover:text-orange-300 text-sm font-medium hover:underline mr-2"
                          >
                            Mark Present
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedRegistrationDetails(reg)}
                          className="text-slate-400 hover:text-slate-200 text-sm font-medium hover:underline ml-2"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {eventRegs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400">No registrations found matching criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-20">
      {renderHeader()}
      <ToastContainer toasts={toasts} />

      <main className="pt-6 px-4 sm:px-0 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -20, filter: 'blur(5px)' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full"
          >
            {activeTab === 'browse' && renderEvents()}
            {activeTab === 'my-tickets' && (currentUser ? renderMyTickets() : <div className="text-center py-20 text-slate-400 glass-panel rounded-2xl mx-auto max-w-md">Please sign in to view your tickets.</div>)}
            {activeTab === 'organizer' && (currentUser?.role === 'organizer' ? renderOrganizer() : <div className="text-center py-20 text-slate-400 glass-panel rounded-2xl mx-auto max-w-md">Organizer dashboard requires organizer privileges.</div>)}
          </motion.div>
        </AnimatePresence>
      </main>

      {renderAuthModal()}
      <Suspense fallback={null}>
        <LiquidChrome />
      </Suspense>

      {/* --- MODALS --- */}

      {/* CREATE / EDIT EVENT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full h-full sm:h-auto sm:max-w-lg sm:rounded-3xl shadow-2xl border-none sm:border sm:border-slate-800 flex flex-col max-h-full sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10 flex-shrink-0">
              <h3 className="text-xl font-bold text-white font-outfit">{isEditMode ? 'Edit Event' : 'Create New Event'}</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-200 p-1">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <form onSubmit={handleSaveEvent} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2 font-outfit">Event Image</label>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative w-full sm:w-48 h-40 sm:h-32 bg-slate-950 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden group hover:border-orange-500/50 transition-colors">
                      {newEvent.imageUrl ? (
                        <>
                          <img src={newEvent.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs flex items-center gap-1"><Upload className="w-4 h-4" /> Change</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setNewEvent(prev => ({ ...prev, imageUrl: '' }));
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-slate-800/80 backdrop-blur-sm text-slate-300 rounded-full shadow-md hover:bg-slate-700 hover:text-red-400 transition-colors z-20"
                            title="Remove Image"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                          <p className="text-[10px] text-slate-500">Pick a cover image</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Event Title</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                    value={newEvent.title}
                    onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="e.g. Summer Tech Gala"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Start Date & Time</label>
                    <input
                      required
                      type="datetime-local"
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none dark-calendar"
                      value={newEvent.date}
                      onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">End Date & Time</label>
                    <input
                      required
                      type="datetime-local"
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none dark-calendar"
                      value={newEvent.endDate}
                      onChange={e => setNewEvent({ ...newEvent, endDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Event Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, locationType: 'offline' })}
                        className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all ${newEvent.locationType === 'offline'
                          ? 'bg-orange-900/40 border-orange-500 text-orange-400 shadow-lg shadow-orange-900/20'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-900'
                          }`}
                      >
                        Offline Event
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, locationType: 'online' })}
                        className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all ${newEvent.locationType === 'online'
                          ? 'bg-orange-900/40 border-orange-500 text-orange-400 shadow-lg shadow-orange-900/20'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-900'
                          }`}
                      >
                        Online Event
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">{newEvent.locationType === 'online' ? 'Meeting Link / Platform' : 'Location / Venue'}</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none"
                      value={newEvent.location}
                      onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                      placeholder={newEvent.locationType === 'online' ? 'Zoom, Google Meet, etc.' : 'City or Venue'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Capacity</label>
                  <input
                    required
                    type="number"
                    min="1"
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={newEvent.capacity}
                    onChange={e => setNewEvent({ ...newEvent, capacity: e.target.value })}
                    placeholder="Max attendees"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Participation Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['individual', 'team', 'both'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, participationMode: mode as ParticipationMode })}
                        className={`py-2 px-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${newEvent.participationMode === mode
                          ? 'bg-orange-900/40 border-orange-500 text-orange-400 shadow-lg shadow-orange-900/20'
                          : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-600'
                          }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {(newEvent.participationMode === 'team' || newEvent.participationMode === 'both') && (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Max Team Size</label>
                    <input
                      required
                      type="number"
                      min="2"
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                      value={newEvent.maxTeamSize}
                      onChange={e => setNewEvent({ ...newEvent, maxTeamSize: e.target.value })}
                      placeholder="e.g. 5"
                    />
                  </div>
                )}

                <div className="border-t border-slate-800 pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-slate-300">Event Admission</label>
                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, isPaid: false })}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!newEvent.isPaid ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        Free
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, isPaid: true })}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${newEvent.isPaid ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        Paid
                      </button>
                    </div>
                  </div>

                  {newEvent.isPaid && (
                    <div className="space-y-4 animate-in slide-in-from-top-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Ticket Price (₹)</label>
                        <input
                          type="number"
                          min="1"
                          required
                          className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none"
                          value={newEvent.price}
                          onChange={e => setNewEvent({ ...newEvent, price: e.target.value })}
                          placeholder="e.g. 499"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Promo Codes</label>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            placeholder="Code (e.g. EARLYBIRD)"
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:ring-2 focus:ring-orange-500 outline-none uppercase"
                            value={promoCodeInput.code}
                            onChange={e => setPromoCodeInput({ ...promoCodeInput, code: e.target.value.toUpperCase() })}
                          />
                          <select
                            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            value={promoCodeInput.type}
                            onChange={e => setPromoCodeInput({ ...promoCodeInput, type: e.target.value as 'percentage' | 'fixed' })}
                          >
                            <option value="percentage">% Off</option>
                            <option value="fixed">₹ Off</option>
                          </select>
                          <input
                            type="number"
                            placeholder="Value"
                            className="w-20 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            value={promoCodeInput.value}
                            onChange={e => setPromoCodeInput({ ...promoCodeInput, value: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (promoCodeInput.code && promoCodeInput.value) {
                                setNewEvent(prev => ({
                                  ...prev,
                                  promoCodes: [...prev.promoCodes, {
                                    code: promoCodeInput.code,
                                    type: promoCodeInput.type,
                                    value: parseFloat(promoCodeInput.value)
                                  }]
                                }));
                                setPromoCodeInput({ code: '', type: 'percentage', value: '' });
                              }
                            }}
                            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium"
                          >
                            Add
                          </button>
                        </div>

                        <div className="space-y-2">
                          {newEvent.promoCodes.map((code, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-orange-400 font-bold">{code.code}</span>
                                <span className="text-slate-400 text-xs">
                                  (-{code.value}{code.type === 'percentage' ? '%' : '₹'})
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const newCodes = [...newEvent.promoCodes];
                                  newCodes.splice(idx, 1);
                                  setNewEvent({ ...newEvent, promoCodes: newCodes });
                                }}
                                className="text-slate-500 hover:text-red-400"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Custom Questions Section */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-300">Custom Registration Questions</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newQ: CustomQuestion = {
                          id: crypto.randomUUID(),
                          question: '',
                          type: 'text',
                          required: false
                        };
                        setNewEvent(prev => ({ ...prev, customQuestions: [...prev.customQuestions, newQ] }));
                      }}
                      className="text-xs bg-orange-900/40 text-orange-400 px-2 py-1 rounded-md hover:bg-orange-900/60 font-medium"
                    >
                      + Add Question
                    </button>
                  </div>

                  <div className="space-y-3">
                    {newEvent.customQuestions.map((q, idx) => (
                      <div key={q.id} className="p-3 bg-slate-950 rounded-lg border border-slate-700">
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            className="flex-1 px-3 py-1.5 text-sm rounded border border-slate-700 bg-slate-900 text-slate-100 focus:ring-1 focus:ring-orange-500 outline-none"
                            placeholder="Question text (e.g. Dietary restrictions?)"
                            value={q.question}
                            onChange={e => {
                              const updated = [...newEvent.customQuestions];
                              updated[idx].question = e.target.value;
                              setNewEvent({ ...newEvent, customQuestions: updated });
                            }}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = newEvent.customQuestions.filter(x => x.id !== q.id);
                              setNewEvent({ ...newEvent, customQuestions: updated });
                            }}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <div className="flex items-center gap-1">
                            <span>Type:</span>
                            <select
                              className="bg-slate-900 border border-slate-700 text-slate-100 rounded px-2 py-1 outline-none"
                              value={q.type}
                              onChange={e => {
                                const updated = [...newEvent.customQuestions];
                                updated[idx].type = e.target.value as any;
                                setNewEvent({ ...newEvent, customQuestions: updated });
                              }}
                            >
                              <option value="text">Text</option>
                              <option value="boolean">Yes/No</option>
                              <option value="select">Select (Dropdown)</option>
                            </select>
                          </div>
                          <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={q.required}
                              onChange={e => {
                                const updated = [...newEvent.customQuestions];
                                updated[idx].required = e.target.checked;
                                setNewEvent({ ...newEvent, customQuestions: updated });
                              }}
                              className="rounded text-orange-600 focus:ring-orange-500"
                            />
                            Required
                          </label>
                        </div>
                        {q.type === 'select' && (
                          <div className="mt-2">
                            <input
                              type="text"
                              className="w-full px-3 py-1.5 text-xs rounded border border-slate-700 bg-slate-900 text-slate-100 focus:ring-1 focus:ring-orange-500 outline-none"
                              placeholder="Options separated by comma (e.g. Red, Blue, Green)"
                              value={q.options?.join(', ') || ''}
                              onChange={e => {
                                const updated = [...newEvent.customQuestions];
                                updated[idx].options = e.target.value.split(',').map(s => s.trim());
                                setNewEvent({ ...newEvent, customQuestions: updated });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    {newEvent.customQuestions.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-2 italic">No custom questions added yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Co-Organizers</label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="email"
                      className="flex-1 px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder="Enter organizer email"
                      value={collaboratorEmailInput}
                      onChange={e => setCollaboratorEmailInput(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (collaboratorEmailInput && !newEvent.collaboratorEmails?.includes(collaboratorEmailInput)) {
                          setNewEvent(prev => ({
                            ...prev,
                            collaboratorEmails: [...(prev.collaboratorEmails || []), collaboratorEmailInput]
                          }));
                          setCollaboratorEmailInput('');
                        }
                      }}
                      disabled={!collaboratorEmailInput}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>

                  {newEvent.collaboratorEmails && newEvent.collaboratorEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newEvent.collaboratorEmails.map(email => (
                        <div key={email} className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-full text-sm">
                          <span>{email}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewEvent(prev => ({
                                ...prev,
                                collaboratorEmails: prev.collaboratorEmails.filter(e => e !== email)
                              }));
                            }}
                            className="text-slate-500 hover:text-red-400"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {(!newEvent.collaboratorEmails || newEvent.collaboratorEmails.length === 0) && (
                    <p className="text-xs text-slate-500 italic">No co-organizers added.</p>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-slate-300">Description</label>
                    <button
                      type="button"
                      onClick={handleGenerateDescription}
                      disabled={isGeneratingAI}
                      className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all font-medium ${isGeneratingAI
                        ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] text-white cursor-wait'
                        : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:opacity-90 hover:scale-105'
                        }`}
                    >
                      {isGeneratingAI ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {isGeneratingAI ? 'Generating...' : 'AI Assist'}
                    </button>
                  </div>
                  <textarea
                    required
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none h-32 resize-none"
                    value={newEvent.description}
                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Describe your event..."
                  ></textarea>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-orange-900/20"
                  >
                    {isEditMode ? 'Update Event' : 'Publish Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER MODAL */}
      {selectedEventForReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full h-full sm:h-auto sm:max-w-md sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="bg-orange-600 p-6 text-white relative flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30 backdrop-blur-md">
                  <CheckSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black font-outfit tracking-tight">Permission Protocol</h3>
                  <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest truncate max-w-[200px]">{selectedEventForReg.title}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedEventForReg(null); setRegistrationAnswers({}); setTeamRegistrationData({ mode: 'individual', subMode: 'create', teamName: '', inviteCode: '' }); }}
                className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
              {/* Participation Mode Choice */}
              {selectedEventForReg.participationMode !== 'individual' && selectedEventForReg.maxTeamSize && (
                <div className="mb-6 space-y-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2 font-outfit uppercase tracking-wider text-[11px]">Join As</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['individual', 'team'].map((m) => {
                      if (selectedEventForReg.participationMode === 'team' && m === 'individual') return null;
                      if (selectedEventForReg.participationMode === 'individual' && m === 'team') return null;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setTeamRegistrationData(prev => ({ ...prev, mode: m as any }))}
                          className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all ${teamRegistrationData.mode === m
                            ? 'bg-orange-900/40 border-orange-500 text-orange-400 shadow-lg shadow-orange-900/20 active:scale-95'
                            : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-600 active:scale-95'
                            }`}
                        >
                          {m === 'individual' ? <UserCircle className="w-4 h-4 mx-auto mb-1" /> : <Users className="w-4 h-4 mx-auto mb-1" />}
                          {m === 'individual' ? 'Individually' : 'As a Team'}
                        </button>
                      );
                    })}
                  </div>

                  {teamRegistrationData.mode === 'team' && (
                    <div className="animate-in slide-in-from-top-2 duration-300 space-y-4 pt-2">
                      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setTeamRegistrationData(prev => ({ ...prev, subMode: 'create' }))}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${teamRegistrationData.subMode === 'create' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          Create Team
                        </button>
                        <button
                          type="button"
                          onClick={() => setTeamRegistrationData(prev => ({ ...prev, subMode: 'join' }))}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${teamRegistrationData.subMode === 'join' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          Join Team
                        </button>
                      </div>

                      {teamRegistrationData.subMode === 'create' ? (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">Team Name</label>
                          <input
                            required
                            type="text"
                            placeholder="My Awesome Team"
                            className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                            value={teamRegistrationData.teamName}
                            onChange={e => setTeamRegistrationData(prev => ({ ...prev, teamName: e.target.value }))}
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">Invite Code</label>
                          <input
                            required
                            type="text"
                            placeholder="ABC123"
                            className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none uppercase transition-all"
                            value={teamRegistrationData.inviteCode}
                            onChange={e => setTeamRegistrationData(prev => ({ ...prev, inviteCode: e.target.value.toUpperCase() }))}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <p className="text-slate-400 mb-6 font-outfit">
                You are registering as <span className="font-semibold text-white">{currentUser.name}</span> ({currentUser.email}).
              </p>

              {/* Custom Questions Display */}
              {selectedEventForReg.customQuestions && selectedEventForReg.customQuestions.length > 0 && (
                <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {selectedEventForReg.customQuestions.map(q => (
                    <div key={q.id}>
                      <label className="block text-sm font-medium text-slate-300 mb-1 font-outfit">
                        {q.question} {q.required && <span className="text-red-400">*</span>}
                      </label>

                      {q.type === 'text' && (
                        <input
                          type="text"
                          required={q.required}
                          value={registrationAnswers[q.id] || ''}
                          className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                          onChange={e => setRegistrationAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        />
                      )}

                      {q.type === 'boolean' && (
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                            <input
                              type="radio"
                              name={q.id}
                              value="yes"
                              required={q.required}
                              checked={registrationAnswers[q.id] === 'Yes'}
                              onChange={e => setRegistrationAnswers(prev => ({ ...prev, [q.id]: 'Yes' }))}
                              className="w-4 h-4 text-orange-500 focus:ring-orange-500 bg-slate-950 border-slate-700"
                            />
                            Yes
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                            <input
                              type="radio"
                              name={q.id}
                              value="no"
                              required={q.required}
                              checked={registrationAnswers[q.id] === 'No'}
                              onChange={e => setRegistrationAnswers(prev => ({ ...prev, [q.id]: 'No' }))}
                              className="w-4 h-4 text-orange-600 focus:ring-orange-500 bg-slate-950 border-slate-700"
                            />
                            No
                          </label>
                        </div>
                      )}

                      {q.type === 'select' && (
                        <select
                          required={q.required}
                          value={registrationAnswers[q.id] || ''}
                          className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                          onChange={e => setRegistrationAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        >
                          <option value="" disabled>Select an option</option>
                          {q.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Payment Info */}
              {selectedEventForReg.isPaid && (
                <div className="mb-6 animate-in slide-in-from-top-2">
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-700/50 mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-400 text-sm">Ticket Price</span>
                      <span className="text-white font-medium">₹{selectedEventForReg.price}</span>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-400 text-right opacity-80">
                      Payment will be collected after organizer approval
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => { setSelectedEventForReg(null); setRegistrationAnswers({}); setAppliedPromoCode(null); }}
                  className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 font-semibold py-3 rounded-xl hover:bg-slate-700 transition-all font-outfit"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 font-outfit shadow-lg shadow-orange-600/20 active:scale-95"
                >
                  {isRegistering ? <Loader2 className="w-5 h-5 animate-spin" /> :
                    selectedEventForReg.isPaid ?
                      'Submit Registration' : 'Confirm Registration'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )
      }

      {/* Payment Details Modal would be nice, but we are doing inline */}

      {/* ... continuation of file ... */}

      {/* PAYMENT MODAL WITH PROMO CODE */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedRegForPayment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 w-full max-w-md rounded-[32px] overflow-hidden border border-white/5 shadow-2xl relative"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-black font-outfit text-white">Confirm Payment</h3>
                  <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-500 hover:text-white"><XCircle className="w-6 h-6" /></button>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between text-slate-400 mb-2">
                    <span>Ticket Price</span>
                    <span>₹{selectedRegForPayment.event.price}</span>
                  </div>
                  {paymentAppliedPromo && (
                    <div className="flex justify-between text-green-400 mb-2">
                      <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {paymentAppliedPromo.code}</span>
                      <span>-₹{paymentAppliedPromo.type === 'percentage'
                        ? ((selectedRegForPayment.event.price || 0) * paymentAppliedPromo.value / 100).toFixed(2)
                        : paymentAppliedPromo.value}</span>
                    </div>
                  )}
                  <div className="border-t border-white/10 pt-2 flex justify-between text-xl font-bold text-white">
                    <span>Total</span>
                    <span>₹{(() => {
                      let price = selectedRegForPayment.event.price || 0;
                      if (paymentAppliedPromo) {
                        if (paymentAppliedPromo.type === 'percentage') {
                          price = price - (price * paymentAppliedPromo.value / 100);
                        } else {
                          price = price - paymentAppliedPromo.value;
                        }
                      }
                      return Math.max(0, price).toFixed(2);
                    })()}</span>
                  </div>
                </div>

                {/* Promo Code Input */}
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Have a Promo Code?</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={paymentPromoCode}
                      onChange={e => setPaymentPromoCode(e.target.value.toUpperCase())}
                      className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-orange-500 transition-colors uppercase"
                      placeholder="CODE"
                    />
                    <button
                      onClick={async () => {
                        try {
                          setPaymentPromoMessage(null);
                          addToast('Verifying code...', 'info');
                          const res = await fetch('/api/verify-promo', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              eventId: selectedRegForPayment.event.id,
                              code: paymentPromoCode
                            })
                          });
                          const data = await res.json();

                          if (data.success && data.promo) {
                            setPaymentAppliedPromo(data.promo);
                            setPaymentPromoMessage({ type: 'success', text: `Code applied! ${data.promo.type === 'percentage' ? `${data.promo.value}% OFF` : `₹${data.promo.value} OFF`}` });
                            addToast('Code applied!', 'success');
                          } else {
                            addToast(data.message || 'Invalid code', 'error');
                            setPaymentPromoMessage({ type: 'error', text: data.message || 'Invalid promo code' });
                            setPaymentAppliedPromo(null);
                          }
                        } catch (e) {
                          addToast('Failed to verify code', 'error');
                          setPaymentPromoMessage({ type: 'error', text: 'Failed to verify code' });
                          console.error(e);
                        }
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-white px-4 rounded-xl font-bold text-sm transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                  {paymentPromoMessage && (
                    <p className={`text-[10px] mt-2 font-medium ${paymentPromoMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {paymentPromoMessage.text}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleProceedToPayment}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl text-lg shadow-lg shadow-orange-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  Payload Payment <ChevronRight className="w-5 h-5" />
                </button>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAnnouncementModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 w-full max-w-lg rounded-[32px] overflow-hidden border border-white/5 shadow-2xl relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500"></div>

              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20">
                      <Send className="w-6 h-6 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black font-outfit text-white tracking-tight">Broadcast Intel</h3>
                      <p className="text-slate-400 text-sm font-medium">Deploy mission-critical updates instantly.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAnnouncementModalOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-white"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Announcement Stream</label>
                    <textarea
                      required
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/30 outline-none h-48 resize-none transition-all font-medium"
                      placeholder="Type your official announcement here..."
                      value={announcementText}
                      onChange={e => setAnnouncementText(e.target.value)}
                    ></textarea>
                    <p className="text-[10px] text-slate-500 mt-3 font-medium flex items-center gap-2">
                      <Info className="w-3 h-3" />
                      Broadcast will reach all approved participants via their in-app Intelligence Feed.
                    </p>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button
                      onClick={() => setIsAnnouncementModalOpen(false)}
                      className="flex-1 px-8 py-4 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all border border-white/5 font-outfit uppercase tracking-wider text-xs"
                    >
                      Abort
                    </button>
                    <button
                      onClick={handleBroadcastAnnouncement}
                      disabled={isBroadcasting || !announcementText.trim()}
                      className="flex-[2] flex items-center justify-center gap-3 bg-orange-600 text-white px-8 py-4 rounded-2xl hover:bg-orange-700 shadow-xl shadow-orange-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 font-black font-outfit uppercase tracking-wider text-xs"
                    >
                      {isBroadcasting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      Transmit Message
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* PROFILE EDIT MODAL */}
      {
        isProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#020617]/80 backdrop-blur-xl selection:bg-orange-500/30">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-[#0f172a] w-full max-w-[420px] rounded-[32px] shadow-[0_0_60px_-15px_rgba(0,0,0,0.7)] border border-white/10 overflow-hidden flex flex-col relative group/modal"
            >
              {/* Decorative gradients */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50" />
              <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none" />

              <div className="flex justify-between items-center p-6 pb-2 relative z-10">
                <motion.h3
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-xl font-black text-white font-outfit tracking-tight"
                >
                  Edit Profile
                </motion.h3>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsProfileModalOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </motion.button>
              </div>

              <form onSubmit={handleUpdateProfile} className="p-6 pt-2 space-y-5 relative z-10">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col items-center mb-2"
                >
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="relative group cursor-pointer"
                  >
                    <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-[#0f172a] shadow-xl ring-2 ring-white/10 group-hover:ring-orange-500 transition-all duration-300 flex items-center justify-center bg-slate-800">
                      {profileForm.avatarUrl || currentUser?.avatarUrl ? (
                        <motion.img
                          initial={{ scale: 1.2 }}
                          animate={{ scale: 1 }}
                          src={profileForm.avatarUrl || currentUser?.avatarUrl}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserCircle className="w-16 h-16 text-slate-600" />
                      )}
                    </div>
                    <motion.div
                      className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-[2px]"
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 1 }}
                    >
                      <motion.div
                        initial={{ scale: 0.5, rotate: -45 }}
                        whileHover={{ scale: 1, rotate: 0 }}
                      >
                        <Camera className="w-8 h-8 text-white drop-shadow-lg" />
                      </motion.div>
                    </motion.div>
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={(e) => handleImageUpload(e, 'profile')}
                    />
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-3 group-hover:text-orange-400 max-w-[150px] text-center leading-tight transition-colors"
                  >
                    Tap to change profile picture
                  </motion.p>
                </motion.div>

                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-1.5"
                  >
                    <label className="text-xs font-bold text-slate-400 ml-1">Full Name</label>
                    <div className="relative">
                      <motion.input
                        whileFocus={{ scale: 1.02, backgroundColor: "rgba(30, 41, 59, 1)" }}
                        type="text"
                        required
                        className="w-full pl-4 pr-4 py-3.5 rounded-2xl bg-[#1e293b] border border-slate-700/50 text-white font-semibold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all placeholder:text-slate-600"
                        value={profileForm.name}
                        onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-1.5"
                  >
                    <label className="text-xs font-bold text-slate-400 ml-1">Email</label>
                    <div className="relative group/email">
                      <input
                        type="email"
                        disabled
                        className="w-full pl-4 pr-4 py-3.5 rounded-2xl bg-[#1e293b]/50 border border-slate-800 text-slate-500 font-medium cursor-not-allowed outline-none select-none transition-colors"
                        value={profileForm.email}
                      />
                      <div className="absolute inset-0 bg-transparent" title="Email cannot be changed directly" />
                    </div>
                    <p className="text-[10px] text-slate-600 ml-1">Email cannot be changed directly.</p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-1.5"
                  >
                    <label className="text-xs font-bold text-slate-400 ml-1">Phone Number</label>
                    <div className="flex gap-2 relative">
                      <div className="relative flex-1">
                        <motion.input
                          whileFocus={{ scale: 1.02, backgroundColor: currentUser?.phoneNumber ? "rgba(20, 83, 45, 0.1)" : "rgba(30, 41, 59, 1)" }}
                          type="tel"
                          disabled={!!currentUser?.phoneNumber}
                          className={`w-full pl-4 ${profileForm.isPhoneVerified ? 'pr-12' : 'pr-4'} py-3.5 rounded-2xl bg-[#1e293b] border text-white font-mono font-medium outline-none transition-all ${currentUser?.phoneNumber
                            ? 'border-green-500/30 bg-green-900/10 text-green-200'
                            : 'border-slate-700/50 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20'
                            }`}
                          value={profileForm.phoneNumber || ''}
                          onChange={e => setProfileForm({ ...profileForm, phoneNumber: e.target.value, isPhoneVerified: false })}
                          placeholder="+1234567890"
                        />
                        <AnimatePresence>
                          {profileForm.isPhoneVerified && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500"
                            >
                              <CheckCircle className="w-5 h-5 fill-green-500/20" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <AnimatePresence>
                        {!currentUser?.phoneNumber && !profileForm.isPhoneVerified && profileForm.phoneNumber && (
                          <motion.button
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            type="button"
                            disabled={authLoading}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={async () => {
                              if (authLoading) return;
                              if (!profileForm.phoneNumber) return;
                              if (profileForm.phoneNumber === currentUser.phoneNumber) {
                                setProfileForm({ ...profileForm, isPhoneVerified: true });
                                return;
                              }

                              const exists = await checkPhoneNumberExists(profileForm.phoneNumber);
                              if (exists) {
                                addToast('Phone number already in use by another account', 'error');
                                return;
                              }

                              if (!profileForm.phoneNumber.startsWith('+')) {
                                addToast('Please include country code (e.g., +1 for US)', 'error');
                                return;
                              }

                              setAuthLoading(true);
                              try {
                                const appVerifier = initRecaptcha('persistent-profile-recaptcha');
                                const confirmation = await signInWithPhone(profileForm.phoneNumber, appVerifier);
                                setConfirmationResult(confirmation);
                                setOtpPurpose('profile');
                                setShowOtpInput(true);
                                addToast('OTP Sent', 'success');
                              } catch (e: any) {
                                console.error(e);
                                addToast(`Failed to send OTP: ${e.message}`, 'error');
                              } finally {
                                setAuthLoading(false);
                              }
                            }}
                            className="px-4 rounded-2xl bg-orange-600 text-white font-bold text-xs hover:bg-orange-700 shadow-lg shadow-orange-900/20 whitespace-nowrap"
                          >
                            Verify
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>

                    {currentUser?.phoneNumber ? (
                      <p className="text-[10px] text-green-500/70 font-medium ml-1 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Verified phone number cannot be changed.
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-500 ml-1">Include country code (e.g. +1...)</p>
                    )}

                    <AnimatePresence>
                      {showOtpInput && (otpPurpose === 'deletion' || !profileForm.isPhoneVerified) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 flex gap-2 overflow-hidden"
                        >
                          <input
                            type="text"
                            className="flex-1 px-4 py-2.5 rounded-xl bg-[#020617] border border-orange-500/50 text-orange-500 font-mono text-center tracking-[0.5em] font-bold focus:ring-2 focus:ring-orange-500/20 outline-none"
                            placeholder="OTP"
                            value={otp}
                            onChange={e => setOtp(e.target.value)}
                            autoFocus
                          />
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={async () => {
                              if (otpPurpose === 'deletion') {
                                await handleConfirmDeletion();
                              } else {
                                try {
                                  await confirmationResult.confirm(otp);
                                  setProfileForm(prev => ({ ...prev, isPhoneVerified: true }));
                                  setShowOtpInput(false);
                                  setOtp('');
                                  addToast('Phone number verified!', 'success');
                                } catch (e) {
                                  addToast('Invalid OTP', 'error');
                                }
                              }
                            }}
                            className="px-6 py-2.5 bg-green-500 hover:bg-green-600 rounded-xl text-white font-bold text-xs shadow-lg shadow-green-900/20"
                          >
                            Confirm
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>

                <AnimatePresence>
                  {!showOtpInput && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: 0.6 }}
                      className="mt-6 pt-5 border-t border-slate-800/50"
                    >
                      <div className="flex items-center justify-between group/danger">
                        <div>
                          <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider group-hover/danger:text-red-400 transition-colors">Danger Zone</h4>
                          <p className="text-[10px] text-slate-500 mt-1 font-medium">Permanently delete your account and all data</p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05, backgroundColor: "rgba(239, 68, 68, 0.2)" }}
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          disabled={authLoading}
                          onClick={() => {
                            if (!currentUser?.phoneNumber) {
                              addToast('Please add and verify a phone number first to enable account deletion.', 'warning');
                              return;
                            }
                            if (confirm('Are you sure? This will permanently delete your account, events, and registrations. You will be logged out immediately.')) {
                              handleSendDeleteOtp();
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${!currentUser?.phoneNumber
                            ? 'bg-slate-800/50 border-slate-800 text-slate-600 cursor-not-allowed'
                            : 'bg-red-500/10 border-red-500/20 text-red-500'
                            }`}
                        >
                          Delete Account
                        </motion.button>
                      </div>
                      {!currentUser?.phoneNumber && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10"
                        >
                          <AlertCircle className="w-4 h-4 text-amber-500/70 flex-shrink-0 mt-0.5" />
                          <p className="text-[10px] text-amber-500/70 leading-relaxed">
                            Phone verification is required for secure account deletion to prevent unauthorized access.
                          </p>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pt-4 flex gap-4">
                  <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(51, 65, 85, 1)" }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="flex-1 py-3.5 rounded-2xl bg-[#1e293b] text-slate-300 font-bold text-sm border border-slate-700/50 transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 text-white font-bold text-sm shadow-xl shadow-orange-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )
      }

      {/* REGISTRATION DETAILS MODAL */}
      {
        selectedRegistrationDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900">
                <div>
                  <h3 className="text-xl font-bold text-white">Registration Details</h3>
                  <p className="text-sm text-slate-400">View your entry information</p>
                </div>
                <button
                  onClick={() => setSelectedRegistrationDetails(null)}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-6">
                  {(() => {
                    const event = events.find(e => e.id === selectedRegistrationDetails.eventId);
                    if (!event) return null;
                    return (
                      <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                        <h4 className="font-bold text-white mb-2">{event.title}</h4>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Calendar className="w-3.5 h-3.5 text-orange-400" />
                            {format(new Date(event.date), 'MMMM d, yyyy h:mm a')}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <MapPin className="w-3.5 h-3.5 text-orange-400" />
                            {renderLocation(event.location, event.locationType)}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-600/20 flex items-center justify-center text-orange-400">
                        <UserCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white leading-tight">{selectedRegistrationDetails.participantName}</p>
                        <p className="text-xs text-slate-500">{selectedRegistrationDetails.participantEmail}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase">Status</p>
                        <div className="mt-1"><Badge status={selectedRegistrationDetails.status} /></div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase">Attended</p>
                        <p className={`mt-1 font-medium ${selectedRegistrationDetails.attended ? 'text-green-400' : 'text-slate-400'}`}>
                          {selectedRegistrationDetails.attended ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase">ID</p>
                        <p className="mt-1 font-mono text-[10px] text-slate-400">#{selectedRegistrationDetails.id.slice(0, 8)}</p>
                      </div>
                    </div>

                    {selectedRegistrationDetails.participationType === 'team' && (
                      <div className="bg-orange-900/20 border border-orange-500/20 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Team</p>
                          <p className="text-slate-200 font-bold text-lg">{selectedRegistrationDetails.teamName}</p>
                          <p className="text-[10px] text-orange-300/70 mt-0.5">{selectedRegistrationDetails.isTeamLeader ? 'Team Leader' : 'Team Member'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Team Code</p>
                          <div className="flex items-center gap-2">
                            <div className="relative group">
                              <p className="text-slate-100 font-mono font-bold bg-orange-500/20 px-3 py-1.5 rounded-lg border border-orange-500/30 select-all">
                                {teams.find(t => t.id === selectedRegistrationDetails.teamId)?.inviteCode || 'N/A'}
                              </p>
                              {(() => {
                                const code = teams.find(t => t.id === selectedRegistrationDetails.teamId)?.inviteCode;
                                if (code) {
                                  return (
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(code);
                                        addToast('Team code copied!', 'success');
                                      }}
                                      className="absolute -right-2 -top-2 p-1.5 bg-orange-600 text-white rounded-full shadow-lg hover:bg-orange-700 transition-all scale-0 group-hover:scale-100 active:scale-95"
                                      title="Copy Code"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedRegistrationDetails.participationType === 'team' && (
                      <div className="pt-4 border-t border-slate-800">
                        <p className="text-sm font-bold text-white mb-3">Team Members</p>
                        <div className="space-y-2">
                          {registrations
                            .filter(r => r.teamId === selectedRegistrationDetails.teamId && r.status !== RegistrationStatus.REJECTED)
                            .map(member => (
                              <div key={member.id} className="flex items-center justify-between bg-slate-800/30 p-2.5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                    {member.participantName.charAt(0)}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-sm text-slate-200 font-medium">{member.participantName}</span>
                                    {member.participantEmail === currentUser?.email && <span className="text-[10px] text-orange-400 font-bold">You</span>}
                                  </div>
                                </div>
                                {member.isTeamLeader && (
                                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-400 bg-orange-400/10 border border-orange-400/20 px-2 py-1 rounded-md">
                                    Leader
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {selectedRegistrationDetails.answers && Object.keys(selectedRegistrationDetails.answers).length > 0 ? (
                      <div className="pt-4 border-t border-slate-800">
                        <p className="text-sm font-bold text-white mb-3">Custom Responses</p>
                        <div className="space-y-3">
                          {(() => {
                            // Helper to find question text
                            const event = events.find(e => e.id === selectedRegistrationDetails.eventId);
                            if (!event || !event.customQuestions) return <p className="text-slate-400 italic">Questions not found</p>;

                            return event.customQuestions.map(q => {
                              const answer = selectedRegistrationDetails.answers?.[q.id];
                              if (!answer) return null;
                              return (
                                <div key={q.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                                  <p className="text-xs text-slate-400 mb-1">{q.question}</p>
                                  <p className="text-sm font-medium text-slate-200">{answer}</p>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic pt-2">No custom answers provided.</p>
                    )}

                    <div className="pt-6 mt-4 border-t border-slate-800 space-y-3">
                      {selectedRegistrationDetails.status === RegistrationStatus.APPROVED && (
                        <button
                          onClick={() => {
                            setSelectedTicket(selectedRegistrationDetails);
                            setSelectedRegistrationDetails(null);
                          }}
                          className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black font-outfit py-4 rounded-2xl transition-all group/tkt"
                        >
                          <QrCode className="w-5 h-5 text-orange-400 group-hover/tkt:scale-110 transition-transform" />
                          View Digital Ticket
                        </button>
                      )}

                      <button
                        onClick={() => {
                          const id = selectedRegistrationDetails.id;
                          setSelectedRegistrationDetails(null);
                          handleCancelRegistration(id);
                        }}
                        className="w-full flex items-center justify-center gap-3 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 text-rose-500 font-bold font-outfit py-3 rounded-2xl transition-all group/cancel"
                      >
                        <LogOut className="w-4 h-4 group-hover/cancel:-translate-x-1 transition-transform" />
                        Cancel Registration
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-900 border-t border-slate-800 rounded-b-2xl">
                <button
                  onClick={() => setSelectedRegistrationDetails(null)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-300 font-semibold py-2 rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* TICKET QR MODAL */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotateX: 10 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.9, rotateX: -10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              id="digital-ticket-card"
              className="relative w-full max-w-sm bg-slate-900 rounded-[32px] overflow-hidden border border-white/10 shadow-2xl shadow-orange-500/10"
            >
              {/* Decorative Header Gradient */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600" />
              {/* Ambient Glows */}
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="p-8 pb-0 pt-10 text-center relative z-10">
                {/* Event Info Header */}
                {(() => {
                  const event = events.find(e => e.id === selectedTicket.eventId);
                  return (
                    <div className="mb-8">
                      <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="inline-flex items-center justify-center p-3 bg-white/5 rounded-2xl mb-4 shadow-inner ring-1 ring-white/10"
                      >
                        <Ticket className="w-6 h-6 text-orange-400" />
                      </motion.div>
                      <motion.h3
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-2xl font-black text-white font-outfit leading-tight mb-2"
                      >
                        {event ? event.title : 'Digital Ticket'}
                      </motion.h3>
                      {event && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="text-sm font-medium text-slate-400 flex items-center justify-center gap-2"
                        >
                          {format(new Date(event.date), 'MMM d, yyyy')}
                          <span className="w-1 h-1 bg-slate-600 rounded-full" />
                          {format(new Date(event.date), 'h:mm a')}
                        </motion.p>
                      )}
                    </div>
                  );
                })()}

                {/* QR Section */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="relative mx-auto w-64 h-64 bg-white p-4 rounded-[24px] shadow-2xl ring-8 ring-white/5 flex items-center justify-center group overflow-hidden"
                >
                  <div className="relative z-10">
                    <QRCode
                      id="ticket-qr-code"
                      value={JSON.stringify({ id: selectedTicket.id, eventId: selectedTicket.eventId })}
                      size={220}
                      level="M"
                    />
                  </div>

                  {/* Scanning Animation */}
                  <motion.div
                    initial={{ top: "0%" }}
                    animate={{ top: "120%" }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                    data-html2canvas-ignore="true"
                    className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent shadow-[0_0_25px_rgba(249,115,22,0.8)] z-20 pointer-events-none opacity-80"
                  />

                  {/* Tech/Frame Overlay */}
                  <div className="absolute inset-0 border-[3px] border-slate-900/5 rounded-[24px] pointer-events-none z-10" />

                  <div className="absolute top-4 left-4 w-3 h-3 border-l-2 border-t-2 border-slate-900 z-10" />
                  <div className="absolute top-4 right-4 w-3 h-3 border-r-2 border-t-2 border-slate-900 z-10" />
                  <div className="absolute bottom-4 left-4 w-3 h-3 border-l-2 border-b-2 border-slate-900 z-10" />
                  <div className="absolute bottom-4 right-4 w-3 h-3 border-r-2 border-b-2 border-slate-900 z-10" />
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500"
                >
                  Scan for Entry
                </motion.p>
              </div>

              {/* Ticket Footer / Stub */}
              <div className="mt-8 px-6 pt-6 pb-0 bg-slate-950/80 backdrop-blur-md border-t border-white/5 relative z-10">
                {/* Perforation Effect */}
                <div className="absolute -top-1.5 left-0 w-full flex justify-between gap-2 overflow-hidden px-1">
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="w-3 h-3 rounded-full bg-black/40 -mt-1.5" />
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Attendee</p>
                    <p className="text-lg font-bold text-white font-outfit truncate max-w-[180px]">{selectedTicket.participantName}</p>
                    <p className="text-[10px] font-mono text-slate-600 mt-0.5">#{selectedTicket.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</p>
                    {selectedTicket.attended ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-400 uppercase tracking-wide">
                        <Check className="w-3 h-3" /> Used
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-bold text-orange-400 uppercase tracking-wide animate-pulse">
                        <Sparkles className="w-3 h-3" /> Valid
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 mt-6 mb-2" data-html2canvas-ignore="true">
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="flex-1 py-3.5 rounded-xl text-slate-400 font-bold text-sm hover:bg-white/5 hover:text-white transition-all border border-transparent hover:border-white/5 active:scale-95"
                  >
                    Close
                  </button>
                  <button
                    onClick={downloadTicket}
                    className="flex-[2] py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-600/20 hover:shadow-orange-600/30 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 group"
                  >
                    <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                    Save Ticket
                  </button>
                </div>

                {/* Bottom Spacer for Visual Balance in Download */}
                <div className="h-4 w-full" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SCANNER MODAL */}
      {
        isScannerOpen && (
          <Suspense fallback={<div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"><Loader2 className="w-10 h-10 text-orange-500 animate-spin" /></div>}>
            <Scanner
              onScan={handleScan}
              onClose={() => setIsScannerOpen(false)}
              scanResult={scanResult}
            />
          </Suspense>
        )
      }

      {/* CROPPER MODAL */}
      {
        isCropperOpen && tempImageSrc && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-900 w-full h-full sm:h-[80vh] sm:max-w-2xl flex flex-col sm:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10 flex-shrink-0">
                <h3 className="text-xl font-bold text-white font-outfit">{cropPurpose === 'profile' ? 'Crop Profile Picture' : 'Crop Event Image'}</h3>
                <button
                  onClick={() => { setIsCropperOpen(false); setTempImageSrc(null); }}
                  className="text-slate-400 hover:text-slate-200 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="relative flex-1 bg-slate-950 overflow-hidden">
                <Cropper
                  image={tempImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={cropPurpose === 'profile' ? 1 : 16 / 9}
                  cropShape={cropPurpose === 'profile' ? 'round' : 'rect'}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>

              <div className="p-6 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-6 flex-shrink-0">
                <div className="flex-1 w-full max-w-xs">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Zoom</label>
                    <span className="text-xs font-bold text-orange-400">{zoom.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500 transition-all hover:bg-slate-750"
                  />
                </div>
                <div className="flex gap-4 w-full sm:w-auto">
                  <button
                    onClick={() => { setIsCropperOpen(false); setTempImageSrc(null); }}
                    className="flex-1 sm:flex-none px-6 py-3 text-sm font-bold text-slate-400 bg-slate-800 hover:bg-slate-750 rounded-xl transition-all border border-slate-750"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCropConfirm}
                    className="flex-[2] sm:flex-none px-8 py-3 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-lg shadow-orange-600/20 active:scale-95 flex items-center justify-center gap-2 transition-all"
                  >
                    <Check className="w-5 h-5" /> Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* EVENT DETAILS MODAL */}
      {selectedEventForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl shadow-2xl border-none sm:border sm:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col relative">
            <div className="relative h-56 sm:h-64 flex-shrink-0">
              <LazyEventImage eventId={selectedEventForDetails.id} initialSrc={selectedEventForDetails.imageUrl} alt={selectedEventForDetails.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-black/20"></div>
              <button
                onClick={() => setSelectedEventForDetails(null)}
                className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white transition-all border border-white/20 z-50 shadow-lg group"
              >
                <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
              </button>

              <div className="absolute bottom-4 sm:bottom-6 left-6 sm:left-8 right-6 sm:right-8">
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest w-fit mb-2 sm:mb-3 ${selectedEventForDetails.locationType === 'online' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-100'}`}>
                  {selectedEventForDetails.locationType} Event
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white font-outfit line-clamp-2">{selectedEventForDetails.title}</h2>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex bg-slate-800/50 p-1 mx-6 sm:mx-8 rounded-xl border border-slate-800/50 mt-4">
              <button
                onClick={() => setDetailsTab('info')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${detailsTab === 'info' ? 'bg-slate-700 text-orange-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Information
              </button>
              <button
                onClick={() => setDetailsTab('discussion')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${detailsTab === 'discussion' ? 'bg-slate-700 text-orange-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Discussion
              </button>
              <button
                onClick={() => setDetailsTab('reviews')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${detailsTab === 'reviews' ? 'bg-slate-700 text-orange-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Reviews
              </button>
            </div>

            <div ref={scrollContainerRef} className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
              {detailsTab === 'info' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mb-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-slate-300">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <Calendar className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Date & Time</p>
                          {selectedEventForDetails.endDate && new Date(selectedEventForDetails.date).toDateString() !== new Date(selectedEventForDetails.endDate).toDateString() ? (
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <p className="text-sm font-medium">
                                <span className="text-slate-400 text-[10px] uppercase tracking-wider mr-1.5 font-bold">Start:</span>
                                {format(new Date(selectedEventForDetails.date), 'MMM d, yyyy')} at {format(new Date(selectedEventForDetails.date), 'p')}
                              </p>
                              <p className="text-sm font-medium">
                                <span className="text-slate-400 text-[10px] uppercase tracking-wider mr-1.5 font-bold">End:</span>
                                {format(new Date(selectedEventForDetails.endDate), 'MMM d, yyyy')} at {format(new Date(selectedEventForDetails.endDate), 'p')}
                              </p>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm sm:text-base font-medium">
                                {format(new Date(selectedEventForDetails.date), 'EEEE, MMMM d, yyyy')}
                              </p>
                              <p className="text-xs sm:text-sm text-slate-400">
                                {format(new Date(selectedEventForDetails.date), 'p')}
                                {selectedEventForDetails.endDate && ` - ${format(new Date(selectedEventForDetails.endDate), 'p')}`}
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-slate-300">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <MapPin className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Location</p>
                          <div className="text-sm sm:text-base font-medium italic">
                            {renderLocation(selectedEventForDetails.location, selectedEventForDetails.locationType)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-slate-300">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <Users className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Availability</p>
                          <p className="text-sm sm:text-base font-medium">
                            {(() => {
                              const currentRegs = registrations.filter(r => r.eventId === selectedEventForDetails.id && r.status !== RegistrationStatus.REJECTED).length;
                              const remaining = Math.max(0, Number(selectedEventForDetails.capacity) - currentRegs);
                              return remaining === 0 ? 'Sold Out' : `${remaining} Available Spots`;
                            })()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-slate-300">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Registration</p>
                          <p className="text-sm sm:text-base font-medium">
                            {(() => {
                              const isOpen = selectedEventForDetails.isRegistrationOpen !== false && new Date(selectedEventForDetails.date) > new Date();
                              return <span className={isOpen ? "text-emerald-400" : "text-rose-400"}>{isOpen ? "Open" : "Closed"}</span>;
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-6">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">About this experience</p>
                    <div className="bg-slate-800/30 rounded-2xl p-4 sm:p-6 border border-slate-800">
                      <p className="text-sm sm:text-base text-slate-300 leading-relaxed whitespace-pre-line italic border-l-4 border-orange-500/30 pl-4">
                        {selectedEventForDetails.description}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-6 mt-6">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Share Event</p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/?event=${selectedEventForDetails.id}`;
                          navigator.clipboard.writeText(url);
                          addToast('Link copied to clipboard!', 'success');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-700"
                      >
                        <Copy className="w-4 h-4" /> Copy Link
                      </button>
                      <a
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${selectedEventForDetails.title} on Eventron!`)}&url=${encodeURIComponent(`${window.location.origin}/?event=${selectedEventForDetails.id}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] rounded-lg text-sm font-medium transition-colors border border-[#1DA1F2]/20"
                      >
                        <Twitter className="w-4 h-4" /> Twitter
                      </a>
                      <a
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/?event=${selectedEventForDetails.id}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] rounded-lg text-sm font-medium transition-colors border border-[#1877F2]/20"
                      >
                        <Facebook className="w-4 h-4" /> Facebook
                      </a>
                      <a
                        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${window.location.origin}/?event=${selectedEventForDetails.id}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 text-[#0A66C2] rounded-lg text-sm font-medium transition-colors border border-[#0A66C2]/20"
                      >
                        <Linkedin className="w-4 h-4" /> LinkedIn
                      </a>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-6 mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Who's Going</p>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">Approved</span>
                    </div>
                    {(() => {
                      const approvedAttendees = registrations.filter(r => r.eventId === selectedEventForDetails.id && r.status === RegistrationStatus.APPROVED);

                      if (approvedAttendees.length === 0) {
                        return (
                          <div className="bg-slate-800/30 rounded-2xl p-4 border border-slate-800 flex items-center gap-3">
                            <div className="p-2 bg-slate-800 rounded-full text-slate-500">
                              <Users className="w-4 h-4" />
                            </div>
                            <p className="text-sm text-slate-400 italic">No approved participants yet. Be the first!</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {approvedAttendees.slice(0, 15).map((attendee) => (
                              <ParticipantAvatar
                                key={attendee.id}
                                name={attendee.participantName}
                                avatarUrl={attendee.participantAvatarUrl}
                                userId={attendee.participantId}
                              />
                            ))}
                          </div>
                          {approvedAttendees.length > 15 && (
                            <div className="text-center">
                              <p className="text-xs text-slate-500 font-medium bg-slate-800/50 py-2 rounded-lg border border-slate-800">
                                + {approvedAttendees.length - 15} more attendees
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="border-t border-slate-800 pt-6 mt-6">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Add to Calendar</p>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={`https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedEventForDetails.title)}&dates=${format(new Date(selectedEventForDetails.date), "yyyyMMdd'T'HHmmss").replace(/-|:/g, '')}/${format(new Date(selectedEventForDetails.endDate), "yyyyMMdd'T'HHmmss").replace(/-|:/g, '')}&details=${encodeURIComponent(selectedEventForDetails.description)}&location=${encodeURIComponent(selectedEventForDetails.location)}&sf=true&output=xml`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 rounded-lg text-sm font-medium transition-colors border border-orange-600/20"
                      >
                        <CalendarPlus className="w-4 h-4" /> Google Calendar
                      </a>
                      <button
                        onClick={() => {
                          const event = selectedEventForDetails;
                          const icsContent = [
                            'BEGIN:VCALENDAR',
                            'VERSION:2.0',
                            'BEGIN:VEVENT',
                            `SUMMARY:${event.title}`,
                            `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
                            `DTSTART:${format(new Date(event.date), "yyyyMMdd'T'HHmmss").replace(/-|:/g, '')}`,
                            `DTEND:${format(new Date(event.endDate), "yyyyMMdd'T'HHmmss").replace(/-|:/g, '')}`,
                            `LOCATION:${event.location}`,
                            'END:VEVENT',
                            'END:VCALENDAR'
                          ].join('\n');

                          const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
                          const link = document.createElement('a');
                          link.href = window.URL.createObjectURL(blob);
                          link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}.ics`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-700"
                      >
                        <Download className="w-4 h-4" /> Download .ICS
                      </button>
                    </div>
                  </div>
                </>
              )}

              {detailsTab === 'discussion' && (
                <div className="h-full flex flex-col min-h-[400px]">
                  <div className="flex-1 space-y-4 mb-4 overflow-y-auto pr-2 custom-scrollbar">
                    {isMessagesLoading ? (
                      <div className="py-20 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-700 mx-auto" />
                        <p className="text-slate-500 text-sm mt-3 font-medium">Loading conversations...</p>
                      </div>
                    ) : messages.length > 0 ? (
                      messages.map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.userId === currentUser.id ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-baseline gap-2 mb-1 px-1">
                            <span className="text-xs font-bold text-slate-300">{msg.userName}</span>
                            <span className="text-[10px] text-slate-500">{format(new Date(msg.createdAt), 'h:mm a')}</span>
                          </div>
                          <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-sm ${msg.userId === currentUser.id
                            ? 'bg-orange-600 text-white rounded-tr-none'
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                            }`}>
                            {msg.content}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center">
                        <MessageSquare className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                        <p className="text-slate-400 text-sm font-medium">No messages yet.</p>
                        <p className="text-slate-500 text-xs mt-1">Be the first to start the discussion!</p>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} className="mt-auto pt-4 border-t border-slate-800 flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-orange-600 focus:border-transparent outline-none transition-all shadow-inner"
                      placeholder="Ask a question or say hi..."
                      value={newMessageText}
                      onChange={e => setNewMessageText(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={!newMessageText.trim()}
                      className="bg-orange-600 text-white p-3 rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-orange-600/20 active:scale-95 flex items-center justify-center group"
                    >
                      <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                  </form>
                </div>
              )}

              {detailsTab === 'reviews' && (
                <div className="h-full flex flex-col min-h-[400px]">
                  {isReviewsLoading ? (
                    <div className="py-20 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-700 mx-auto" />
                      <p className="text-slate-500 text-sm mt-3 font-medium">Loading reviews...</p>
                    </div>
                  ) : (
                    <>
                      {/* Average Rating Section */}
                      {reviews.length > 0 && (
                        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 mb-6 flex items-center justify-between">
                          <div>
                            <div className="text-3xl font-bold text-white flex items-center gap-2">
                              {(reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1)}
                              <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                            </div>
                            <p className="text-sm text-slate-400 mt-1">
                              Average Rating based on {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 text-xs text-slate-500">
                            {[5, 4, 3, 2, 1].map(r => {
                              const count = reviews.filter(rev => rev.rating === r).length;
                              const percentage = (count / reviews.length) * 100;
                              return (
                                <div key={r} className="flex items-center gap-2">
                                  <span className="w-3">{r}</span>
                                  <Star className="w-3 h-3 text-slate-600" />
                                  <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500" style={{ width: `${percentage}%` }} />
                                  </div>
                                  <span className="w-6 text-right">{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex-1 space-y-6 mb-6 overflow-y-auto pr-2 custom-scrollbar">
                        {reviews.length > 0 ? (
                          reviews.map(review => (
                            <div key={review.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                                    {review.userName.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-200">{review.userName}</p>
                                    <p className="text-[10px] text-slate-500">{format(new Date(review.createdAt), 'MMM d, yyyy')}</p>
                                  </div>
                                </div>
                                <div className="flex text-amber-400">
                                  {[1, 2, 3, 4, 5].map(star => (
                                    <Star key={star} className={`w-3 h-3 ${star <= review.rating ? 'fill-current' : 'text-slate-700'}`} />
                                  ))}
                                </div>
                              </div>
                              <p className="text-sm text-slate-300 italic">"{review.comment}"</p>
                            </div>
                          ))
                        ) : (
                          <div className="py-16 text-center">
                            <Star className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                            <p className="text-slate-400 text-sm font-medium">No reviews yet.</p>
                            <p className="text-slate-500 text-xs mt-1">Attendees can leave reviews after the event.</p>
                          </div>
                        )}
                      </div>

                      {/* Review Form - Only for Attendees who have attended */}
                      {currentUser.role === 'attendee' &&
                        registrations.some(r =>
                          r.eventId === selectedEventForDetails.id &&
                          r.participantEmail === currentUser.email &&
                          r.status === RegistrationStatus.APPROVED &&
                          (r.attended || new Date(selectedEventForDetails.date) < new Date())
                        ) &&
                        !reviews.some(r => r.userId === currentUser.id) && (
                          <form onSubmit={handleSubmitReview} className="mt-auto pt-6 border-t border-slate-800">
                            <h4 className="text-sm font-bold text-white mb-3">Leave a Review</h4>
                            <div className="flex gap-2 mb-3">
                              {[1, 2, 3, 4, 5].map(s => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => setRating(s)}
                                  className="focus:outline-none transition-transform hover:scale-110"
                                >
                                  <Star className={`w-6 h-6 ${s <= rating ? 'text-amber-400 fill-current' : 'text-slate-700'}`} />
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                required
                                minLength={5}
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-orange-600 focus:border-transparent outline-none transition-all"
                                placeholder="Share your experience..."
                                value={reviewComment}
                                onChange={e => setReviewComment(e.target.value)}
                              />
                              <button
                                type="submit"
                                className="bg-orange-600 text-white px-4 py-2 rounded-xl hover:bg-orange-700 transition-all font-medium text-sm shadow-lg shadow-orange-600/20 active:scale-95"
                              >
                                Post
                              </button>
                            </div>
                          </form>
                        )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 sm:p-8 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row gap-4 flex-shrink-0">
              <button
                onClick={() => setSelectedEventForDetails(null)}
                className="order-2 sm:order-1 flex-1 px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-all border border-slate-700 font-outfit"
              >
                Close
              </button>
              {(!currentUser || currentUser.role === 'attendee') && (
                (() => {
                  if (!currentUser) {
                    return (
                      <button
                        onClick={() => {
                          setSelectedEventForDetails(null);
                          setIsAuthModalOpen(true);
                        }}
                        className="order-1 sm:order-2 flex-[2] px-6 py-3 rounded-xl font-bold bg-orange-600 text-white hover:bg-orange-700 shadow-orange-500/20 active:scale-95 font-outfit"
                      >
                        Sign In to Register
                      </button>
                    );
                  }
                  const isRegistered = registrations.some(r => r.eventId === selectedEventForDetails.id && r.participantEmail === currentUser.email);
                  const currentRegsCount = registrations.filter(r => r.eventId === selectedEventForDetails.id && r.status !== RegistrationStatus.REJECTED).length;
                  const isFull = currentRegsCount >= (selectedEventForDetails.capacity as number);
                  const now = new Date();
                  const startDate = new Date(selectedEventForDetails.date);
                  const endDate = selectedEventForDetails.endDate ? new Date(selectedEventForDetails.endDate) : new Date(startDate.getTime() + 3600000);

                  const isLive = now >= startDate && now <= endDate;
                  const isPast = now > endDate;
                  const isClosed = selectedEventForDetails.isRegistrationOpen === false || now >= startDate;

                  return (
                    <button
                      onClick={() => {
                        if (isRegistered) {
                          const myReg = registrations.find(r => r.eventId === selectedEventForDetails.id && r.participantEmail === currentUser.email);
                          if (myReg) setSelectedRegistrationDetails(myReg);
                        } else if (!isClosed) {
                          setSelectedEventForReg(selectedEventForDetails);
                          setSelectedEventForDetails(null);
                        }
                      }}
                      disabled={!isRegistered && isClosed}
                      className={`order-1 sm:order-2 flex-[2] px-6 py-3 rounded-xl font-bold transition-all shadow-lg font-outfit ${isRegistered
                        ? 'bg-orange-900/40 text-orange-400 border border-orange-500 hover:bg-orange-900/60 active:scale-95'
                        : isClosed
                          ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                          : isFull
                            ? 'bg-amber-600/20 text-amber-500 border border-amber-600/40 hover:bg-amber-600/30 active:scale-95'
                            : 'bg-orange-600 text-white hover:bg-orange-700 shadow-orange-500/20 active:scale-95'
                        }`}
                    >
                      {isRegistered ? (
                        <>
                          <CheckCircle className="w-4 h-4 inline mr-2" /> View Registration
                        </>
                      ) : isClosed ? (
                        <>
                          <XCircle className="w-4 h-4 inline mr-2" /> {isPast ? 'Event Ended' : 'Registration Closed'}
                        </>
                      ) : isFull ? (
                        <>
                          <Clock className="w-4 h-4 inline mr-2" /> Join Waitlist
                        </>
                      ) : (
                        <>
                          <CalendarPlus className="w-4 h-4 inline mr-2" /> Register Now
                        </>
                      )}
                    </button>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}


      <Suspense fallback={null}>
        <EventChatBot events={events} currentUserId={currentUser?.id} />
      </Suspense>
    </div >
  );
}
