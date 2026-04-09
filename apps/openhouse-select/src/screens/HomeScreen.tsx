/**
 * Home screen — full-bleed house SVG, time-of-day sky, window glow animation,
 * day counter, AI CTA. This is the hero screen of the app.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Polygon,
  Ellipse,
  Line,
  Circle,
  Path,
  G,
  Filter,
  FeGaussianBlur,
} from 'react-native-svg';
import { C, getSkyConfig, getDaysHome, DURATION, IC, TYPE } from '../tokens';
import { Icon } from '../components/Icon';

const { width: SCREEN_W } = Dimensions.get('window');

/* ── House SVG ─────────────────────────────────────────────────────────── */
function HouseSVG({ windowGlow }: { windowGlow: number }) {
  const w = windowGlow;
  return (
    <Svg viewBox="0 0 390 400" preserveAspectRatio="xMidYMax meet" style={{ width: '100%', height: '100%' }}>
      <Defs>
        <LinearGradient id="hWall" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="rgba(255,255,255,0.17)" />
          <Stop offset="60%" stopColor="rgba(255,255,255,0.10)" />
          <Stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
        </LinearGradient>
        <LinearGradient id="hRoof" x1="0.15" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="rgba(210,220,240,0.26)" />
          <Stop offset="100%" stopColor="rgba(170,180,200,0.12)" />
        </LinearGradient>
        <RadialGradient id="wWarm" cx="50%" cy="50%" r="55%">
          <Stop offset="0%" stopColor={`rgba(255,185,60,${w * 0.90})`} />
          <Stop offset="60%" stopColor={`rgba(240,145,30,${w * 0.50})`} />
          <Stop offset="100%" stopColor={`rgba(200,100,10,${w * 0.05})`} />
        </RadialGradient>
        <RadialGradient id="gAtm" cx="50%" cy="0%" r="80%">
          <Stop offset="0%" stopColor="rgba(212,175,55,0.20)" />
          <Stop offset="100%" stopColor="transparent" />
        </RadialGradient>
      </Defs>

      {/* Stars */}
      {[[55,18,1],[115,8,.7],[195,28,.7],[285,12,1],[345,22,.7],[75,40,.7],[168,14,1],[248,36,.7],[310,5,1],[165,50,.7]].map(([x,y,r],i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill="rgba(255,255,255,0.45)" opacity={0.4} />
      ))}

      <Ellipse cx={195} cy={392} rx={200} ry={22} fill="url(#gAtm)" />

      {/* Garage */}
      <Rect x={290} y={248} width={88} height={142} rx={2} fill="rgba(255,255,255,0.08)" />
      <Rect x={292} y={250} width={84} height={138} rx={1} fill="rgba(4,4,10,0.82)" />
      {[0,1,2,3,4,5].map(n => (
        <Line key={n} x1={292} y1={268+n*17} x2={376} y2={268+n*17} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}

      {/* Body */}
      <Rect x={58} y={198} width={242} height={192} rx={2} fill="url(#hWall)" />
      <Line x1={58} y1={198} x2={58} y2={390} stroke="rgba(255,255,255,0.13)" strokeWidth={1} />
      <Line x1={300} y1={198} x2={300} y2={390} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

      {/* Roof */}
      <Polygon points="40,200 179,80 320,200" fill="url(#hRoof)" />
      <Line x1={40} y1={200} x2={320} y2={200} stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
      <Ellipse cx={179} cy={80} rx={3} ry={2} fill="rgba(255,255,255,0.25)" />

      {/* Chimney */}
      <Rect x={254} y={102} width={26} height={62} rx={1} fill="rgba(255,255,255,0.18)" />
      <Rect x={251} y={97} width={32} height={8} rx={1} fill="rgba(255,255,255,0.24)" />

      {/* Left window */}
      <Rect x={76} y={222} width={68} height={52} rx={3} fill="rgba(4,4,10,0.94)" />
      <Rect x={77} y={223} width={66} height={50} rx={2.5} fill="url(#wWarm)" />
      <Line x1={110} y1={222} x2={110} y2={274} stroke="rgba(0,0,0,0.50)" strokeWidth={2.5} />
      <Line x1={76} y1={248} x2={144} y2={248} stroke="rgba(0,0,0,0.50)" strokeWidth={2.5} />
      <Rect x={76} y={222} width={68} height={52} rx={3} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      <Rect x={76} y={222} width={68} height={52} rx={3} fill="none" stroke={`rgba(255,180,50,${w*0.30})`} strokeWidth={1} />

      {/* Right window */}
      <Rect x={194} y={222} width={68} height={52} rx={3} fill="rgba(4,4,10,0.94)" />
      <Rect x={195} y={223} width={66} height={50} rx={2.5} fill="url(#wWarm)" />
      <Line x1={228} y1={222} x2={228} y2={274} stroke="rgba(0,0,0,0.50)" strokeWidth={2.5} />
      <Line x1={194} y1={248} x2={262} y2={248} stroke="rgba(0,0,0,0.50)" strokeWidth={2.5} />
      <Rect x={194} y={222} width={68} height={52} rx={3} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      <Rect x={194} y={222} width={68} height={52} rx={3} fill="none" stroke={`rgba(255,180,50,${w*0.26})`} strokeWidth={1} />

      {/* Door */}
      <Rect x={157} y={286} width={64} height={104} rx={4} fill="rgba(4,4,10,0.95)" />
      <Path d="M157 316 Q189 292 221 316" fill={`rgba(212,175,55,${0.04+w*0.04})`} stroke={`rgba(212,175,55,${0.20+w*0.15})`} strokeWidth={1} />
      <Rect x={161} y={320} width={22} height={28} rx={2} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
      <Rect x={189} y={320} width={22} height={28} rx={2} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
      <Circle cx={208} cy={340} r={3.5} fill={C.g} opacity={0.5+w*0.35} />

      {/* Solar panels */}
      <G opacity={0.72}>
        <Rect x={108} y={124} width={48} height={28} rx={2} fill={C.g} opacity={0.48} />
        <Line x1={132} y1={124} x2={132} y2={152} stroke="rgba(4,4,10,0.55)" strokeWidth={1.2} />
        <Line x1={108} y1={138} x2={156} y2={138} stroke="rgba(4,4,10,0.55)" strokeWidth={1.2} />
        <Rect x={108} y={124} width={48} height={7} rx={2} fill="rgba(255,255,255,0.08)" />
        <Rect x={162} y={107} width={48} height={28} rx={2} fill={C.g} opacity={0.42} />
        <Line x1={186} y1={107} x2={186} y2={135} stroke="rgba(4,4,10,0.55)" strokeWidth={1.2} />
        <Line x1={162} y1={121} x2={210} y2={121} stroke="rgba(4,4,10,0.55)" strokeWidth={1.2} />
        <Rect x={162} y={107} width={48} height={7} rx={2} fill="rgba(255,255,255,0.06)" />
      </G>

      {/* Trees */}
      <Ellipse cx={18} cy={288} rx={17} ry={30} fill="rgba(255,255,255,0.075)" />
      <Rect x={15} y={315} width={5} height={22} fill="rgba(255,255,255,0.075)" />
      <Ellipse cx={378} cy={296} rx={14} ry={24} fill="rgba(255,255,255,0.06)" />
      <Rect x={375} y={318} width={5} height={18} fill="rgba(255,255,255,0.06)" />

      {/* Path */}
      <Polygon points="157,390 221,390 238,400 140,400" fill="rgba(255,255,255,0.055)" />
    </Svg>
  );
}

/* ── Badge (gold radial) ──────────────────────────────────────────────── */
function Badge({ size = 44, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <View style={[styles.badge, {
      width: size, height: size, borderRadius: size / 2,
      shadowRadius: pulse ? 15 : 9,
    }]}>
      <Icon d={IC.spark} size={Math.round(size * 0.42)} color={C.bg} strokeWidth={2.4} />
    </View>
  );
}

/* ── Main Component ───────────────────────────────────────────────────── */
export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const sky = getSkyConfig();
  const days = getDaysHome();
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';

  // Window glow animation
  const [windowGlow, setWindowGlow] = useState(sky.windowGlowBase);
  const glowAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in content
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: DURATION.reveal,
      useNativeDriver: true,
    }).start();

    // Window glow ramp — ease-out over 2.2s
    const base = sky.windowGlowBase;
    const target = base + (1 - base) * 0.4;
    let start: number | null = null;
    const dur = DURATION.window;

    const animate = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 2.2);
      setWindowGlow(base + (target - base) * eased);
      if (p < 1) requestAnimationFrame(animate);
    };
    const t = setTimeout(() => requestAnimationFrame(animate), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: sky.bgStops.colors[0] }]}>
      {/* House — full bleed, top 62% */}
      <View style={styles.houseContainer}>
        <HouseSVG windowGlow={windowGlow} />
        {/* Fade-to-dark gradient overlay */}
        <View style={styles.houseFade} />
      </View>

      {/* Content anchored to bottom */}
      <Animated.View style={[styles.content, { opacity: fadeIn, paddingBottom: 20 }]}>
        {/* Overline */}
        <View style={styles.overlineRow}>
          <View style={styles.overlineLine} />
          <Text style={styles.overlineText}>{greet}, Sarah</Text>
        </View>

        {/* Address — monumental */}
        <View style={{ marginBottom: 5 }}>
          <Text style={styles.addressMain}>14 Innishmore</Text>
          <Text style={styles.addressGold}>Rise.</Text>
        </View>

        {/* Day counter */}
        <View style={styles.dayRow}>
          <Text style={styles.dayCount}>Day {days.toLocaleString()}</Text>
          <Text style={styles.dayMeta}> · Ballincollig · Sigma Homes</Text>
        </View>

        {/* Metadata */}
        <Text style={styles.meta}>December 2024 · BER A2</Text>

        {/* Live status pills */}
        <View style={styles.statusRow}>
          {[{ c: C.grn, label: 'Solar · 3.1 kW' }, { c: C.blu, label: 'Heat pump' }].map((s, i) => (
            <View key={i} style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: s.c, shadowColor: s.c }]} />
              <Text style={styles.statusLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* AI CTA */}
        <TouchableOpacity
          style={styles.aiCta}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('AI')}
        >
          <Badge size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.aiCtaTitle}>Ask your home anything</Text>
            <Text style={styles.aiCtaSub}>Specs · warranties · contacts · systems</Text>
          </View>
          <View style={styles.aiCtaChevron}>
            <Icon d={IC.chevR} size={13} color={C.t2} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
  },
  houseContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '62%',
    overflow: 'hidden',
  },
  houseFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    // Approximate gradient with layered opacity
    backgroundColor: 'rgba(4,4,10,0.80)',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  overlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  overlineLine: {
    width: 24,
    height: 1.5,
    backgroundColor: C.g,
  },
  overlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.g,
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.84,
  },
  addressMain: {
    fontSize: 52,
    fontWeight: '900',
    color: C.t1,
    letterSpacing: -2.5,
    lineHeight: 48,
  },
  addressGold: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -2.5,
    lineHeight: 48,
    color: C.g, // Full gold gradient requires MaskedView — use solid gold for now
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  dayCount: {
    fontSize: 13.5,
    fontWeight: '700',
    color: C.t2,
    letterSpacing: -0.13,
  },
  dayMeta: {
    fontSize: 11,
    color: C.t3,
    letterSpacing: 1.2,
    opacity: 0.6,
  },
  meta: {
    fontSize: 11.5,
    color: C.t3,
    letterSpacing: 0.2,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.glMid,
    borderWidth: 1,
    borderColor: C.b2,
    borderRadius: 22,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  statusLabel: {
    fontSize: 11.5,
    color: C.t1,
    fontWeight: '500',
  },
  aiCta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(6,6,14,0.84)',
    borderWidth: 1,
    borderColor: C.gB,
    borderRadius: 20,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  badge: {
    backgroundColor: C.g,
    alignItems: 'center',
    justifyContent: 'center',
    // Gold glow
    shadowColor: C.g,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 9,
    elevation: 6,
  },
  aiCtaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.t1,
    letterSpacing: -0.14,
    marginBottom: 3,
  },
  aiCtaSub: {
    fontSize: 11.5,
    color: C.t2,
  },
  aiCtaChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.s4,
    borderWidth: 1,
    borderColor: C.b1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
