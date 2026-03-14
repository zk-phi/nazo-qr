import { encode } from "uqr";
import "./style.css";

const DITHER_THRESHOLD = 128;

/* Floyd-steinberg dithering */
export const dither = (arr, width, height) => {
  const err = (new Array(width * height)).fill(0);
  for (let y = 0; y < height; y += 1) {
    if (y % 2 === 0) { // iterate from left to right
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        const ave = (arr[index * 4 + 0] + arr[index * 4 + 1] + arr[index * 4 + 2]) / 3;
        const value = ave + (err[index] ?? 0);
        let newErr = 0;
        if (value < DITHER_THRESHOLD) {
          arr[index * 4 + 0] = 0;
          arr[index * 4 + 1] = 0;
          arr[index * 4 + 2] = 0;
          newErr = value;
        } else {
          arr[index * 4 + 0] = 255;
          arr[index * 4 + 1] = 255;
          arr[index * 4 + 2] = 255;
          newErr = value - 255;
        }
        if (x + 1 < width) err[y * width + (x + 1)] += newErr * 7 / 16;
        if (y + 1 < height) {
          if (x - 1 >= 0) err[(y + 1) * width + (x - 1)] += newErr * 3 / 16;
          err[(y + 1) * width + x] += newErr * 5 / 16;
          if (x + 1 < width) err[(y + 1) * width + (x + 1)] += newErr * 1 / 16;
        }
      }
    } else { // iterate from right to left
      for (let x = width - 1; x >= 0; x -= 1) {
        const index = y * width + x;
        const ave = (arr[index * 4 + 0] + arr[index * 4 + 1] + arr[index * 4 + 2]) / 3;
        const value = ave + (err[index] ?? 0);
        let newErr = 0;
        if (value < DITHER_THRESHOLD) {
          arr[index * 4 + 0] = 0;
          arr[index * 4 + 1] = 0;
          arr[index * 4 + 2] = 0;
          newErr = value;
        } else {
          arr[index * 4 + 0] = 255;
          arr[index * 4 + 1] = 255;
          arr[index * 4 + 2] = 255;
          newErr = value - 255;
        }
        if (x - 1 >= 0) err[y * width + (x - 1)] += newErr * 7 / 16;
        if (y + 1 < height) {
          if (x + 1 < width) err[(y + 1) * width + (x + 1)] += newErr * 3 / 16;
          err[(y + 1) * width + x] += newErr * 5 / 16;
          if (x - 1 >= 0) err[(y + 1) * width + (x - 1)] += newErr * 1 / 16;
        }
      }
    }
  }
};

/* Dither, binarize img and add noise. */
const makeFilteredImage = (img, width, height, sn) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, width, height);

  const data = ctx.getImageData(0, 0, width, height);
  dither(data.data, width, height);

  /* add noise */
  const numNoise = width * height * sn;
  for (let i = 0; i < numNoise; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const ix = (y * width + x) * 4;
    const val = data.data[ix + 0];
    data.data[ix + 0] = val ? 0 : 255;
    data.data[ix + 1] = val ? 0 : 255;
    data.data[ix + 2] = val ? 0 : 255;
  }

  ctx.putImageData(data, 0, 0);
  return canvas;
};

/* ---- */

const img = new Image();
const textEl = document.getElementById("text");
const moduleSizeEl = document.getElementById("moduleSize");
const dotSizeEl = document.getElementById("dotSize");
const snEl = document.getElementById("sn");

const moduleSizeLabel = document.getElementById("val-moduleSize");
const dotSizeLabel = document.getElementById("val-dotSize");
const snLabel = document.getElementById("val-sn");

const gen = () => {
  /* update labels */
  moduleSizeLabel.textContent = moduleSizeEl.value;
  dotSizeLabel.textContent = dotSizeEl.value;
  snLabel.textContent = snEl.value;

  /* normalize values */
  const text = textEl.value;
  const moduleSize = Number(moduleSizeEl.value);
  const dotSize = Math.min(Number(dotSizeEl.value), moduleSize);
  const dotPos = Math.floor((moduleSize - dotSize) / 2);
  const sn = Number(snEl.value);

  const { data, size } = encode(text, {
    ecc: "H",
    border: 1,
  });

  const canvas = document.getElementById("render");
  canvas.width = size * moduleSize;
  canvas.height = size * moduleSize;

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  /* render background */
  const bgSize = (size - 2) * moduleSize;
  const smallBgSize = Math.floor(bgSize / dotSize);
  const bg = makeFilteredImage(img, smallBgSize, smallBgSize, sn);
  ctx.drawImage(bg, 0, 0, smallBgSize, smallBgSize, moduleSize, moduleSize, bgSize, bgSize);

  /* render QR */
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const isFinder = x < 8 && (y < 8 || size - y <= 8) || (size - x <= 8 && y < 8);
      const isBorder = x < 1 || y < 1 || size - x <= 1 || size - y <= 1;
      const dotted = !isFinder && !isBorder;
      ctx.fillStyle = data[y][x] ? "#000" : "#fff";
      ctx.fillRect(
        x * moduleSize + (dotted ? dotPos : 0),
        y * moduleSize + (dotted ? dotPos : 0),
        dotted ? dotSize : moduleSize,
        dotted ? dotSize : moduleSize,
      );
    }
  }
};

/* ---- */

img.addEventListener("load", gen);
textEl.addEventListener("input", gen);
moduleSizeEl.addEventListener("input", gen);
dotSizeEl.addEventListener("input", gen);
snEl.addEventListener("input", gen);

document.getElementById("img").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => img.src = e.target.result;
  reader.readAsDataURL(file);
});

gen();
