/**
 * Local Fallback FFT Module (Cooley-Tukey Radix-2)
 * Mimics the fft.js interface so it can be swapped in transparently if CDN is offline.
 */

window.LocalFFT = class FFT {
    constructor(N) {
        if ((N & (N - 1)) !== 0) {
            throw new Error("FFT size must be a power of 2");
        }
        this.N = N;
    }

    createComplexArray() {
        return new Float64Array(this.N * 2);
    }

    transform(out, input) {
        const re = new Float64Array(this.N);
        const im = new Float64Array(this.N);

        // Unpack interleaved input array
        for (let i = 0; i < this.N; i++) {
            re[i] = input[2 * i];
            im[i] = input[2 * i + 1];
        }

        this._fft(re, im, false);

        // Pack interleaved output array
        for (let i = 0; i < this.N; i++) {
            out[2 * i] = re[i];
            out[2 * i + 1] = im[i];
        }
    }

    inverseTransform(out, input) {
        const re = new Float64Array(this.N);
        const im = new Float64Array(this.N);

        // Unpack interleaved input array
        for (let i = 0; i < this.N; i++) {
            re[i] = input[2 * i];
            im[i] = input[2 * i + 1];
        }

        this._fft(re, im, true);

        // Pack interleaved output array
        for (let i = 0; i < this.N; i++) {
            out[2 * i] = re[i];
            out[2 * i + 1] = im[i];
        }
    }

    _fft(re, im, invert) {
        const n = this.N;

        // 1. Bit-reversal permutation
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) {
                j ^= bit;
            }
            j ^= bit;
            if (i < j) {
                let temp = re[i]; re[i] = re[j]; re[j] = temp;
                temp = im[i]; im[i] = im[j]; im[j] = temp;
            }
        }

        // 2. Cooley-Tukey butterfly stages
        for (let len = 2; len <= n; len <<= 1) {
            const ang = (2 * Math.PI / len) * (invert ? -1 : 1);
            const wRe = Math.cos(ang);
            const wIm = Math.sin(ang);

            for (let i = 0; i < n; i += len) {
                let curRe = 1.0;
                let curIm = 0.0;

                for (let j = 0; j < len / 2; j++) {
                    const uRe = re[i + j];
                    const uIm = im[i + j];

                    // Complex multiply: v = input[i + j + len/2] * w^j
                    const targetRe = re[i + j + len / 2];
                    const targetIm = im[i + j + len / 2];
                    const vRe = targetRe * curRe - targetIm * curIm;
                    const vIm = targetRe * curIm + targetIm * curRe;

                    // Butterfly addition/subtraction
                    re[i + j] = uRe + vRe;
                    im[i + j] = uIm + vIm;

                    re[i + j + len / 2] = uRe - vRe;
                    im[i + j + len / 2] = uIm - vIm;

                    // Rotate phase w^j * w
                    const nextCurRe = curRe * wRe - curIm * wIm;
                    curIm = curRe * wIm + curIm * wRe;
                    curRe = nextCurRe;
                }
            }
        }

        // 3. IFFT normalization
        if (invert) {
            for (let i = 0; i < n; i++) {
                re[i] /= n;
                im[i] /= n;
            }
        }
    }
};
