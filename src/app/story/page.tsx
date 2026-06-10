'use client';

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  motion, useInView,
} from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Sparkles, ArrowRight, ChevronDown,
  Zap, Shield, Globe2, Heart,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────

const STATS = [
  { value: 151,   unit: '',  suffix: '+', label: 'Live search engines',   color: '#60A5FA' },
  { value: 0,     unit: '$', suffix: '',  label: 'Hidden fees. Ever.',     color: '#34D399' },
  { value: 14000, unit: '',  suffix: '+', label: 'Trips planned',          color: '#FBBF24' },
  { value: 6,     unit: '',  suffix: '',  label: 'Travel zones unified',   color: '#A78BFA' },
  { value: 94,    unit: '',  suffix: '%', label: 'Traveler satisfaction',  color: '#FB7185' },
  { value: 2.4,   unit: '$', suffix: 'M', label: 'Saved in hidden fees',  color: '#22D3EE' },
];

const BELIEFS = [
  { n: '01', accent: '#60A5FA', headline: 'Every traveler', sub: 'deserves expert-level planning — not just those who can afford a concierge.' },
  { n: '02', accent: '#34D399', headline: 'Price transparency', sub: 'is not a feature. It is a right. We show you exactly what you pay.' },
  { n: '03', accent: '#A78BFA', headline: 'AI should work for you,', sub: "not manipulate you. We don't have upsell quotas. We have travelers to serve." },
  { n: '04', accent: '#FBBF24', headline: '151 search engines', sub: 'should feel like one. Fragmented planning is a solved problem.' },
  { n: '05', accent: '#FB7185', headline: 'The future of travel', sub: 'is honest, intelligent, and yours. We are building it — together.' },
];

const VALUES = [
  { Icon: Zap,    c: '#FBBF24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.18)', label: 'Innovation', text: 'We chase what others call impossible. 151 engines. One interface. No compromises.' },
  { Icon: Shield, c: '#34D399', bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.18)', label: 'Trust',      text: 'Zero hidden fees. Radical transparency. We earn trust every single search.' },
  { Icon: Globe2, c: '#60A5FA', bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.18)', label: 'Access',     text: 'Expert-level planning for every traveler, regardless of budget or background.' },
  { Icon: Heart,  c: '#FB7185', bg: 'rgba(251,113,133,0.10)', border: 'rgba(251,113,133,0.18)',label: 'Care',       text: 'We obsess over every pixel, every result, every detail — so you never have to.' },
];

const TIMELINE = [
  { year: '2023',     q: '',   dot: '#60A5FA', title: 'The question',       body: 'What if every travel search engine in the world was unified in one place? We decided to find out.' },
  { year: '2024',     q: 'Q1', dot: '#A78BFA', title: 'The engine is built', body: 'Connected 50+ live search engines into a single aggregation layer. Flights, hotels, dining, experiences.' },
  { year: '2024',     q: 'Q2', dot: '#FBBF24', title: '100 engines',         body: 'Crossed 100 connected engines. The world\'s largest travel search network, finally unified.' },
  { year: '2024',     q: 'Q3', dot: '#34D399', title: 'Unit is born',         body: 'Launched Unit — the first AI travel concierge trained on 18 million journeys. The OS was alive.' },
  { year: '2024',     q: 'Q4', dot: '#FB7185', title: '10,000 trips',         body: 'Ten thousand trips planned. $2.4M in hidden fees uncovered and returned to travelers.' },
  { year: '2025',     q: '',   dot: '#22D3EE', title: 'The future begins',    body: '151+ engines. Real-time AI. Every traveler, everywhere. This is only the beginning.' },
];

const TEAM = [
  { av: '👨🏻‍💻', name: 'Efriam M.',  role: 'Founder & CEO',   bio: 'Serial traveler. 40 countries. Built Unitravel because booking a trip took longer than the trip itself.',  color: '#60A5FA' },
  { av: '👩🏾‍🔬', name: 'Aya T.',     role: 'Head of AI',       bio: 'Former DeepMind. Trained Unit on 18M journeys. Believes AI should feel like intuition, not technology.', color: '#A78BFA' },
  { av: '🧑🏻‍🎨', name: 'Marco L.',   role: 'Design Lead',      bio: 'Formerly Apple Design. Makes complexity feel effortless. Every pixel exists for a reason.',              color: '#FBBF24' },
  { av: '👩🏼‍💼', name: 'Sofia K.',   role: 'Head of Product',  bio: 'Six years at Airbnb. Knows exactly what travelers need — often before they know it themselves.',          color: '#34D399' },
];

const CHAOS_ICONS = ['✈️','🏨','🍽️','🗺️','🚂','☁️','💰','🎭','🚗','🚌','🛳️','🏖️','🗼','💼'];

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Animated counter card */
function StatCard({ s, delay }: { s: typeof STATS[0]; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [val, setVal] = useState('0');

  useEffect(() => {
    if (!inView) return;
    // eslint-disable-next-line react/no-direct-mutation-state
    if (s.value === 0) { setVal('0'); return; }
    const dur = 1400;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p   = Math.min((now - start) / dur, 1);
      const eas = 1 - (1 - p) ** 3;
      const cur = s.value < 10 ? +(s.value * eas).toFixed(1) : Math.round(eas * s.value);
      setVal(cur.toLocaleString());
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, s.value]);

  return (
    <motion.div ref={ref}
      initial={{ opacity:0,y:28,scale:0.92 }}
      animate={inView ? { opacity:1,y:0,scale:1 } : {}}
      transition={{ type:'spring',stiffness:320,damping:28,delay }}
      style={{ padding:'28px 24px',borderRadius:20,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',backdropFilter:'blur(16px)' }}
    >
      <div style={{ fontSize:'clamp(2.4rem,5vw,3.6rem)',fontWeight:900,letterSpacing:'-0.05em',lineHeight:1,color:s.color,marginBottom:8,fontVariantNumeric:'tabular-nums' }}>
        {s.unit}{val}{s.suffix}
      </div>
      <div style={{ fontSize:11.5,fontWeight:500,color:'rgba(226,232,240,0.40)',letterSpacing:'0.06em',textTransform:'uppercase' }}>
        {s.label}
      </div>
    </motion.div>
  );
}

/** One belief panel (scroll-revealed) */
function BeliefPanel({ b }: { b: typeof BELIEFS[0]; i?: number }) {
  const ref  = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once:false, margin:'-15%' });
  return (
    <div ref={ref} style={{ minHeight:'85vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'40px clamp(24px,9vw,140px)',borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <motion.div
        initial={{ opacity:0,y:50,filter:'blur(16px)' }}
        animate={seen ? { opacity:1,y:0,filter:'blur(0px)' } : { opacity:0,y:50,filter:'blur(16px)' }}
        transition={{ duration:0.85,ease:[0.22,1,0.36,1] }}
        style={{ maxWidth:900,textAlign:'center' }}
      >
        <div style={{ fontSize:12,fontWeight:700,color:b.accent,letterSpacing:'0.16em',textTransform:'uppercase',marginBottom:28 }}>
          Belief {b.n}
        </div>
        <h2 style={{ fontSize:'clamp(2.2rem,5.5vw,4.4rem)',fontWeight:900,letterSpacing:'-0.045em',lineHeight:1.08,color:'#FAFAFA',margin:'0 0 16px' }}>
          {b.headline}
        </h2>
        <p style={{ fontSize:'clamp(1.05rem,2.2vw,1.35rem)',fontWeight:300,color:'rgba(226,232,240,0.52)',lineHeight:1.65,letterSpacing:'-0.01em',margin:0 }}>
          {b.sub}
        </p>
        <motion.div
          initial={{ width:0 }} animate={seen ? { width:'80px' } : { width:0 }}
          transition={{ duration:0.6,ease:[0.22,1,0.36,1],delay:0.4 }}
          style={{ height:2,background:`linear-gradient(90deg,${b.accent},transparent)`,margin:'32px auto 0',borderRadius:2 }}
        />
      </motion.div>
    </div>
  );
}

/** Timeline item */
function TItem({ item, idx }: { item: typeof TIMELINE[0]; idx: number }) {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once:true, margin:'-60px' });
  const left   = idx % 2 === 0;
  return (
    <div ref={ref} style={{ display:'grid',gridTemplateColumns:'1fr 48px 1fr',alignItems:'center',minHeight:120,gap:0 }}>
      {/* Left slot */}
      <div style={{ padding:'12px 36px 12px 0',display:'flex',justifyContent:'flex-end' }}>
        {left && (
          <motion.div
            initial={{ opacity:0,x:-36 }}
            animate={inView ? { opacity:1,x:0 } : {}}
            transition={{ duration:0.65,ease:[0.22,1,0.36,1],delay:0.1 }}
            style={{ maxWidth:320,padding:'18px 22px',borderRadius:18,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',backdropFilter:'blur(12px)',textAlign:'right' }}
          >
            <div style={{ fontSize:10.5,fontWeight:700,color:item.dot,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:7 }}>
              {item.q ? `${item.year} · ${item.q}` : item.year}
            </div>
            <div style={{ fontSize:16,fontWeight:800,color:'#FAFAFA',letterSpacing:'-0.025em',marginBottom:7 }}>{item.title}</div>
            <div style={{ fontSize:12.5,color:'rgba(226,232,240,0.46)',lineHeight:1.6 }}>{item.body}</div>
          </motion.div>
        )}
      </div>
      {/* Dot */}
      <div style={{ display:'flex',justifyContent:'center',alignItems:'center',position:'relative' }}>
        <motion.div
          initial={{ scale:0 }}
          animate={inView ? { scale:1 } : {}}
          transition={{ type:'spring',stiffness:460,damping:28,delay:0.05 }}
          style={{ width:14,height:14,borderRadius:'50%',background:item.dot,boxShadow:`0 0 24px ${item.dot}99`,zIndex:2,flexShrink:0 }}
        />
      </div>
      {/* Right slot */}
      <div style={{ padding:'12px 0 12px 36px',display:'flex',justifyContent:'flex-start' }}>
        {!left && (
          <motion.div
            initial={{ opacity:0,x:36 }}
            animate={inView ? { opacity:1,x:0 } : {}}
            transition={{ duration:0.65,ease:[0.22,1,0.36,1],delay:0.1 }}
            style={{ maxWidth:320,padding:'18px 22px',borderRadius:18,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',backdropFilter:'blur(12px)' }}
          >
            <div style={{ fontSize:10.5,fontWeight:700,color:item.dot,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:7 }}>
              {item.q ? `${item.year} · ${item.q}` : item.year}
            </div>
            <div style={{ fontSize:16,fontWeight:800,color:'#FAFAFA',letterSpacing:'-0.025em',marginBottom:7 }}>{item.title}</div>
            <div style={{ fontSize:12.5,color:'rgba(226,232,240,0.46)',lineHeight:1.6 }}>{item.body}</div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/** Team card */
function TeamCard({ m, i }: { m: typeof TEAM[0]; i: number }) {
  const ref  = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once:true, margin:'-60px' });
  return (
    <motion.div ref={ref}
      initial={{ opacity:0,y:32,scale:0.93 }}
      animate={seen ? { opacity:1,y:0,scale:1 } : {}}
      transition={{ type:'spring',stiffness:300,damping:28,delay:i*0.10 }}
      whileHover={{ y:-6, boxShadow:`0 24px 60px ${m.color}22, 0 4px 16px rgba(0,0,0,0.3)` }}
      style={{
        padding:'28px 24px',borderRadius:22,
        background:'rgba(255,255,255,0.04)',
        border:'1px solid rgba(255,255,255,0.08)',
        backdropFilter:'blur(16px)',
        display:'flex',flexDirection:'column',gap:14,
        transition:'box-shadow 0.3s',
        cursor:'default',
      }}
    >
      <div style={{
        width:56,height:56,borderRadius:'50%',
        background:`radial-gradient(circle,${m.color}28 0%,${m.color}08 70%)`,
        border:`2px solid ${m.color}44`,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:26,
        boxShadow:`0 0 32px ${m.color}44`,
      }}>{m.av}</div>
      <div>
        <div style={{ fontSize:16.5,fontWeight:800,color:'#FAFAFA',letterSpacing:'-0.025em' }}>{m.name}</div>
        <div style={{ fontSize:11,fontWeight:600,color:m.color,letterSpacing:'0.04em',textTransform:'uppercase',marginTop:3 }}>{m.role}</div>
      </div>
      <div style={{ fontSize:13,color:'rgba(226,232,240,0.48)',lineHeight:1.65,letterSpacing:'-0.005em' }}>{m.bio}</div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION COMPONENTS  (each needs its own hooks — cannot be IIFEs)
// ─────────────────────────────────────────────────────────────────────────────

function SectionProblem() {
  const ref  = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once:true, margin:'-80px' });
  return (
    <section ref={ref} style={{ padding:'120px 40px',background:'#06060F',position:'relative',overflow:'hidden' }}>
      <div style={{ maxWidth:1100,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:80,alignItems:'center' }}>
        <motion.div initial={{ opacity:0,x:-50 }} animate={seen ? { opacity:1,x:0 } : {}} transition={{ duration:0.85,ease:[0.22,1,0.36,1] }}>
          <div style={{ fontSize:11,fontWeight:700,color:'#FB7185',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:18 }}>The problem</div>
          <h2 style={{ fontSize:'clamp(2.4rem,5.5vw,4rem)',fontWeight:900,letterSpacing:'-0.05em',lineHeight:1.0,color:'#FAFAFA',margin:'0 0 24px' }}>
            The average traveler uses <span style={{ color:'#FB7185' }}>14 different apps</span> to book one trip.
          </h2>
          <p style={{ fontSize:15.5,color:'rgba(226,232,240,0.50)',lineHeight:1.72,letterSpacing:'-0.008em',margin:'0 0 32px' }}>
            14 logins. 14 different price formats. 14 separate loyalty programs. Hours lost comparing, cross-checking, second-guessing. The travel industry is fragmented by design — because fragmentation means fees.
          </p>
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
            {[{ n:'14',  t:'Apps per trip',          c:'#FB7185' },
              { n:'7h',   t:'Average planning time',  c:'#FBBF24' },
              { n:'$340', t:'Avg hidden fees exposed', c:'#34D399' },
            ].map(({ n, t, c }) => (
              <div key={t} style={{ display:'flex',alignItems:'center',gap:14 }}>
                <div style={{ fontSize:20,fontWeight:900,color:c,width:56,flexShrink:0,letterSpacing:'-0.04em' }}>{n}</div>
                <div style={{ fontSize:13,color:'rgba(226,232,240,0.45)',letterSpacing:'-0.01em' }}>{t}</div>
              </div>
            ))}
          </div>
        </motion.div>
        <motion.div initial={{ opacity:0,scale:0.85 }} animate={seen ? { opacity:1,scale:1 } : {}} transition={{ duration:1.0,ease:[0.22,1,0.36,1],delay:0.2 }} style={{ position:'relative',height:380,display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ position:'relative',zIndex:10,textAlign:'center' }}>
            <div style={{ fontSize:68,fontWeight:900,letterSpacing:'-0.06em',background:'linear-gradient(135deg,#60A5FA,#A78BFA)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',lineHeight:1 }}>ONE</div>
            <div style={{ fontSize:13,color:'rgba(226,232,240,0.45)',fontWeight:500,marginTop:4,letterSpacing:'0.04em' }}>Unitravel</div>
          </div>
          {CHAOS_ICONS.map((ic, i) => {
            const angle = (i / CHAOS_ICONS.length) * 360;
            const radius = 150 + (i % 3) * 22;
            const x = Math.cos((angle * Math.PI) / 180) * radius;
            const y = Math.sin((angle * Math.PI) / 180) * radius;
            return (
              <motion.div key={i} style={{ position:'absolute',fontSize:18,top:'50%',left:'50%',transform:`translate(${x}px,${y}px) translate(-50%,-50%)` }} animate={{ opacity:[0.25,0.55,0.25], scale:[0.92,1.06,0.92] }} transition={{ duration:3+i*0.22,repeat:Infinity,ease:'easeInOut',delay:i*0.18 }}>{ic}</motion.div>
            );
          })}
          <svg style={{ position:'absolute',inset:0,width:'100%',height:'100%',opacity:0.08 }}>
            {CHAOS_ICONS.map((_, i) => {
              const angle = (i / CHAOS_ICONS.length) * 360;
              const r = 150 + (i % 3) * 22;
              const cx = 50 + Math.cos((angle * Math.PI) / 180) * r / 3.8;
              const cy = 50 + Math.sin((angle * Math.PI) / 180) * r / 3.8;
              return <line key={i} x1="50%" y1="50%" x2={`${cx}%`} y2={`${cy}%`} stroke="#60A5FA" strokeWidth="1" />;
            })}
          </svg>
        </motion.div>
      </div>
    </section>
  );
}

function SectionNumbers() {
  const ref  = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once:true, margin:'-60px' });
  return (
    <section ref={ref} style={{ padding:'120px 40px',background:'linear-gradient(180deg,#06060F 0%,#08081A 100%)' }}>
      <div style={{ maxWidth:1100,margin:'0 auto' }}>
        <motion.div initial={{ opacity:0,y:30 }} animate={seen ? { opacity:1,y:0 } : {}} transition={{ duration:0.7,ease:[0.22,1,0.36,1] }} style={{ textAlign:'center',marginBottom:64 }}>
          <div style={{ fontSize:11,fontWeight:700,color:'#60A5FA',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:16 }}>Our mission targets</div>
          <h2 style={{ fontSize:'clamp(2.4rem,5vw,3.8rem)',fontWeight:900,letterSpacing:'-0.05em',color:'#FAFAFA',margin:0,lineHeight:1.05 }}>
            What we&apos;re building toward
          </h2>
          <p style={{ fontSize:12,color:'rgba(226,232,240,0.28)',marginTop:12,letterSpacing:'-0.005em' }}>
            Milestones that define our vision — tracked and updated as we grow.
          </p>
        </motion.div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16 }}>
          {STATS.map((s, i) => <StatCard key={s.label} s={s} delay={i * 0.09} />)}
        </div>
      </div>
    </section>
  );
}

function ManifestoHeader() {
  const ref  = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once:true, margin:'-80px' });
  return (
    <div ref={ref} style={{ padding:'100px 40px 60px',textAlign:'center' }}>
      <motion.div initial={{ opacity:0,y:24 }} animate={seen ? { opacity:1,y:0 } : {}} transition={{ duration:0.7 }}>
        <div style={{ fontSize:11,fontWeight:700,color:'#A78BFA',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:16 }}>What we believe</div>
        <h2 style={{ fontSize:'clamp(2rem,4.5vw,3.4rem)',fontWeight:900,letterSpacing:'-0.05em',color:'#FAFAFA',margin:0 }}>
          Our manifesto
        </h2>
      </motion.div>
    </div>
  );
}

function ValueCard({ v, i }: { v: typeof VALUES[0]; i: number }) {
  const r2 = useRef<HTMLDivElement>(null);
  const v2 = useInView(r2, { once:true, margin:'-60px' });
  const { Icon, c, bg, border, label, text } = v;
  return (
    <motion.div key={label} ref={r2}
      initial={{ opacity:0,y:32,scale:0.94 }}
      animate={v2 ? { opacity:1,y:0,scale:1 } : {}}
      transition={{ type:'spring',stiffness:300,damping:28,delay:i*0.11 }}
      whileHover={{ y:-5, boxShadow:`0 20px 56px ${c}18,0 4px 16px rgba(0,0,0,0.28)` }}
      style={{ padding:'32px 28px',borderRadius:22,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',backdropFilter:'blur(16px)',display:'flex',flexDirection:'column',gap:16,transition:'box-shadow 0.28s' }}
    >
      <div style={{ width:48,height:48,borderRadius:14,background:bg,border:`1px solid ${border}`,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 0 24px ${c}30` }}>
        <Icon size={22} color={c} strokeWidth={1.8} />
      </div>
      <div>
        <div style={{ fontSize:19,fontWeight:800,color:'#FAFAFA',letterSpacing:'-0.028em',marginBottom:8 }}>{label}</div>
        <div style={{ fontSize:14,color:'rgba(226,232,240,0.48)',lineHeight:1.68,letterSpacing:'-0.008em' }}>{text}</div>
      </div>
    </motion.div>
  );
}

function SectionValues() {
  const ref  = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once:true, margin:'-60px' });
  return (
    <section ref={ref} style={{ padding:'120px 40px',background:'#06060F' }}>
      <div style={{ maxWidth:1100,margin:'0 auto' }}>
        <motion.div initial={{ opacity:0,y:24 }} animate={seen ? { opacity:1,y:0 } : {}} transition={{ duration:0.7 }} style={{ textAlign:'center',marginBottom:64 }}>
          <div style={{ fontSize:11,fontWeight:700,color:'#34D399',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:16 }}>How we operate</div>
          <h2 style={{ fontSize:'clamp(2.4rem,5vw,3.8rem)',fontWeight:900,letterSpacing:'-0.05em',color:'#FAFAFA',margin:0,lineHeight:1.05 }}>
            Our values
          </h2>
        </motion.div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16 }}>
          {VALUES.map((v, i) => <ValueCard key={v.label} v={v} i={i} />)}
        </div>
      </div>
    </section>
  );
}

function SectionTimeline() {
  const ref  = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once:true, margin:'-60px' });
  return (
    <section style={{ padding:'120px 40px',background:'linear-gradient(180deg,#06060F 0%,#04040C 100%)' }}>
      <div style={{ maxWidth:900,margin:'0 auto' }}>
        <motion.div ref={ref} initial={{ opacity:0,y:24 }} animate={seen ? { opacity:1,y:0 } : {}} transition={{ duration:0.7 }} style={{ textAlign:'center',marginBottom:80 }}>
          <div style={{ fontSize:11,fontWeight:700,color:'#FBBF24',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:16 }}>How we got here</div>
          <h2 style={{ fontSize:'clamp(2.4rem,5vw,3.8rem)',fontWeight:900,letterSpacing:'-0.05em',color:'#FAFAFA',margin:0,lineHeight:1.05 }}>
            The journey
          </h2>
        </motion.div>
        <div style={{ position:'relative' }}>
          <div style={{ position:'absolute',left:'50%',top:0,bottom:0,width:2,background:'linear-gradient(180deg,transparent 0%,rgba(96,165,250,0.25) 15%,rgba(167,139,250,0.25) 85%,transparent 100%)',transform:'translateX(-50%)' }} />
          <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
            {TIMELINE.map((item, idx) => <TItem key={item.title} item={item} idx={idx} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionTeam() {
  const ref  = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once:true, margin:'-60px' });
  return (
    <section ref={ref} style={{ padding:'120px 40px',background:'#04040C' }}>
      <div style={{ maxWidth:1100,margin:'0 auto' }}>
        <motion.div initial={{ opacity:0,y:24 }} animate={seen ? { opacity:1,y:0 } : {}} transition={{ duration:0.7 }} style={{ textAlign:'center',marginBottom:64 }}>
          <div style={{ fontSize:11,fontWeight:700,color:'#FB7185',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:16 }}>The people</div>
          <h2 style={{ fontSize:'clamp(2.4rem,5vw,3.8rem)',fontWeight:900,letterSpacing:'-0.05em',color:'#FAFAFA',margin:'0 0 16px',lineHeight:1.05 }}>
            Built by travelers,<br />for travelers.
          </h2>
          <p style={{ fontSize:15,color:'rgba(226,232,240,0.44)',maxWidth:500,margin:'0 auto',lineHeight:1.68 }}>
            {"We've collectively visited 140+ countries, planned thousands of trips, and lost too many hours to bad booking experiences. That's why we built this."}
          </p>
        </motion.div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14 }}>
          {TEAM.map((m, i) => <TeamCard key={m.name} m={m} i={i} />)}
        </div>
      </div>
    </section>
  );
}

function SectionCTA() {
  const ref    = useRef<HTMLDivElement>(null);
  const seen   = useInView(ref, { once:true, margin:'-80px' });
  const router = useRouter();
  return (
    <section ref={ref} style={{ minHeight:'80vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'100px 40px',background:'#04040C',position:'relative',overflow:'hidden' }}>
      <div aria-hidden style={{ position:'absolute',inset:0,pointerEvents:'none' }}>
        <div style={{ position:'absolute',top:'10%',left:'15%',width:'70%',height:'70%',borderRadius:'50%',background:'radial-gradient(ellipse,rgba(59,130,246,0.10) 0%,rgba(139,92,246,0.07) 45%,transparent 70%)',filter:'blur(60px)',animation:'breathe 12s ease-in-out infinite' }} />
      </div>
      <motion.div initial={{ opacity:0,y:50,scale:0.96 }} animate={seen ? { opacity:1,y:0,scale:1 } : {}} transition={{ duration:1.0,ease:[0.22,1,0.36,1] }} style={{ textAlign:'center',maxWidth:720,position:'relative',zIndex:1 }}>
        <div style={{ fontSize:11,fontWeight:700,color:'#60A5FA',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:24 }}>Ready?</div>
        <h2 style={{ fontSize:'clamp(3rem,7vw,5.8rem)',fontWeight:900,letterSpacing:'-0.062em',lineHeight:0.90,background:'linear-gradient(140deg,#FFFFFF 0%,#E0E7FF 25%,#93C5FD 50%,#A78BFA 75%,#C084FC 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',margin:'0 0 24px' }}>
          Plan your journey.
        </h2>
        <p style={{ fontSize:'clamp(1rem,2.1vw,1.22rem)',fontWeight:300,color:'rgba(226,232,240,0.50)',lineHeight:1.70,margin:'0 0 52px' }}>
          151+ search engines. Zero hidden fees. One AI that works for you.<br />
          Join 14,000+ travelers who&apos;ve planned smarter.
        </p>
        <div style={{ display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap' }}>
          <motion.button onClick={() => router.push('/')} whileHover={{ scale:1.04,y:-3,boxShadow:'0 0 80px rgba(59,130,246,0.40),0 20px 50px rgba(37,99,235,0.30)' }} whileTap={{ scale:0.975 }} style={{ display:'flex',alignItems:'center',gap:8,padding:'14px 30px',borderRadius:100,background:'linear-gradient(138deg,#2563EB 0%,#4F46E5 55%,#7C3AED 100%)',border:'1px solid rgba(255,255,255,0.18)',cursor:'pointer',fontFamily:'inherit',fontSize:14,fontWeight:700,color:'#fff',letterSpacing:'-0.01em',boxShadow:'0 0 60px rgba(59,130,246,0.28),0 12px 36px rgba(37,99,235,0.22),inset 0 1.5px 0 rgba(255,255,255,0.20)' }}>
            <Sparkles size={14} color="#fff" strokeWidth={2} />
            Start planning
            <ArrowRight size={14} color="#fff" strokeWidth={2.5} />
          </motion.button>
          <motion.button onClick={() => router.push('/')} whileHover={{ scale:1.04,y:-3 }} whileTap={{ scale:0.975 }} style={{ display:'flex',alignItems:'center',gap:8,padding:'14px 28px',borderRadius:100,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.14)',backdropFilter:'blur(16px)',cursor:'pointer',fontFamily:'inherit',fontSize:14,fontWeight:600,color:'rgba(255,255,255,0.78)',letterSpacing:'-0.01em',boxShadow:'inset 0 1px 0 rgba(255,255,255,0.08)' }}>
            Build your own trip
          </motion.button>
        </div>
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Story() {
  const router = useRouter();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div style={{ position:'fixed',inset:0,zIndex:9999,overflowY:'auto',overflowX:'hidden',background:'#04040C',fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,system-ui,sans-serif" }}>

      {/* ── Sticky nav ───────────────────────────────────────────────── */}
      <nav style={{ position:'sticky',top:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 32px',background:'rgba(4,4,12,0.82)',backdropFilter:'blur(24px)',borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:9 }}>
          <div style={{ width:26,height:26,borderRadius:8,background:'linear-gradient(135deg,#3B82F6,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 18px rgba(59,130,246,0.55)' }}>
            <Sparkles size={12} color="#fff" strokeWidth={2.2} />
          </div>
          <span style={{ fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.45)',letterSpacing:'0.12em',textTransform:'uppercase' }}>Unitravel · Our story</span>
        </div>
        <motion.button
          onClick={() => router.back()}
          whileHover={{ scale:1.05, background:'rgba(255,255,255,0.10)' }}
          whileTap={{ scale:0.95 }}
          style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 16px',borderRadius:100,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.10)',cursor:'pointer',fontFamily:'inherit' }}
        >
          <span style={{ fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.55)' }}>← Back</span>
        </motion.button>
      </nav>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — CINEMATIC HERO
          ══════════════════════════════════════════════════════════════ */}
      <section style={{ minHeight:'100vh',position:'relative',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 40px 60px',overflow:'hidden' }}>
        {/* Animated gradient blobs */}
        <div aria-hidden style={{ position:'absolute',inset:0,pointerEvents:'none' }}>
          <div style={{ position:'absolute',top:'-20%',left:'-10%',width:'65%',height:'65%',borderRadius:'50%',background:'radial-gradient(ellipse,rgba(59,130,246,0.16) 0%,transparent 65%)',animation:'breathe 18s ease-in-out infinite' }} />
          <div style={{ position:'absolute',top:'-10%',right:'-5%',width:'50%',height:'55%',borderRadius:'50%',background:'radial-gradient(ellipse,rgba(139,92,246,0.12) 0%,transparent 65%)',animation:'breathe 22s ease-in-out infinite',animationDelay:'7s' }} />
          <div style={{ position:'absolute',bottom:'-15%',left:'20%',width:'60%',height:'50%',borderRadius:'50%',background:'radial-gradient(ellipse,rgba(6,182,212,0.07) 0%,transparent 65%)',animation:'liquid-drift 26s ease-in-out infinite',animationDelay:'12s' }} />
        </div>

        <motion.div
          initial={{ opacity:0,y:-16 }}
          animate={{ opacity:1,y:0 }}
          transition={{ duration:0.8,ease:[0.22,1,0.36,1] }}
          style={{ display:'flex',alignItems:'center',gap:8,marginBottom:40,padding:'5px 16px 5px 8px',borderRadius:100,background:'rgba(59,130,246,0.10)',border:'1px solid rgba(59,130,246,0.24)',boxShadow:'0 0 28px rgba(59,130,246,0.14)' }}
        >
          <div style={{ width:20,height:20,borderRadius:7,background:'linear-gradient(135deg,#3B82F6,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 10px rgba(59,130,246,0.50)' }}>
            <Sparkles size={10} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize:11,fontWeight:700,color:'#93C5FD',letterSpacing:'0.06em',textTransform:'uppercase' }}>The story behind Unitravel</span>
        </motion.div>

        <motion.h1
          initial={{ opacity:0,y:56,filter:'blur(22px)' }}
          animate={{ opacity:1,y:0,filter:'blur(0px)' }}
          transition={{ duration:1.2,ease:[0.22,1,0.36,1],delay:0.18 }}
          style={{ fontSize:'clamp(3.4rem,9vw,8rem)',fontWeight:900,letterSpacing:'-0.055em',lineHeight:0.92,textAlign:'center',margin:'0 0 28px',background:'linear-gradient(142deg,#FFFFFF 0%,rgba(255,255,255,0.86) 25%,#93C5FD 50%,#A78BFA 74%,#F0ABFC 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',maxWidth:920 }}
        >
          Travel planning is broken.<br />{"We're fixing it."}
        </motion.h1>

        <motion.p
          initial={{ opacity:0,y:30 }}
          animate={{ opacity:1,y:0 }}
          transition={{ duration:0.95,ease:[0.22,1,0.36,1],delay:0.48 }}
          style={{ fontSize:'clamp(1rem,2.2vw,1.28rem)',fontWeight:300,color:'rgba(226,232,240,0.52)',textAlign:'center',maxWidth:660,lineHeight:1.72,letterSpacing:'-0.012em',margin:'0 0 72px' }}
        >
          {"Unitravel is the world's first AI travel operating system — connecting 151+ live search engines into a single, radically transparent intelligence. No hidden fees. No switching apps. Just the best results, instantly."}
        </motion.p>

        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.1 }}
          style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:5 }}
        >
          <span style={{ fontSize:10.5,fontWeight:600,color:'rgba(255,255,255,0.22)',letterSpacing:'0.14em',textTransform:'uppercase' }}>Scroll to explore</span>
          <motion.div animate={{ y:[0,7,0] }} transition={{ duration:2.1,repeat:Infinity,ease:'easeInOut' }}>
            <ChevronDown size={18} color="rgba(255,255,255,0.22)" />
          </motion.div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — THE PROBLEM (fragmentation)
          ══════════════════════════════════════════════════════════════ */}
      <SectionProblem />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — BY THE NUMBERS
          ══════════════════════════════════════════════════════════════ */}
      <SectionNumbers />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 4 — MANIFESTO (scroll-revealed beliefs)
          ══════════════════════════════════════════════════════════════ */}
      <section style={{ background:'#04040C',borderTop:'1px solid rgba(255,255,255,0.05)',borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <ManifestoHeader />
        {BELIEFS.map((b, i) => <BeliefPanel key={b.n} b={b} i={i} />)}
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 5 — VALUES
          ══════════════════════════════════════════════════════════════ */}
      <SectionValues />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 6 — TIMELINE
          ══════════════════════════════════════════════════════════════ */}
      <SectionTimeline />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 7 — TEAM
          ══════════════════════════════════════════════════════════════ */}
      <SectionTeam />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 8 — FINAL CTA
          ══════════════════════════════════════════════════════════════ */}
      <SectionCTA />

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer style={{ padding:'28px 40px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <div style={{ width:22,height:22,borderRadius:7,background:'linear-gradient(135deg,#3B82F6,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <Sparkles size={10} color="#fff" strokeWidth={2.2} />
          </div>
          <span style={{ fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.30)',letterSpacing:'-0.01em' }}>Unitravel © 2026</span>
        </div>
        <span style={{ fontSize:12,color:'rgba(255,255,255,0.20)',letterSpacing:'-0.005em' }}>{"The world's travel engines, unified in one intelligence."}</span>
      </footer>

    </div>,
    document.body,
  );
}
