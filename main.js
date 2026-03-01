import { encode } from "uqr";

const MODULE_SIZE = 6;
const DOT_SIZE = 2;
const DOT_POS = (MODULE_SIZE - DOT_SIZE) / 2;

const SN = 0.05;

/* ---- */

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

/* ---- */

const img = new Image();
const text = document.getElementById("text");

const gen = () => {
  const { data, size } = encode(text.value, {
    ecc: "H",
    border: 1,
  });

  const canvas = document.getElementById("render");
  canvas.width = size * MODULE_SIZE;
  canvas.height = size * MODULE_SIZE;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  /* render background */
  ctx.drawImage(
    img,
    0, 0, img.naturalWidth, img.naturalHeight,
    0, 0, canvas.width, canvas.height,
  );
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  dither(imageData.data, canvas.width, canvas.height);
  /* add noise */
  for (let x = 0; x < canvas.width; x++) {
    for (let y = 0; y < canvas.height; y++) {
      if (Math.random() < SN) {
        const ix = (y * canvas.width + x) * 4;
        const val = imageData.data[ix + 0];
        imageData.data[ix + 0] = val ? 0 : 255;
        imageData.data[ix + 1] = val ? 0 : 255;
        imageData.data[ix + 2] = val ? 0 : 255;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);

  /* render QR */
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const isFinder = x < 8 && (y < 8 || size - y <= 8) || (size - x <= 8 && y < 8);
      const isBorder = x < 1 || y < 1 || size - x <= 1 || size - y <= 1;
      const dotted = !isFinder && !isBorder;
      ctx.fillStyle = data[y][x] ? "#000" : "#fff";
      ctx.fillRect(
        x * MODULE_SIZE + (dotted ? DOT_POS : 0),
        y * MODULE_SIZE + (dotted ? DOT_POS : 0),
        dotted ? DOT_SIZE : MODULE_SIZE,
        dotted ? DOT_SIZE : MODULE_SIZE,
      );
    }
  }
};

/* ---- */

img.addEventListener("load", gen);
text.addEventListener("input", gen);

document.getElementById("img").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => img.src = e.target.result;
  reader.readAsDataURL(file);
});
