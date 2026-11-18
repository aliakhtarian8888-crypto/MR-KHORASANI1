#!/usr/bin/env python3
"""Build separate guest-browser and native Android installer ZIP packages."""
from __future__ import annotations
import argparse
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "2.9.6"
GUEST_FILES = [
    ".nojekyll", "index.html", "guest.html", "manifest.webmanifest", "supabase-config.js",
    "supabase-client.js", "guest-runtime.js", "warehouse-migration.js",
    "mrk-data-tools.js", "mrk-export-store.js", "sw.js", "icon.svg",
    "icon-192.png", "icon-512.png", "apple-touch-icon.png", "brand-mr.svg",
    "guest-entry-qr.png", "README-GUEST-BROWSER-FA.txt",
]

def read_required(relative: str) -> bytes:
    path = ROOT / relative
    if not path.is_file():
        raise FileNotFoundError(f"Required release file is missing: {relative}")
    return path.read_bytes()

def write_zip(path: Path, files: dict[str, bytes]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, content in sorted(files.items()):
            info = zipfile.ZipInfo(name)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, content, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

def verify_guest_bundle(files: dict[str, bytes]) -> None:
    if "index.html" not in files:
        raise RuntimeError("Guest browser ZIP must have index.html at its root.")
    html = files["index.html"].decode("utf-8")
    if "guest.html" not in html or "guest-entry-qr.png" not in html:
        raise RuntimeError("Guest browser entry link or QR reference is missing.")
    for name in ("guest.html", "manifest.webmanifest", "sw.js", "guest-runtime.js", "supabase-client.js"):
        if name not in files:
            raise RuntimeError(f"Guest browser ZIP is missing required file: {name}")

def package(output: Path, apk_path: Path, version: str = VERSION) -> tuple[Path, Path]:
    if version != VERSION:
        raise ValueError(f"This packaging script is pinned to source application version {VERSION}.")
    if not apk_path.is_file() or apk_path.stat().st_size < 100_000:
        raise FileNotFoundError("A non-empty, built Android APK is required via --apk.")
    if not zipfile.is_zipfile(apk_path):
        raise ValueError("The Android APK does not have a valid ZIP/APK container.")
    guest_files = {name: read_required(name) for name in GUEST_FILES}
    verify_guest_bundle(guest_files)
    android_files = {
        "MR-KHORASANI-2.9.6.apk": apk_path.read_bytes(),
        "android-install-qr.png": read_required("android-install-qr.png"),
        "README-ANDROID-INSTALL-FA.txt": read_required("README-ANDROID-INSTALL-FA.txt"),
    }
    guest_path = output / f"MR-KHORASANI-GUEST-BROWSER-v{version}.zip"
    android_path = output / f"MR-KHORASANI-ANDROID-INSTALL-v{version}.zip"
    write_zip(guest_path, guest_files)
    write_zip(android_path, android_files)
    for item in (guest_path, android_path):
        with zipfile.ZipFile(item) as archive:
            bad = archive.testzip()
            if bad:
                raise RuntimeError(f"Corrupt ZIP entry: {bad}")
    return guest_path, android_path

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--version", default=VERSION)
    args = parser.parse_args()
    guest, android = package(args.output.resolve(), args.apk.resolve(), args.version)
    print(f"GUEST_BROWSER={guest} ({guest.stat().st_size} bytes)")
    print(f"ANDROID_INSTALL={android} ({android.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
