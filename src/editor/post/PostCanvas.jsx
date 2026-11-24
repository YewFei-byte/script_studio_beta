import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Image as KImage, Label, Layer, Line, Rect, Stage, Tag, Text, Transformer } from 'react-konva';
import { fontPairById } from '../../../shared/brand.js';
import { SIZES, resolveColor } from './design';

// Draws one page of a post design with Konva. Coordinates in the design are
// fractions; here they're multiplied by the platform size (e.g. 1080x1350)
// and the whole stage is scaled down to fit the screen. `editable` adds
// drag / resize / rotate; `onReady` fires once fonts and images are loaded
// (export waits for it, so PNGs never use a fallback font or miss a photo).
// Hidden layers aren't drawn (or exported); locked ones can't be moved.
// While dragging, a layer snaps to the canvas and other layers' edges and
// centres (hold Alt to place it freely). `measureRef.current(id)` gives a
// layer's on-canvas box in fractions, for the align buttons.

const SNAP_PX = 7; // screen pixels

// Our own images are loaded by path so the canvas stays same-origin and can
// be exported (a cross-origin image would "taint" it).
function sameOriginUrl(url) {
  try {
    const u = new URL(url, window.location.href);
    if (u.pathname.startsWith('/api/')) return u.pathname;
  } catch {
    /* data: URLs etc. */
  }
  return url;
}

function useImage(url) {
  const [state, setState] = useState({ img: null, status: url ? 'loading' : 'none' });
  useEffect(() => {
    if (!url) { setState({ img: null, status: 'none' }); return undefined; }
    let alive = true;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => alive && setState({ img, status: 'loaded' });
    img.onerror = () => alive && setState({ img: null, status: 'failed' });
    setState({ img: null, status: 'loading' });
    img.src = sameOriginUrl(url);
    return () => { alive = false; };
  }, [url]);
  return state;
}

// Several images at once (picture layers), keyed by url.
function useImages(urls) {
  const key = [...new Set(urls.filter(Boolean))].sort().join('|');
  const [map, setMap] = useState({});
  useEffect(() => {
    const list = key ? key.split('|') : [];
    let alive = true;
    setMap((m) => Object.fromEntries(list.map((u) => [u, m[u] || { img: null, status: 'loading' }])));
    list.forEach((u) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => alive && setMap((m) => ({ ...m, [u]: { img, status: 'loaded' } }));
      img.onerror = () => alive && setMap((m) => ({ ...m, [u]: { img: null, status: 'failed' } }));
      img.src = sameOriginUrl(u);
    });
    return () => { alive = false; };
  }, [key]);
  return map;
}

function useFonts(fontPair) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const pair = fontPairById(fontPair);
    const id = `post-fonts-${pair.id}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${pair.families}&family=Noto+Sans+SC:wght@500;700&display=swap`;
      document.head.appendChild(link);
    }
    setReady(false);
    let alive = true;
    Promise.all([
      document.fonts.load(`700 40px "${pair.display}"`),
      document.fonts.load(`500 40px "${pair.body}"`),
      document.fonts.load(`700 40px "${pair.body}"`),
    ])
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, [fontPair]);
  return ready;
}

// Cover-crop: fill the canvas with the photo, cropping whichever side is too long.
function coverCrop(img, W, H) {
  const r = Math.max(W / img.width, H / img.height);
  const cw = W / r;
  const ch = H / r;
  return { x: (img.width - cw) / 2, y: (img.height - ch) / 2, width: cw, height: ch };
}

function Overlay({ overlay, W, H, colors }) {
  if (!overlay) return null;
  const color = resolveColor(overlay.color, colors);
  if (overlay.gradient) {
    const top = overlay.gradient === 'top';
    return (
      <Rect x={0} y={0} width={W} height={H} listening={false}
        fillLinearGradientStartPoint={{ x: 0, y: top ? 0 : H }} fillLinearGradientEndPoint={{ x: 0, y: top ? H * 0.75 : H * 0.25 }}
        fillLinearGradientColorStops={[0, color, 1, 'rgba(0,0,0,0)']} opacity={Math.min(1, overlay.opacity * 2)} />
    );
  }
  return <Rect x={0} y={0} width={W} height={H} fill={color} opacity={overlay.opacity} listening={false} />;
}

export default function PostCanvas({ design, pageIndex = 0, brand, scale = 1, editable = false, selectedId, onSelect, onChangeLayer, onEditText, onReady, stageRef, measureRef }) {
  const size = SIZES[design.size] || SIZES.square;
  const W = size.w;
  const H = size.h;
  const page = design.pages[pageIndex] || design.pages[0];
  const colors = brand?.colors || {};
  const font = fontPairById(brand?.fontPair);
  const fontsReady = useFonts(brand?.fontPair);
  const bg = useImage(page?.background?.url);
  const logo = useImage(brand?.logoUrl);
  const pictures = useImages((page?.layers || []).filter((l) => l.type === 'image').map((l) => l.url));
  const picturesLoading = (page?.layers || []).some((l) => l.type === 'image' && l.url && (pictures[l.url]?.status ?? 'loading') === 'loading');
  const nodes = useRef({});
  const trRef = useRef(null);
  const layerRef = useRef(null);
  const [guides, setGuides] = useState([]);

  const ready = fontsReady && bg.status !== 'loading' && logo.status !== 'loading' && !picturesLoading;
  useEffect(() => { if (ready) onReady?.(); }, [ready, onReady]);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodes.current[selectedId] : null;
    tr.nodes(node?.getStage() ? [node] : []); // a hidden layer's old node is no longer on the stage
    tr.getLayer()?.batchDraw();
  }, [selectedId, page, ready]);

  const selectedLayer = page?.layers.find((l) => l.id === selectedId);

  // A layer's bounding box on the canvas (in design pixels), if it's drawn.
  const boxOf = (id) => {
    const n = nodes.current[id];
    return n?.getStage() && layerRef.current ? n.getClientRect({ relativeTo: layerRef.current }) : null;
  };
  if (measureRef) {
    measureRef.current = (id) => {
      const b = boxOf(id);
      return b && { x: b.x / W, y: b.y / H, w: b.width / W, h: b.height / H };
    };
  }

  const snap = (l, e) => {
    const node = e.target;
    if (e.evt?.altKey) { setGuides([]); return; }
    const me = boxOf(l.id);
    if (!me) return;
    const vs = [0, W / 2, W];
    const hs = [0, H / 2, H];
    page.layers.forEach((o) => {
      if (o.id === l.id || o.hidden) return;
      const b = boxOf(o.id);
      if (!b) return;
      vs.push(b.x, b.x + b.width / 2, b.x + b.width);
      hs.push(b.y, b.y + b.height / 2, b.y + b.height);
    });
    const limit = SNAP_PX / scale;
    const best = (edges, targets) => {
      let hit = null;
      edges.forEach((edge) => targets.forEach((t) => {
        const d = t - edge;
        if (Math.abs(d) <= limit && (!hit || Math.abs(d) < Math.abs(hit.d))) hit = { d, pos: t };
      }));
      return hit;
    };
    const v = best([me.x, me.x + me.width / 2, me.x + me.width], vs);
    const h = best([me.y, me.y + me.height / 2, me.y + me.height], hs);
    if (v) node.x(node.x() + v.d);
    if (h) node.y(node.y() + h.d);
    setGuides([...(v ? [{ id: 'v', points: [v.pos, 0, v.pos, H] }] : []), ...(h ? [{ id: 'h', points: [0, h.pos, W, h.pos] }] : [])]);
  };
  const crop = useMemo(() => (bg.img ? coverCrop(bg.img, W, H) : null), [bg.img, W, H]);

  const common = (l) => ({
    ref: (n) => { if (n) nodes.current[l.id] = n; },
    draggable: editable && !l.locked,
    onMouseDown: () => editable && onSelect?.(l.id),
    onTap: () => editable && onSelect?.(l.id),
    onDragMove: (e) => editable && snap(l, e),
    onDragEnd: (e) => { setGuides([]); onChangeLayer?.(l.id, { x: e.target.x() / W, y: e.target.y() / H }); },
    onTransformEnd: (e) => {
      const n = e.target;
      const sx = n.scaleX();
      const sy = n.scaleY();
      n.scaleX(1);
      n.scaleY(1);
      const patch = { x: n.x() / W, y: n.y() / H, rotation: n.rotation() };
      if (l.type === 'text') patch.w = Math.max(0.08, (l.w * W * sx) / W);
      else if (l.type === 'logo' || l.type === 'image') patch.w = Math.max(0.04, l.w * sx);
      else if (l.shape === 'circle') patch.w = Math.max(0.03, l.w * Math.max(sx, sy));
      else { patch.w = Math.max(0.02, l.w * sx); patch.h = Math.max(0.01, l.h * sy); }
      onChangeLayer?.(l.id, patch);
    },
  });

  const renderLayer = (l) => {
    if (l.hidden) return null;
    const rot = l.rotation || 0;
    if (l.type === 'text') {
      const fam = l.font === 'body' ? font.body : font.display;
      const textProps = {
        text: l.text || ' ',
        width: l.w * W,
        fontSize: l.size * W,
        fontFamily: `"${fam}", "Noto Sans SC", sans-serif`,
        fontStyle: l.weight >= 600 ? 'bold' : 'normal',
        fill: resolveColor(l.color, colors),
        align: l.align || 'left',
        lineHeight: l.lineHeight || 1.15,
        wrap: 'word',
      };
      if (l.bg) {
        return (
          <Label key={l.id} x={l.x * W} y={l.y * H} rotation={rot} {...common(l)} onDblClick={() => onEditText?.(l.id)} onDblTap={() => onEditText?.(l.id)}>
            <Tag fill={resolveColor(l.bg, colors)} cornerRadius={l.radius >= 99 ? (l.size * W + (l.pad || 0) * W * 2) / 2 : (l.radius || 0) * W} />
            <Text {...textProps} padding={(l.pad || 0) * W} />
          </Label>
        );
      }
      return <Text key={l.id} x={l.x * W} y={l.y * H} rotation={rot} {...textProps} {...common(l)} onDblClick={() => onEditText?.(l.id)} onDblTap={() => onEditText?.(l.id)} />;
    }
    if (l.type === 'logo') {
      if (!logo.img) return null;
      const w = l.w * W;
      return <KImage key={l.id} image={logo.img} x={l.x * W} y={l.y * H} width={w} height={(w * logo.img.height) / logo.img.width} rotation={rot} {...common(l)} />;
    }
    if (l.type === 'image') {
      const pic = pictures[l.url]?.img;
      if (!pic) return null;
      const w = l.w * W;
      const h = (w * pic.height) / pic.width;
      const r = l.radius >= 99 ? Math.min(w, h) / 2 : (l.radius || 0) * W;
      return <KImage key={l.id} image={pic} x={l.x * W} y={l.y * H} width={w} height={h} cornerRadius={r} opacity={l.opacity ?? 1} rotation={rot} {...common(l)} />;
    }
    if (l.type === 'shape') {
      const fill = resolveColor(l.fill, colors);
      if (l.shape === 'circle') {
        const d = l.w * W;
        // Circle draws from its centre; keep x/y as the top-left like everything else.
        return (
          <Group key={l.id} x={l.x * W} y={l.y * H} rotation={rot} {...common(l)}>
            <Circle x={d / 2} y={d / 2} radius={d / 2} fill={fill} opacity={l.opacity ?? 1} />
            <Rect width={d} height={d} fill="transparent" />
          </Group>
        );
      }
      const w = l.w * W;
      const h = l.h * H;
      const r = l.radius >= 99 ? Math.min(w, h) / 2 : (l.radius || 0) * W;
      return <Rect key={l.id} x={l.x * W} y={l.y * H} width={w} height={h} cornerRadius={r} fill={fill} opacity={l.opacity ?? 1} rotation={rot} {...common(l)} />;
    }
    return null;
  };

  return (
    <Stage ref={stageRef} width={W * scale} height={H * scale} scaleX={scale} scaleY={scale}
      onMouseDown={(e) => { if (editable && e.target === e.target.getStage()) onSelect?.(null); }}
      style={{ background: '#e9e6e1' }}>
      <Layer ref={layerRef}>
        {bg.img && crop ? (
          <KImage image={bg.img} x={0} y={0} width={W} height={H} crop={crop} listening={editable} onMouseDown={() => editable && onSelect?.(null)} />
        ) : (
          <Rect x={0} y={0} width={W} height={H} fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: W, y: H }}
            fillLinearGradientColorStops={[0, resolveColor('accent', colors), 1, resolveColor('primary', colors)]} onMouseDown={() => editable && onSelect?.(null)} />
        )}
        <Overlay overlay={page?.background?.overlay} W={W} H={H} colors={colors} />
        {fontsReady && page?.layers.map(renderLayer)}
        {editable && guides.map((g) => (
          <Line key={g.id} points={g.points} stroke="#F2AA24" strokeWidth={1.5 / scale} dash={[6 / scale, 4 / scale]} listening={false} />
        ))}
        {editable && (
          <Transformer ref={trRef} rotateEnabled={!selectedLayer?.locked} resizeEnabled={!selectedLayer?.locked}
            keepRatio={selectedLayer?.type === 'logo' || selectedLayer?.type === 'image' || selectedLayer?.shape === 'circle'}
            enabledAnchors={selectedLayer?.type === 'text' ? ['middle-left', 'middle-right'] : ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
            anchorSize={10 / scale > 30 ? 30 : Math.max(10, 10 / scale)} borderStroke="#F2AA24" anchorStroke="#F2AA24" anchorCornerRadius={3} />
        )}
      </Layer>
    </Stage>
  );
}
