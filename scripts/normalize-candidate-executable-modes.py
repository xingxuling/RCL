"""Normalize known Linux command modes in a new local npm candidate archive.

No archive member is extracted. Payload hashes, order and all other modes are
checked after streaming the archive into a distinct file in the same directory.
"""
import argparse
import copy
import hashlib
import gzip
import json
from pathlib import Path
import tarfile


COMMANDS = {
    "package/native/linux/rclvm",
    "package/native/linux/rclc",
    "package/native/linux/rclvmd",
    "package/native/sequence-runtime/portable/linux/rclvm",
    "package/native/sequence-runtime/portable/linux/rclc",
}
REQUIRED = {"package/native/linux/rclvm", "package/native/linux/rclc"}


class HashedReader:
    def __init__(self, stream):
        self.stream = stream
        self.hash = hashlib.sha256()

    def read(self, size=-1):
        data = self.stream.read(size)
        self.hash.update(data)
        return data


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def normalize(source, target):
    if target.is_symlink():
        raise FileExistsError("Preserve an existing candidate symlink")
    source, target = source.resolve(strict=True), target.resolve()
    report_path = target.with_suffix(".manifest.json")
    if source.parent != target.parent or source == target:
        raise ValueError("Use distinct archive names in the same candidate directory")
    if target.exists() or report_path.exists() or report_path.is_symlink():
        raise FileExistsError("Candidate output or report already exists")
    entries, commands = [], []
    with target.open("xb") as output:
        with tarfile.open(source, "r|gz") as archive, gzip.GzipFile(filename="", fileobj=output, mode="wb", compresslevel=6, mtime=0) as compressed, tarfile.open(fileobj=compressed, mode="w|", format=tarfile.PAX_FORMAT) as rewritten:
            for member in archive:
                updated = copy.copy(member)
                if member.name in COMMANDS:
                    if not member.isfile():
                        raise ValueError("Linux command must be a regular file: " + member.name)
                    updated.mode = member.mode | 0o111
                    commands.append({"path": member.name, "before": oct(member.mode), "after": oct(updated.mode)})
                data = archive.extractfile(member) if member.isfile() else None
                hashed = HashedReader(data) if data else None
                rewritten.addfile(updated, hashed)
                entries.append((member.name, member.type, member.size, updated.mode, hashed.hash.hexdigest() if hashed else None))
                if data:
                    data.close()
    if not REQUIRED.issubset({entry["path"] for entry in commands}):
        raise ValueError("Required Linux commands are missing")
    count = 0
    with tarfile.open(target, "r|gz") as verified:
        for member in verified:
            data = verified.extractfile(member) if member.isfile() else None
            content_hash = hashlib.file_digest(data, "sha256").hexdigest() if data else None
            if data:
                data.close()
            actual = (member.name, member.type, member.size, member.mode, content_hash)
            if count >= len(entries) or actual != entries[count]:
                raise ValueError("Candidate payload or metadata drift: " + member.name)
            count += 1
    if count != len(entries):
        raise ValueError("Candidate entry count changed")
    report = {
        "format": "rcl.local-candidate-executable-modes.v1",
        "ok": True,
        "sourceArchive": source.name,
        "sourceSha256": digest(source),
        "archive": target.name,
        "archiveSha256": digest(target),
        "archiveBytes": target.stat().st_size,
        "entries": count,
        "commands": commands,
        "payloadHashesAndOrderPreserved": True,
        "otherModesPreserved": True,
        "published": False,
    }
    with report_path.open("x", encoding="utf-8", newline="\n") as output:
        output.write(json.dumps(report, indent=2) + "\n")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    args = parser.parse_args()
    print(json.dumps(normalize(args.source, args.target), indent=2))
