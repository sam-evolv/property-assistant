/**
 * Welcome screen — cinematic handover moment, shown once.
 * 4-phase animation: dark → house → text → button.
 * Window illumination ramps over ~2.8s with ease-out curve.
 * AsyncStorage flag: oh_select_welcomed
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
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
} from 'react-native-svg';
import { C, IC, DURATION } from '../tokens';
import { Icon } from '../components/Icon';

/* ── House SVG (same as HomeScreen, extracted for welcome) ──────────── */
function HouseSVG({ windowGlow }: { windowGlow: number }) {
  const w = windowGlow;
  return (
    <Svg viewBox="0 0 390 400" preserveAspectRatio="xMidYMax meet" style={{ width: '100%', height: '100%' }}>
      <Defs>
        <LinearGradient id="whWall" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="rgba(255,255,255,0.17)" />
          <Stop offset="60%" stopColor="rgba(255,255,255,0.10)" />
          <Stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
        </LinearGradient>
        <LinearGradient id="whRoof" x1="0.15" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="rgba(210,220,240,0.26)" />
          <Stop offset="100%" stopColor="rgba(170,180,200,0.12)" />
        </LinearGradient>
        <RadialGradient id="wwWarm" cx="50%" cy="50%" r="55%">
          <Stop offset="0%" stopColor={`rgba(255,185,60,${w * 0.90})`} />
          <Stop offset="60%" stopColor={`rgba(240,145,30,${w * 0.50})`} />
          <Stop offset="100%" stopColor={`rgba(200,100,10,${w * 0.05})`} />
        </RadialGradient>
        <RadialGradient id="wgAtm" cx="50%" cy="0%" r="80%">
          <Stop offset="0%" stopColor="rgba(212,175,55,0.20)" />
          <Stop offset="100%" stopColor="transparent" />
        </RadialGradient>
      </Defs>

      {/* Stars */}
      {[[55,18,1],[115,8,.7],[195,28,.7],[285,12,1],[345,22,.7],[75,40,.7],[168,14,1],[248,36,.7],[310,5,1],[165,50,.7]].map(([x,y,r],i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill="rgba(255,255,255,0.45)" opacity={0.4} />
      ))}

      <Ellipse cx={195} cy={392} rx={200} ry={22} fill="url(#wgAtm)" />

      {/* Garage */}
      <Rect x={290} y={248} width={88} height={142} rx={2} fill="rgba(255,255,255,0.08)" />
      <Rect x={292} y={250} width={84} height={138} rx={1} fill="rgba(4,4,10,0.82)" />
      {[0,1,2,3,4,5].map(n => (
        <Line key={n} x1={292} y1={268+n*17} x2={376} y2={268+n*17} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}

      {/* Body */}
      <Rect x={58} y={198} width={242} height={192} rx={2} fill="url(#whWall)" />
      <Line x1={58} y1={198} x2={58} y2={390} stroke="rgba(255,255,255,0.13)" strokeWidth={1} />
      <Line x1={300} y1={198} x2={300} y2={390} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

      {/* Roof */}
      <Polygon points="40,200 179,80 320,200" fill="url(#whRoof)" />
      <Line x1={40} y1={200} x2={320} y2={200} stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
      <Ellipse cx={179} cy={80} rx={3} ry={2} fill="rgba(255,255,255,0.25)" />

      {/* Chimney */}
      <Rect x={254} y={102} width={26} height={62} rx={1} fill="rgba(255,255,255,0.18)" />
      <Rect x={251} y={97} width={32} height={8} rx={1} fill="rgba(255,255,255,0.24)" />

      {/* Left window */}
      <Rect x={76} y={222} width={68} height={52} rx={3} fill="rgba(4,4,10,0.94)" />
      <Rect x={77} y={223} width={66} height={50} rx={2.5} fill="url(#wwWarm)" />
      <Line x1={110} y1={222} x2={110} y2={274} stroke="rgba(0,0,0,0.50)" strokeWidth={2.5} />
      <Line x1={76} y1={248} x2={144} y2={248} stroke="rgba(0,0,0,0.50)" strokeWidth={2.5} />
      <Rect x={76} y={222} width={68} height={52} rx={3} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      <Rect x={76} y={222} width={68} height={52} rx={3} fill="none" stroke={`rgba(255,180,50,${w*0.30})`} strokeWidth={1} />

      {/* Right window */}
      <Rect x={194} y={222} width={68} height={52} rx={3} fill="rgba(4,4,10,0.94)" />
      <Rect x={195} y={223} width={66} height={50} rx={2.5} fill="url(#wwWarm)" />
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

      {/* Solar */}
      <G opacity={0.72}>
        <Rect x={108} y={124} width={48} height={28} rx={2} fill={C.g} opacity={0.48} />
        <Line x1={132} y1={124} x2={132} y2={152} stroke="rgba(4,4,10,0.55)" strokeWidth={1.2} />
        <Line x1={108} y1={138} x2={156} y2={138} stroke="rgba(4,4,10,0.55)" strokeWidth={1.2} />
        <Rect x={162} y={107} width={48} height={28} rx={2} fill={C.g} opacity={0.42} />
        <Line x1={186} y1={107} x2={186} y2={135} stroke="rgba(4,4,10,0.55)" strokeWidth={1.2} />
        <Line x1={162} y1={121} x2={210} y2={121} stroke="rgba(4,4,10,0.55)" strokeWidth={1.2} />
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

export default function WelcomeScreen({ onEnter }: { onEnter: () => void }) {
  const [phase, setPhase] = useState(0);
  const [windowGlow, setWindowGlow] = useState(0);
  const exitAnim = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => {
      let start: number | null = null;
      const animate = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / DURATION.welcome, 1);
        setWindowGlow(1 - Math.pow(1 - p, 2.2));
        if (p < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, 600);
    const t3 = setTimeout(() => setPhase(2), 1200);
    const t4 = setTimeout(() => setPhase(3), 2400);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, []);

  const handleEnter = () => {
    Animated.parallel([
      Animated.timing(exitAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.timing(exitScale, { toValue: 1.04, duration: 700, useNativeDriver: true }),
    ]).start(() => onEnter());
  };

  return (
    <Animated.View style={[styles.root, { opacity: exitAnim, transform: [{ scale: exitScale }] }]}>
      {/* Night atmosphere */}
      <View style={styles.atmosphere} />

      {/* House — top 60% */}
      <Animated.View style={[styles.houseWrap, {
        opacity: phase >= 1 ? 1 : 0,
      }]}>
        <HouseSVG windowGlow={windowGlow} />
        <View style={styles.houseFade} />
      </Animated.View>

      {/* Content at bottom */}
      <View style={styles.content}>
        {/* Builder credit */}
        <Animated.View style={[styles.creditRow, { opacity: phase >= 2 ? 1 : 0 }]}>
          <View style={styles.creditLine} />
          <Text style={styles.creditText}>Sigma Homes · December 2024</Text>
        </Animated.View>

        {/* Welcome text */}
        <Animated.View style={{ opacity: phase >= 2 ? 1 : 0, marginBottom: 6 }}>
          <Text style={styles.welcomeSmall}>Welcome home,</Text>
          <Text style={styles.welcomeName}>Sarah.</Text>
        </Animated.View>

        {/* Address in gold */}
        <Animated.View style={{ opacity: phase >= 2 ? 1 : 0, marginBottom: 28 }}>
          <Text style={styles.addressGold}>14 Innishmore Rise</Text>
          <Text style={styles.addressSub}>Ballincollig, Cork</Text>
        </Animated.View>

        {/* Enter button */}
        <Animated.View style={{ opacity: phase >= 3 ? 1 : 0, width: '100%' }}>
          <TouchableOpacity style={styles.enterBtn} onPress={handleEnter} activeOpacity={0.85}>
            <View style={styles.enterBadge}>
              <Icon d={IC.key} size={19} color={C.bg} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.enterTitle}>Enter your home</Text>
              <Text style={styles.enterSub}>Your home is ready</Text>
            </View>
            <Icon d={IC.chevR} size={18} color={C.g} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 300,
    backgroundColor: C.bg,
  },
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#100C04',
  },
  houseWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  houseFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'rgba(5,5,10,0.85)',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingBottom: 44,
  },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  creditLine: { width: 24, height: 1.5, backgroundColor: C.g },
  creditText: { fontSize: 10, fontWeight: '700', color: C.g, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.8 },
  welcomeSmall: { fontSize: 13, fontWeight: '600', color: C.t2, letterSpacing: 0.5, marginBottom: 10 },
  welcomeName: { fontSize: 56, fontWeight: '900', color: C.t1, letterSpacing: -2.8, lineHeight: 50 },
  addressGold: { fontSize: 22, fontWeight: '700', color: C.g, letterSpacing: -0.44 },
  addressSub: { fontSize: 12.5, color: C.t2, marginTop: 5, letterSpacing: 0.25 },
  enterBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 17,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: C.gB2,
    borderRadius: 22,
    shadowColor: C.g,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  enterBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.g,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.g,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  enterTitle: { fontSize: 15, fontWeight: '700', color: C.t1, letterSpacing: -0.15, marginBottom: 2 },
  enterSub: { fontSize: 11.5, color: C.t2 },
});
