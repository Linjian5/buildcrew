import { useRef, useState, useEffect } from 'react';
import { AgentAvatar } from '../AgentAvatar';
import type { Department } from '../../data/agents';

type Status = 'idle' | 'working' | 'warning' | 'paused' | 'error';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface AgentAvatarVideoProps {
  agentName: string;
  department: Department;
  status: Status;
  size?: Size;
  showRing?: boolean;
  className?: string;
}

const SIZE_PX: Record<Size, number> = { xs: 32, sm: 48, md: 64, lg: 160 };
const LG_HEIGHT_RATIO = 1.25;

/** Map known agent names to avatar folder names */
const AVATAR_MAP: Record<string, string> = {
  aria: 'aria',
  atlas: 'atlas',
  nova: 'nova',
  sentinel: 'sentinel',
  echo: 'echo',
  sage: 'sage',
  vector: 'vector',
  pixel: 'pixel',
  scout: 'scout',
};

/** Special-case png filenames (most are lowercase, Aria is capitalized) */
const PNG_NAME_OVERRIDE: Record<string, string> = {
  aria: 'Aria',
};

function getAvatarFolder(agentName: string): string {
  const key = agentName.toLowerCase();
  return AVATAR_MAP[key] ?? 'generic-neutral';
}

function getPngName(folder: string): string {
  return PNG_NAME_OVERRIDE[folder] ?? folder;
}

/**
 * Agent avatar with Q-style 3D video for all 12 characters.
 *
 * Performance rules:
 *  - xs/sm (32-48px): always static PNG (too small for video)
 *  - md/lg (64-160px): video only when visible in viewport (IntersectionObserver)
 *  - Fallback chain: video → png → CSS gradient+initials
 */
export function AgentAvatarVideo({
  agentName,
  department,
  status,
  size = 'md',
  showRing = true,
  className,
}: AgentAvatarVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasVideo, setHasVideo] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  const folder = getAvatarFolder(agentName);
  const pngName = getPngName(folder);
  const px = SIZE_PX[size];
  const height = size === 'lg' ? Math.round(px * LG_HEIGHT_RATIO) : px;

  const videoSrc = `/avatars/${folder}/${folder}-${status}.mp4`;
  const posterSrc = `/avatars/${folder}/${pngName}.png`;

  // xs/sm always use static image for performance
  const useStaticOnly = size === 'xs' || size === 'sm';
  const shouldPlayVideo = !useStaticOnly && isVisible && hasVideo;

  // IntersectionObserver — only load video when in viewport
  useEffect(() => {
    if (useStaticOnly) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry) setIsVisible(entry.isIntersecting); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [useStaticOnly]);

  // Reload video when status/agent/visibility changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldPlayVideo) return;
    video.load();
    video.play().catch(() => {});
  }, [status, agentName, shouldPlayVideo]);

  // Full fallback to CSS avatar
  if (!hasVideo && !useStaticOnly) {
    return (
      <AgentAvatar
        name={agentName}
        department={department}
        status={status}
        size={size}
        showRing={showRing}
        className={className}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex shrink-0 items-center justify-center ${className ?? ''}`}
    >
      <div
        className={`overflow-hidden shrink-0 ${
          size === 'xs' || size === 'sm' ? 'rounded-full' : 'rounded-xl'
        }`}
        style={{ width: px, height }}
      >
        {/* Static image for xs/sm OR when video not visible */}
        {(useStaticOnly || !shouldPlayVideo) && (
          <img
            src={posterSrc}
            alt={agentName}
            className="h-full w-full object-cover"
            onError={(e) => {
              // If png fails, hide img and fall through to CSS avatar
              (e.target as HTMLImageElement).style.display = 'none';
              setHasVideo(false);
            }}
          />
        )}

        {/* Video for md/lg when in viewport */}
        {shouldPlayVideo && (
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            poster={posterSrc}
            className="h-full w-full object-cover"
            onError={() => setHasVideo(false)}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        )}
      </div>

      {/* Status indicator dot */}
      {showRing && size !== 'xs' && (
        <div
          className={`absolute bottom-0 right-0 rounded-full border-2 border-card ${
            size === 'lg' ? 'h-5 w-5' : 'h-3 w-3'
          }`}
          style={{
            backgroundColor:
              status === 'working' ? '#10B981' :
              status === 'warning' ? '#F59E0B' :
              status === 'error' ? '#F43F5E' :
              '#6B7280',
          }}
        >
          {(status === 'working' || status === 'error') && (
            <span
              className="absolute inset-0 rounded-full opacity-75 animate-ping"
              style={{
                backgroundColor: status === 'working' ? '#10B981' : '#F43F5E',
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
