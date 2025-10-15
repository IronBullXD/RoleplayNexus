import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const NUM_PARTICLES = 30; // Number of particles

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  blur: number;
  color: string;
  duration: number;
  delay: number;
}

const colors = [
  'bg-crimson-700/30',
  'bg-crimson-800/20',
  'bg-ember-700/20',
  'bg-ember-800/10'
];

const BackgroundAnimation = () => {
  const particles = useMemo(() => {
    return Array.from({ length: NUM_PARTICLES }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // as vw
      y: Math.random() * 100, // as vh
      size: 10 + Math.random() * 150, // in px
      blur: 20 + Math.random() * 50, // in px
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 20 + Math.random() * 20, // 20-40 seconds
      delay: Math.random() * 10,
    }));
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden -z-10 bg-slate-950">
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900/80 to-slate-950 opacity-50" />
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute rounded-full ${p.color}`}
          initial={{
            x: `${p.x}vw`,
            y: `${p.y}vh`,
            scale: 0.8 + Math.random() * 0.4,
            opacity: 0,
          }}
          animate={{
            x: `${Math.random() * 100}vw`,
            y: `${Math.random() * 100}vh`,
            opacity: [0, 0.8, 0.8, 0],
            scale: 1 + Math.random() * 0.5,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            repeatType: 'loop',
            ease: 'easeInOut',
          }}
          style={{
            width: p.size,
            height: p.size,
            filter: `blur(${p.blur}px)`,
          }}
        />
      ))}
    </div>
  );
};

export default BackgroundAnimation;
