// AudioWorklet processor: taps channel 0 and posts ~1024-frame Float32
// blocks to the main thread (which meters, resamples and feeds the Speech
// SDK push stream). Loaded via audioWorklet.addModule(); not an ES module
// import — keep it dependency-free.

class PcmTapProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(1024);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      let read = 0;
      while (read < channel.length) {
        const n = Math.min(channel.length - read, this.buffer.length - this.offset);
        this.buffer.set(channel.subarray(read, read + n), this.offset);
        this.offset += n;
        read += n;
        if (this.offset === this.buffer.length) {
          this.port.postMessage(this.buffer.slice());
          this.offset = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('pcm-tap', PcmTapProcessor);
