'use client';

import { useVoice } from '@/hooks/useVoice';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled: boolean;
}

export function VoiceButton({ onTranscript, disabled }: VoiceButtonProps) {
  const { isListening, isSupported, startListening, stopListening } = useVoice({
    onTranscript,
  });

  if (!isSupported) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={isListening ? stopListening : startListening}
      aria-label={isListening ? 'Stop recording' : 'Start voice input'}
      className={
        isListening
          ? 'relative animate-pulse bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-500'
          : ''
      }
    >
      {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      {isListening && (
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-red-500" />
      )}
    </Button>
  );
}
