"""
QNN / NPU detection utilities.

Checks whether Qualcomm QNN Runtime is available via:
1. Native QNN SDK (context binaries via qnn-net-run or C API)
2. ONNX Runtime's QNNExecutionProvider (ONNX models)

Used by asr.py and llm.py to decide between NPU-accelerated and CPU-fallback backends.
"""

import os
import sys

# Separate NPU toggles for ASR and LLM
_USE_NPU_ASR = os.getenv("USE_NPU_ASR", os.getenv("USE_NPU", "auto")).lower()
_USE_NPU_LLM = os.getenv("USE_NPU_LLM", os.getenv("USE_NPU", "auto")).lower()


def is_native_qnn_available() -> bool:
    """Return True when native QNN SDK is available with context binaries."""
    if _USE_NPU_ASR == "false":
        return False

    # Check for QNN SDK installation
    qnn_sdk_root = os.getenv("QNN_SDK_ROOT")
    if not qnn_sdk_root:
        return False

    # Check for QnnHtp.dll (HTP backend for NPU)
    htp_dll = os.path.join(qnn_sdk_root, "lib", "aarch64-windows-msvc", "QnnHtp.dll")
    if not os.path.exists(htp_dll):
        return False

    # Check for Whisper encoder+decoder context binaries
    encoder_path = os.path.join(
        os.path.dirname(__file__),
        "models/whisper/whisper_small_encoder_device.bin"
    )
    decoder_path = os.path.join(
        os.path.dirname(__file__),
        "models/whisper/whisper_small_decoder_device.bin"
    )

    if not os.path.exists(encoder_path) or not os.path.exists(decoder_path):
        return False

    print("[qnn_utils] Native QNN Runtime detected (ASR)", file=sys.stderr)
    return True


def is_npu_available() -> bool:
    """Return True when QNN is available for ASR (native SDK or ONNX Runtime EP)."""
    if _USE_NPU_ASR == "false":
        return False

    # Prefer native QNN over ONNX Runtime
    if is_native_qnn_available():
        return True

    # Fallback to ONNX Runtime QNN EP
    try:
        import onnxruntime as ort

        available = "QNNExecutionProvider" in ort.get_available_providers()
        if available:
            print("[qnn_utils] QNNExecutionProvider detected (ASR)", file=sys.stderr)
        else:
            print("[qnn_utils] QNNExecutionProvider not found", file=sys.stderr)
        return available
    except ImportError:
        print("[qnn_utils] onnxruntime not installed — NPU unavailable", file=sys.stderr)
        return False


def is_npu_available_llm() -> bool:
    """Return True when QNN is available for LLM."""
    if _USE_NPU_LLM == "false":
        return False

    try:
        import onnxruntime as ort

        available = "QNNExecutionProvider" in ort.get_available_providers()
        if available:
            print("[qnn_utils] QNNExecutionProvider detected (LLM)", file=sys.stderr)
        return available
    except ImportError:
        return False


def get_providers() -> list[str]:
    """Return the ordered list of ONNX Runtime execution providers to use."""
    if is_npu_available():
        return ["QNNExecutionProvider", "CPUExecutionProvider"]
    return ["CPUExecutionProvider"]


def get_qnn_provider_options() -> list[dict]:
    """Return provider options list aligned with get_providers().

    When QNN is active the first entry configures the HTP backend;
    the second (CPU) entry is empty.  When CPU-only, a single empty
    dict is returned.
    """
    if is_npu_available():
        return [{"backend_path": "QnnHtp.dll"}, {}]
    return [{}]
