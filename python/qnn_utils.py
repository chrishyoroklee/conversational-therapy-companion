"""
QNN / NPU detection utilities.

Checks whether Qualcomm QNN Runtime is available via ONNX Runtime's
QNNExecutionProvider.  Used by asr.py and llm.py to decide between
NPU-accelerated and CPU-fallback backends.
"""

import os
import sys

_USE_NPU = os.getenv("USE_NPU", "auto").lower()


def is_npu_available() -> bool:
    """Return True when QNNExecutionProvider is present and USE_NPU is not 'false'."""
    if _USE_NPU == "false":
        return False

    try:
        import onnxruntime as ort

        available = "QNNExecutionProvider" in ort.get_available_providers()
        if available:
            print("[qnn_utils] QNNExecutionProvider detected", file=sys.stderr)
        else:
            print("[qnn_utils] QNNExecutionProvider not found", file=sys.stderr)
        return available
    except ImportError:
        print("[qnn_utils] onnxruntime not installed — NPU unavailable", file=sys.stderr)
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
