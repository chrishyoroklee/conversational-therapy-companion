#!/usr/bin/env python3
"""
NPU vs CPU benchmark for the Conversational Therapy Companion.

Runs ASR (Whisper) and LLM (Qwen / llama-cpp) through both the NPU and CPU
backends, measuring latency, throughput, and resource usage.

Usage:
    python benchmark.py                        # full benchmark
    python benchmark.py --rounds 5             # 5 rounds per test
    python benchmark.py --skip-asr             # LLM only
    python benchmark.py --skip-llm             # ASR only
    python benchmark.py --audio test.wav       # custom audio file for ASR
"""

import argparse
import os
import sys
import time
import wave
import struct
import statistics
import textwrap

import numpy as np
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Resource monitor (optional — uses psutil if available)
# ---------------------------------------------------------------------------

_HAS_PSUTIL = False
try:
    import psutil

    _HAS_PSUTIL = True
except ImportError:
    pass

import threading


class ResourceMonitor:
    """Sample CPU% and memory in a background thread while a block runs."""

    def __init__(self, interval: float = 0.25):
        self.interval = interval
        self.cpu_samples: list[float] = []
        self.mem_samples: list[float] = []
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self):
        if not _HAS_PSUTIL:
            return
        self._stop.clear()
        self.cpu_samples.clear()
        self.mem_samples.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> dict:
        if not _HAS_PSUTIL or self._thread is None:
            return {}
        self._stop.set()
        self._thread.join(timeout=2)
        if not self.cpu_samples:
            return {}
        return {
            "cpu_avg": statistics.mean(self.cpu_samples),
            "cpu_peak": max(self.cpu_samples),
            "mem_avg_mb": statistics.mean(self.mem_samples),
            "mem_peak_mb": max(self.mem_samples),
        }

    def _run(self):
        proc = psutil.Process(os.getpid())
        while not self._stop.is_set():
            self.cpu_samples.append(proc.cpu_percent(interval=self.interval))
            self.mem_samples.append(proc.memory_info().rss / (1024 * 1024))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def generate_test_audio(path: str, duration_s: float = 3.0, sr: int = 16000):
    """Generate a short 16-bit mono WAV with a 440 Hz tone for ASR testing."""
    n_samples = int(sr * duration_s)
    t = np.linspace(0, duration_s, n_samples, dtype=np.float32)
    tone = (0.5 * np.sin(2 * np.pi * 440 * t) * 32767).astype(np.int16)
    with wave.open(path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(tone.tobytes())
    return path


def fmt_ms(seconds: float) -> str:
    return f"{seconds * 1000:.1f} ms"


def fmt_pct(value: float) -> str:
    return f"{value:.1f}%"


# ---------------------------------------------------------------------------
# Benchmark runners
# ---------------------------------------------------------------------------

def benchmark_asr(rounds: int, audio_path: str):
    """Benchmark ASR on both backends. Returns dict of results."""
    from qnn_utils import is_npu_available

    results = {}
    monitor = ResourceMonitor()

    # --- CPU backend ---
    print("\n  Loading CPU (faster-whisper) backend...", flush=True)
    try:
        from asr import _CPUTranscriber

        cpu_asr = _CPUTranscriber()

        # Warmup
        cpu_asr.transcribe(audio_path)

        latencies = []
        for i in range(rounds):
            monitor.start()
            t0 = time.perf_counter()
            text = cpu_asr.transcribe(audio_path)
            elapsed = time.perf_counter() - t0
            res = monitor.stop()
            latencies.append(elapsed)
            print(f"    CPU round {i + 1}/{rounds}: {fmt_ms(elapsed)}  \"{text[:60]}\"",
                  flush=True)

        results["cpu"] = {
            "latencies": latencies,
            "mean": statistics.mean(latencies),
            "median": statistics.median(latencies),
            "stdev": statistics.stdev(latencies) if len(latencies) > 1 else 0,
            "min": min(latencies),
            "max": max(latencies),
            **res,
        }
        del cpu_asr
    except Exception as e:
        print(f"    CPU backend failed: {e}", flush=True)
        results["cpu"] = None

    # --- NPU backend ---
    if not is_npu_available():
        print("\n  NPU not available — skipping NPU ASR benchmark", flush=True)
        results["npu"] = None
    else:
        print("\n  Loading NPU (ONNX+QNN) backend...", flush=True)
        try:
            from asr import _NPUTranscriber

            npu_asr = _NPUTranscriber()

            # Warmup
            npu_asr.transcribe(audio_path)

            latencies = []
            for i in range(rounds):
                monitor.start()
                t0 = time.perf_counter()
                text = npu_asr.transcribe(audio_path)
                elapsed = time.perf_counter() - t0
                res = monitor.stop()
                latencies.append(elapsed)
                print(f"    NPU round {i + 1}/{rounds}: {fmt_ms(elapsed)}  \"{text[:60]}\"",
                      flush=True)

            results["npu"] = {
                "latencies": latencies,
                "mean": statistics.mean(latencies),
                "median": statistics.median(latencies),
                "stdev": statistics.stdev(latencies) if len(latencies) > 1 else 0,
                "min": min(latencies),
                "max": max(latencies),
                **res,
            }
            del npu_asr
        except Exception as e:
            print(f"    NPU backend failed: {e}", flush=True)
            results["npu"] = None

    return results


def benchmark_llm(rounds: int):
    """Benchmark LLM on both backends. Returns dict of results."""
    from qnn_utils import is_npu_available

    test_prompts = [
        "I've been feeling really overwhelmed at work lately.",
        "I had an argument with my friend and I feel guilty about it.",
        "Sometimes I wonder if I'm making the right life choices.",
    ]

    results = {}
    monitor = ResourceMonitor()

    # --- CPU backend ---
    print("\n  Loading CPU (llama-cpp) backend...", flush=True)
    try:
        from llm import _CPUChatModel

        cpu_llm = _CPUChatModel()

        # Warmup
        cpu_llm.chat("Hello")
        cpu_llm.history.clear()

        latencies = []
        tok_per_sec = []
        for i in range(rounds):
            prompt = test_prompts[i % len(test_prompts)]
            monitor.start()
            t0 = time.perf_counter()
            response = cpu_llm.chat(prompt)
            elapsed = time.perf_counter() - t0
            res = monitor.stop()
            latencies.append(elapsed)
            # Rough token estimate: split on whitespace
            n_tokens = len(response.split())
            tps = n_tokens / elapsed if elapsed > 0 else 0
            tok_per_sec.append(tps)
            print(f"    CPU round {i + 1}/{rounds}: {fmt_ms(elapsed)}  "
                  f"~{n_tokens} tok  ({tps:.1f} tok/s)", flush=True)

        results["cpu"] = {
            "latencies": latencies,
            "mean": statistics.mean(latencies),
            "median": statistics.median(latencies),
            "stdev": statistics.stdev(latencies) if len(latencies) > 1 else 0,
            "min": min(latencies),
            "max": max(latencies),
            "tok_per_sec_avg": statistics.mean(tok_per_sec),
            **res,
        }
        del cpu_llm
    except Exception as e:
        print(f"    CPU backend failed: {e}", flush=True)
        results["cpu"] = None

    # --- NPU backend ---
    if not is_npu_available():
        print("\n  NPU not available — skipping NPU LLM benchmark", flush=True)
        results["npu"] = None
    else:
        print("\n  Loading NPU (onnxruntime-genai + QNN) backend...", flush=True)
        try:
            from llm import _NPUChatModel

            npu_llm = _NPUChatModel()

            # Warmup
            npu_llm.chat("Hello")
            npu_llm.history.clear()

            latencies = []
            tok_per_sec = []
            for i in range(rounds):
                prompt = test_prompts[i % len(test_prompts)]
                monitor.start()
                t0 = time.perf_counter()
                response = npu_llm.chat(prompt)
                elapsed = time.perf_counter() - t0
                res = monitor.stop()
                latencies.append(elapsed)
                n_tokens = len(response.split())
                tps = n_tokens / elapsed if elapsed > 0 else 0
                tok_per_sec.append(tps)
                print(f"    NPU round {i + 1}/{rounds}: {fmt_ms(elapsed)}  "
                      f"~{n_tokens} tok  ({tps:.1f} tok/s)", flush=True)

            results["npu"] = {
                "latencies": latencies,
                "mean": statistics.mean(latencies),
                "median": statistics.median(latencies),
                "stdev": statistics.stdev(latencies) if len(latencies) > 1 else 0,
                "min": min(latencies),
                "max": max(latencies),
                "tok_per_sec_avg": statistics.mean(tok_per_sec),
                **res,
            }
            del npu_llm
        except Exception as e:
            print(f"    NPU backend failed: {e}", flush=True)
            results["npu"] = None

    return results


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def print_comparison(label: str, results: dict):
    """Print a side-by-side comparison table for one module."""
    cpu = results.get("cpu")
    npu = results.get("npu")

    if not cpu and not npu:
        print(f"\n  {label}: no results (both backends failed)\n")
        return

    col_w = 20
    header = f"{'Metric':<25} {'CPU':>{col_w}} {'NPU':>{col_w}} {'Speedup':>{col_w}}"
    sep = "-" * len(header)

    print(f"\n  {sep}")
    print(f"  {header}")
    print(f"  {sep}")

    def row(metric, cpu_val, npu_val, fmt_fn, higher_better=False):
        cpu_str = fmt_fn(cpu_val) if cpu_val is not None else "n/a"
        npu_str = fmt_fn(npu_val) if npu_val is not None else "n/a"
        speedup = ""
        if cpu_val is not None and npu_val is not None and npu_val > 0 and cpu_val > 0:
            if higher_better:
                ratio = npu_val / cpu_val
            else:
                ratio = cpu_val / npu_val
            speedup = f"{ratio:.2f}x"
        print(f"  {metric:<25} {cpu_str:>{col_w}} {npu_str:>{col_w}} {speedup:>{col_w}}")

    cpu_mean = cpu["mean"] if cpu else None
    npu_mean = npu["mean"] if npu else None
    row("Mean latency", cpu_mean, npu_mean, fmt_ms)

    cpu_med = cpu["median"] if cpu else None
    npu_med = npu["median"] if npu else None
    row("Median latency", cpu_med, npu_med, fmt_ms)

    cpu_min = cpu["min"] if cpu else None
    npu_min = npu["min"] if npu else None
    row("Min latency", cpu_min, npu_min, fmt_ms)

    cpu_max = cpu["max"] if cpu else None
    npu_max = npu["max"] if npu else None
    row("Max latency", cpu_max, npu_max, fmt_ms)

    cpu_std = cpu["stdev"] if cpu else None
    npu_std = npu["stdev"] if npu else None
    row("Std dev", cpu_std, npu_std, fmt_ms)

    # Tokens/sec (LLM only)
    cpu_tps = cpu.get("tok_per_sec_avg") if cpu else None
    npu_tps = npu.get("tok_per_sec_avg") if npu else None
    if cpu_tps is not None or npu_tps is not None:
        row("Tokens/sec (avg)", cpu_tps, npu_tps,
            lambda v: f"{v:.1f} tok/s", higher_better=True)

    # Resource usage (if psutil was available)
    cpu_cpu_avg = cpu.get("cpu_avg") if cpu else None
    npu_cpu_avg = npu.get("cpu_avg") if npu else None
    if cpu_cpu_avg is not None or npu_cpu_avg is not None:
        row("CPU usage (avg)", cpu_cpu_avg, npu_cpu_avg, fmt_pct)

    cpu_cpu_peak = cpu.get("cpu_peak") if cpu else None
    npu_cpu_peak = npu.get("cpu_peak") if npu else None
    if cpu_cpu_peak is not None or npu_cpu_peak is not None:
        row("CPU usage (peak)", cpu_cpu_peak, npu_cpu_peak, fmt_pct)

    cpu_mem = cpu.get("mem_peak_mb") if cpu else None
    npu_mem = npu.get("mem_peak_mb") if npu else None
    if cpu_mem is not None or npu_mem is not None:
        row("Peak memory", cpu_mem, npu_mem, lambda v: f"{v:.0f} MB")

    print(f"  {sep}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Benchmark NPU vs CPU inference for the therapy companion"
    )
    parser.add_argument("--rounds", type=int, default=3,
                        help="Number of inference rounds per backend (default: 3)")
    parser.add_argument("--audio", type=str, default=None,
                        help="Path to a .wav file for ASR testing (generates tone if omitted)")
    parser.add_argument("--skip-asr", action="store_true",
                        help="Skip ASR (Whisper) benchmark")
    parser.add_argument("--skip-llm", action="store_true",
                        help="Skip LLM benchmark")
    args = parser.parse_args()

    print("=" * 70)
    print("  Conversational Therapy Companion — NPU vs CPU Benchmark")
    print("=" * 70)

    if not _HAS_PSUTIL:
        print("\n  Note: install 'psutil' for CPU/memory usage metrics")
        print("        pip install psutil\n")

    from qnn_utils import is_npu_available
    npu = is_npu_available()
    print(f"  NPU available: {npu}")
    print(f"  Rounds: {args.rounds}")

    # ASR benchmark
    if not args.skip_asr:
        print("\n" + "=" * 70)
        print("  ASR (Whisper) Benchmark")
        print("=" * 70)

        audio_path = args.audio
        generated = False
        if audio_path is None:
            audio_path = os.path.join(os.path.dirname(__file__), "_bench_tone.wav")
            generate_test_audio(audio_path)
            generated = True
            print(f"  Generated test audio: {audio_path}")

        asr_results = benchmark_asr(args.rounds, audio_path)
        print_comparison("ASR (Whisper)", asr_results)

        if generated and os.path.exists(audio_path):
            os.remove(audio_path)

    # LLM benchmark
    if not args.skip_llm:
        print("\n" + "=" * 70)
        print("  LLM Benchmark")
        print("=" * 70)

        llm_results = benchmark_llm(args.rounds)
        print_comparison("LLM", llm_results)

    print("\n" + "=" * 70)
    print("  Benchmark complete")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
