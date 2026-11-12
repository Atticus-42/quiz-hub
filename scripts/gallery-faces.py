#!/usr/bin/env python
"""Propose gallery thumbnail focus points from detected faces (YuNet via OpenCV).

Gallery tiles crop to 4:5 (portrait) or 4:3 (landscape) using CSS object-position
(the "focus" field in data/gallery.json). This script detects faces in each item's
image (or video poster) and picks the focus that keeps the faces inside the crop.

Setup (the model is NOT committed; ~230 KB, from OpenCV Zoo):
  curl -L -o face_detection_yunet_2023mar.onnx https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
  pip install opencv-python numpy

Usage (from the repo root; keep the model outside the repo):
  python scripts/gallery-faces.py PATH/TO/face_detection_yunet_2023mar.onnx --report
  python scripts/gallery-faces.py PATH/TO/face_detection_yunet_2023mar.onnx --write
  then: node scripts/build.mjs && node scripts/verify.mjs
Options: --only ID [ID ...] limits to some items; --sheet DIR writes side-by-side
simulated-crop images (current vs proposed, faces boxed) for items that differ by
more than 10 points AND visibly move the crop (>5% of its size), so a person can judge which framing is better before --write.

Items with no detected face keep their current (hand-set) focus. Only the axis
that is actually cropped is changed; the other axis keeps its current value.
Review the report: group shots where faces span more than the crop are centred on
the largest cluster, and hand-set values that already frame faces well can be kept.
"""
import argparse
import json
import os

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data', 'gallery.json')


def item_image(it):
    rel = it.get('poster') or it.get('src1600') or it.get('src800')
    return os.path.join(ROOT, rel.split('?')[0])


def iou(a, b):
    ax2, ay2, bx2, by2 = a[0] + a[2], a[1] + a[3], b[0] + b[2], b[1] + b[3]
    iw = max(0, min(ax2, bx2) - max(a[0], b[0]))
    ih = max(0, min(ay2, by2) - max(a[1], b[1]))
    inter = iw * ih
    return inter / (a[2] * a[3] + b[2] * b[3] - inter + 1e-9)


def detect(det, img, thr=0.6):
    """Faces as (x, y, w, h) in original pixels; native scale plus 2x upscale for small faces."""
    found = []
    for scale in (1.0, 2.0):
        im = img if scale == 1.0 else cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        det.setInputSize((im.shape[1], im.shape[0]))
        det.setScoreThreshold(thr)
        _, faces = det.detect(im)
        for f in (faces if faces is not None else []):
            x, y, fw, fh = (float(v) / scale for v in f[:4])
            if fw < 8 or fh < 8:
                continue
            found.append((x, y, fw, fh, float(f[-1])))
    found.sort(key=lambda f: -f[4])
    keep = []
    for f in found:
        if all(iou(f, k) < 0.4 for k in keep):
            keep.append(f)
    return [k[:4] for k in keep]


def pick_center(spans, crop):
    """spans: [(lo, hi, weight)] along the cropped axis. Centre of all faces if they fit the crop, else of the heaviest cluster that does."""
    lo = min(s[0] for s in spans)
    hi = max(s[1] for s in spans)
    if hi - lo <= crop:
        return (lo + hi) / 2
    spans = sorted(spans)
    best = None
    for i in range(len(spans)):
        end = spans[i][1]
        score = spans[i][2]
        for s in spans[i + 1:]:
            if max(end, s[1]) - spans[i][0] <= crop:
                end = max(end, s[1])
                score += s[2]
        if best is None or score > best[0]:
            best = (score, (spans[i][0] + end) / 2)
    return best[1]


def propose(it, faces, W, H):
    tile = 0.8 if H > W else 4 / 3
    cur = it['focus'].replace('%', '').split()
    fx, fy = float(cur[0]), float(cur[1])
    if W / H > tile:  # crop horizontally
        cw = H * tile
        c = pick_center([(x, x + w, w * h) for x, y, w, h in faces], cw)
        fx = min(100, max(0, (c - cw / 2) / (W - cw) * 100))
    elif W / H < tile:  # crop vertically
        ch = W / tile
        c = pick_center([(y, y + h, w * h) for x, y, w, h in faces], ch)
        fy = min(100, max(0, (c - ch / 2) / (H - ch) * 100))
    return f'{round(fx)}% {round(fy)}%', tile


def sheet(it, img, faces, new, tile, out):
    """Side-by-side simulated crops: current focus (left) vs proposed (right), faces boxed."""
    H, W = img.shape[:2]
    panels = []
    for label, foc in (('current ' + it['focus'], it['focus']), ('proposed ' + new, new)):
        px, py = (float(v.strip('%')) / 100 for v in foc.split())
        if W / H > tile:
            cw, ch = H * tile, H
        else:
            cw, ch = W, W / tile
        x0, y0 = int(round((W - cw) * px)), int(round((H - ch) * py))
        im = img.copy()
        for x, y, w, h in faces:
            cv2.rectangle(im, (int(x), int(y)), (int(x + w), int(y + h)), (0, 255, 0), max(2, W // 400))
        crop = im[y0:y0 + int(ch), x0:x0 + int(cw)]
        crop = cv2.resize(crop, (480, int(480 / tile)))
        cv2.putText(crop, label, (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
        panels.append(crop)
    cv2.imwrite(out, np.hstack(panels))


def main():
    ap = argparse.ArgumentParser(description='Propose gallery focus points from detected faces.')
    ap.add_argument('model')
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--report', action='store_true')
    g.add_argument('--write', action='store_true')
    ap.add_argument('--only', nargs='+')
    ap.add_argument('--sheet')
    ap.add_argument('--threshold', type=float, default=0.6)
    a = ap.parse_args()

    det = cv2.FaceDetectorYN.create(a.model, '', (320, 320), a.threshold, 0.3, 5000)
    data = json.load(open(DATA, encoding='utf-8'))
    changed = nofaces = withfaces = 0
    if a.sheet:
        os.makedirs(a.sheet, exist_ok=True)
    for it in data['photos']:
        if a.only and it['id'] not in a.only:
            continue
        img = cv2.imread(item_image(it))
        if img is None:
            print(f"{it['id']}: image unreadable")
            continue
        H, W = img.shape[:2]
        faces = detect(det, img, a.threshold)
        if not faces:
            nofaces += 1
            print(f"{it['id']}: no faces, keeping {it['focus']}")
            continue
        withfaces += 1
        new, tile = propose(it, faces, W, H)
        cx = [float(v.strip('%')) for v in it['focus'].split()]
        nx = [float(v.strip('%')) for v in new.split()]
        diff = max(abs(cx[0] - nx[0]), abs(cx[1] - nx[1]))
        # Visible effect: how far the crop window moves, as a percent of the crop size
        # (a big point change is invisible when the image barely overflows the tile).
        if W / H > tile:
            move = abs(cx[0] - nx[0]) / 100 * (W - H * tile) / (H * tile) * 100
        else:
            move = abs(cx[1] - nx[1]) / 100 * (H - W / tile) / (W / tile) * 100
        if new != it['focus']:
            big = diff > 10 and move > 5
            flag = ' **REVIEW**' if big else ''
            print(f"{it['id']}: {len(faces)} faces, {it['focus']} -> {new} (d={diff:.0f}pt, crop moves {move:.0f}%){flag}")
            if big and a.sheet:
                sheet(it, img, faces, new, tile, os.path.join(a.sheet, it['id'] + '.jpg'))
        if a.write and new != it['focus']:
            it['focus'] = new
            changed += 1
    print(f'faces detected in {withfaces} items, none in {nofaces}; focus {"changed" if a.write else "would change"}: ' + (str(changed) if a.write else 'see lines above'))
    if a.write:
        with open(DATA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')


if __name__ == '__main__':
    main()
