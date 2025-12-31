import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, RefreshCcw, ScanLine, Flashlight, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  scanResult?: { type: 'success' | 'error', message: string } | null;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onClose, scanResult }) => {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  // Resume scanning when result is cleared
  useEffect(() => {
    if (!scanResult && scannerRef.current && isScanning) {
      // Small delay to prevent immediate re-scan of same code
      const timer = setTimeout(() => {
        try {
          if (scannerRef.current?.getState() === 2 || scannerRef.current?.getState() === 3) {
            scannerRef.current?.resume();
          }
        } catch (e) {
          // ignore error if already scanning
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [scanResult, isScanning]);


  useEffect(() => {
    // Delay initialization slightly to ensure DOM is ready
    const timer = setTimeout(() => {
      startScanner();
    }, 500);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playBeep = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      osc.type = 'square';

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const startScanner = async () => {
    if (!mountRef.current) return;

    if (scannerRef.current) {
      await stopScanner();
    }

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
      };

      const qrCodeSuccessCallback = (decodedText: string) => {
        // Play beep and pause scanning immediately
        playBeep();

        try {
          // Pause camera feed processing
          scanner.pause(true);
        } catch (e) { console.warn("Failed to pause", e); }

        // Send data to parent
        onScan(decodedText);
      };

      // Try environment first
      try {
        await scanner.start(
          { facingMode: "environment" },
          config,
          qrCodeSuccessCallback,
          () => { }
        );
      } catch (firstErr) {
        console.warn("Env camera failed, trying user...", firstErr);
        await scanner.start(
          { facingMode: "user" },
          config,
          qrCodeSuccessCallback,
          () => { }
        );
      }

      setIsScanning(true);
      setError(null);
    } catch (err: any) {
      console.error("Scanner init error", err);
      let msg = `Camera error: ${err?.name || 'Unknown'}`;
      if (err?.name === "NotAllowedError") msg = "Camera permission denied.";
      else if (err?.name === "NotFoundError") msg = "No camera found.";
      else if (err?.name === "NotReadableError") msg = "Camera unavailable.";
      setError(msg);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) { }
      setIsScanning(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-sm bg-slate-900/50 backdrop-blur-2xl rounded-[32px] overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/5"
      >
        {/* Decorative Ambience */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex justify-between items-center p-6 pb-2 z-10 relative">
          <div>
            <h3 className="text-white text-xl font-bold font-outfit flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-orange-400" />
              Scan Ticket
            </h3>
            <p className="text-slate-400 text-xs mt-0.5 font-medium">{scanResult ? 'Processing...' : 'Align QR code within frame'}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative aspect-square bg-black overflow-hidden m-4 rounded-[24px] border border-white/5 shadow-inner">
          <div id="qr-reader" ref={mountRef} className="w-full h-full object-cover"></div>

          {!isScanning && !error && !scanResult && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-6 text-center z-10 bg-slate-900/50">
              <RefreshCcw className="w-8 h-8 animate-spin mb-4 text-orange-500" />
              <p className="font-medium text-sm">Initializing camera...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-8 text-center bg-slate-900/95 z-20">
              <AlertCircle className="w-10 h-10 mb-4 text-red-500" />
              <p className="font-semibold mb-6">{error}</p>
              <button
                onClick={startScanner}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium text-sm flex items-center gap-2"
              >
                <RefreshCcw className="w-4 h-4" /> Retry
              </button>
            </div>
          )}

          {/* Result Overlay */}
          <AnimatePresence>
            {scanResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center backdrop-blur-xl ${scanResult.type === 'success' ? 'bg-emerald-950/90' : 'bg-red-950/90'
                  }`}
              >
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-2xl ${scanResult.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                    }`}
                >
                  {scanResult.type === 'success' ? <CheckCircle className="w-10 h-10" /> : <X className="w-10 h-10" />}
                </motion.div>

                <motion.h4
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`text-2xl font-black font-outfit mb-2 ${scanResult.type === 'success' ? 'text-emerald-200' : 'text-red-200'
                    }`}
                >
                  {scanResult.type === 'success' ? 'Access Granted' : 'Access Denied'}
                </motion.h4>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`text-sm font-medium ${scanResult.type === 'success' ? 'text-emerald-400/80' : 'text-red-400/80'
                    }`}
                >
                  {scanResult.message}
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scanner Guide UI */}
          {isScanning && !error && !scanResult && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-orange-500 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-orange-500 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-orange-500 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-orange-500 rounded-br-xl" />

                <motion.div
                  initial={{ top: "0%", opacity: 0 }}
                  animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 0.1 }}
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent shadow-[0_0_20px_rgba(251,146,60,0.6)]"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 pt-2 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/60 rounded-full border border-slate-700/50 backdrop-blur-md">
            <Flashlight className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
            <span className="text-xs font-medium text-slate-300">Point at attendee's ticket</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Scanner;
